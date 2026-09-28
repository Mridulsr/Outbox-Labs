import { Queue, Worker, type Job } from 'bullmq';
import {
  getSystemSetting,
  setSystemSetting,
  getEmailById,
  updateEmailStatus,
  getUnfinishedEmails,
  type EmailRecord,
} from './db.js';
import { createRedisClient, checkAndIncrementHourlyRateLimit } from './redis.js';
import { sendEmail } from './mail.js';
import { notifyRateLimitHit } from './slack.js';
import { emailIndexer } from './indexer.js';

export interface EmailJobData {
  emailId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

const QUEUE_NAME = 'reachinbox-email-queue';

let emailQueue: Queue<EmailJobData> | null = null;
let emailWorker: Worker<EmailJobData> | null = null;
let isInitialized = false;

// Default configurations
export async function getConfiguredSettings() {
  const concurrencyStr = await getSystemSetting(
    'WORKER_CONCURRENCY',
    process.env.WORKER_CONCURRENCY || '5'
  );
  const minDelayStr = await getSystemSetting(
    'MIN_DELAY_BETWEEN_EMAILS_MS',
    process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000'
  );
  const hourlyLimitStr = await getSystemSetting(
    'MAX_EMAILS_PER_HOUR_PER_SENDER',
    process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '10'
  );

  return {
    workerConcurrency: Math.max(1, parseInt(concurrencyStr, 10) || 5),
    minDelayBetweenEmailsMs: Math.max(500, parseInt(minDelayStr, 10) || 2000),
    maxEmailsPerHourPerSender: Math.max(1, parseInt(hourlyLimitStr, 10) || 10),
  };
}

export async function updateConfiguredSettings(newSettings: {
  workerConcurrency?: number;
  minDelayBetweenEmailsMs?: number;
  maxEmailsPerHourPerSender?: number;
}) {
  if (newSettings.workerConcurrency) {
    await setSystemSetting('WORKER_CONCURRENCY', String(newSettings.workerConcurrency));
  }
  if (newSettings.minDelayBetweenEmailsMs) {
    await setSystemSetting('MIN_DELAY_BETWEEN_EMAILS_MS', String(newSettings.minDelayBetweenEmailsMs));
  }
  if (newSettings.maxEmailsPerHourPerSender) {
    await setSystemSetting('MAX_EMAILS_PER_HOUR_PER_SENDER', String(newSettings.maxEmailsPerHourPerSender));
  }

  // Update worker concurrency dynamically if running
  if (emailWorker && newSettings.workerConcurrency) {
    emailWorker.concurrency = newSettings.workerConcurrency;
  }
}

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    const redis = createRedisClient();
    emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    emailQueue.on('error', (err) => {
      console.warn('[Queue] BullMQ Queue error:', err.message);
    });
  }
  return emailQueue;
}

/**
 * Schedule an email into PostgreSQL and BullMQ
 */
export async function scheduleEmailJob(params: {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  minDelayMs?: number;
  hourlyLimit?: number;
}) {
  const queue = getEmailQueue();
  const now = Date.now();
  const runAt = params.scheduledAt.getTime();
  const delay = Math.max(0, runAt - now);

  const job = await queue.add(
    'send-email',
    {
      emailId: params.id,
      sender: params.sender,
      recipient: params.recipient,
      subject: params.subject,
      body: params.body,
      scheduledAt: params.scheduledAt.toISOString(),
      delayBetweenEmailsMs: params.minDelayMs,
      hourlyLimit: params.hourlyLimit,
    },
    {
      jobId: params.id, // Idempotent key - ensures uniqueness across restarts
      delay,
    }
  );

  console.log(`[Queue] Scheduled job ${params.id} for ${params.recipient} with delay ${delay}ms`);
  return job;
}

/**
 * Worker Processor - handles concurrency, provider pacing delay, rate limiting, and Ethereal sending
 */
async function processEmailJob(job: Job<EmailJobData>) {
  const data = job.data;
  console.log(`[Worker] Picking up job ${job.id} for recipient: ${data.recipient}`);

  // 1. Idempotency Check: Verify database status
  const emailRecord = await getEmailById(data.emailId);
  if (!emailRecord) {
    console.warn(`[Worker] Email ${data.emailId} not found in database. Skipping.`);
    return { status: 'skipped_not_found' };
  }

  if (emailRecord.status === 'sent') {
    console.log(`[Worker] Email ${data.emailId} already marked as sent. Idempotency preserved.`);
    return { status: 'already_sent' };
  }

  // 2. Fetch current configurations
  const settings = await getConfiguredSettings();
  const hourlyLimit = data.hourlyLimit || settings.maxEmailsPerHourPerSender;
  const minDelayMs = data.delayBetweenEmailsMs || settings.minDelayBetweenEmailsMs;

  // 3. Hourly Rate Limiting Check via Redis atomic counter
  const rateCheck = await checkAndIncrementHourlyRateLimit(data.sender, hourlyLimit);

  if (!rateCheck.allowed) {
    console.warn(
      `[Worker] Hourly rate limit reached for sender ${data.sender} (${rateCheck.count}/${hourlyLimit}). Rescheduling job ${job.id}...`
    );

    // Stagger rescheduled jobs into the next hourly window
    const baseRescheduleMs = rateCheck.resetsInMs;
    // Add small random jitter (0-60s) to prevent a thundering herd when the window opens
    const jitterMs = Math.floor(Math.random() * 60000);
    const totalDelayMs = baseRescheduleMs + jitterMs;
    const newScheduledAt = new Date(Date.now() + totalDelayMs);

    // Update DB status to rescheduled
    await updateEmailStatus(data.emailId, {
      status: 'rescheduled',
      scheduled_at: newScheduledAt.toISOString(),
      error_message: `Hourly rate limit exceeded (${rateCheck.count}/${hourlyLimit}). Rescheduled to next hour window.`,
      attemptsIncrement: true,
    });

    const updatedRecord = await getEmailById(data.emailId);
    if (updatedRecord) emailIndexer.indexEmail(updatedRecord);

    // Send Live Slack Notification immediately
    await notifyRateLimitHit({
      sender: data.sender,
      count: rateCheck.count,
      limit: hourlyLimit,
      rescheduledTo: newScheduledAt,
      jobId: String(job.id),
      recipient: data.recipient,
    });

    // Reschedule in BullMQ with new delay
    const queue = getEmailQueue();
    await queue.add(
      'send-email',
      {
        ...data,
        scheduledAt: newScheduledAt.toISOString(),
      },
      {
        delay: totalDelayMs,
        jobId: `${data.emailId}-r${Date.now()}`, // New job ID for rescheduled instance
      }
    );

    return {
      status: 'rescheduled',
      reason: 'hourly_rate_limit_exceeded',
      rescheduledTo: newScheduledAt.toISOString(),
    };
  }

  // 4. Provider Pacing Delay (mimic provider throttling)
  if (minDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, minDelayMs));
  }

  // 5. Send Email via Ethereal SMTP
  try {
    const sendResult = await sendEmail({
      sender: data.sender,
      recipient: data.recipient,
      subject: data.subject,
      body: data.body,
    });

    // Update database record to 'sent'
    const updated = await updateEmailStatus(data.emailId, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      ethereal_url: sendResult.etherealUrl,
      error_message: null,
      attemptsIncrement: true,
    });

    if (updated) {
      emailIndexer.indexEmail(updated);
    }

    console.log(`[Worker] Job ${job.id} successfully processed! Ethereal URL: ${sendResult.etherealUrl}`);
    return {
      status: 'sent',
      messageId: sendResult.messageId,
      etherealUrl: sendResult.etherealUrl,
    };
  } catch (sendErr: any) {
    console.error(`[Worker] Failed sending email ${data.emailId}:`, sendErr.message);

    const updated = await updateEmailStatus(data.emailId, {
      status: 'failed',
      error_message: sendErr.message,
      attemptsIncrement: true,
    });

    if (updated) {
      emailIndexer.indexEmail(updated);
    }

    throw sendErr; // BullMQ handles retry attempts
  }
}

/**
 * Initializes the BullMQ Worker and ensures persistence recovery
 */
export async function initializeScheduler() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[Scheduler] Initializing BullMQ Worker...');
  const settings = await getConfiguredSettings();
  const redis = createRedisClient();

  emailWorker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection: redis,
    concurrency: settings.workerConcurrency,
  });

  emailWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  emailWorker.on('failed', (job, err) => {
    console.warn(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  emailWorker.on('error', (err) => {
    console.warn('[Worker] Worker internal error:', err.message);
  });

  // Server Restart Recovery (Persistence guarantee)
  await recoverQueueAfterRestart();
}

/**
 * Recovers any unfinished emails after a server restart without losing or duplicating jobs
 */
export async function recoverQueueAfterRestart() {
  try {
    console.log('[Scheduler] Performing startup recovery check for pending emails...');
    const unfinished = await getUnfinishedEmails();
    const queue = getEmailQueue();
    let recoveredCount = 0;

    for (const email of unfinished) {
      emailIndexer.indexEmail(email);

      // Check if job already exists in BullMQ
      const existingJob = await queue.getJob(email.id);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'active' || state === 'delayed' || state === 'waiting') {
          // Already properly enqueued
          continue;
        }
      }

      // Re-enqueue job with remaining delay
      const scheduledTime = new Date(email.scheduled_at).getTime();
      const delay = Math.max(0, scheduledTime - Date.now());

      await queue.add(
        'send-email',
        {
          emailId: email.id,
          sender: email.sender,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          scheduledAt: email.scheduled_at,
        },
        {
          jobId: email.id,
          delay,
        }
      );
      recoveredCount++;
    }

    console.log(`[Scheduler] Recovery complete: ${recoveredCount} jobs verified and re-enqueued.`);
  } catch (err: any) {
    console.error('[Scheduler] Recovery check error:', err.message);
  }
}

/**
 * Returns live real-time statistics for the BullMQ Queue
 */
export async function getLiveQueueStats() {
  const queue = getEmailQueue();
  const [counts, isPaused] = await Promise.all([
    queue.getJobCounts('active', 'delayed', 'waiting', 'completed', 'failed'),
    queue.isPaused(),
  ]);

  const settings = await getConfiguredSettings();

  return {
    queueName: QUEUE_NAME,
    isPaused,
    counts,
    concurrency: settings.workerConcurrency,
    minDelayMs: settings.minDelayBetweenEmailsMs,
    maxEmailsPerHour: settings.maxEmailsPerHourPerSender,
  };
}

/**
 * Get active, delayed, waiting jobs list for live queue dashboard
 */
export async function getLiveQueueJobs(limit = 20) {
  const queue = getEmailQueue();
  const [active, delayed, waiting, failed, completed] = await Promise.all([
    queue.getJobs(['active'], 0, limit),
    queue.getJobs(['delayed'], 0, limit),
    queue.getJobs(['waiting'], 0, limit),
    queue.getJobs(['failed'], 0, limit),
    queue.getJobs(['completed'], 0, limit),
  ]);

  const formatJob = (j: Job<EmailJobData>, state: string) => ({
    id: j.id,
    name: j.name,
    state,
    recipient: j.data?.recipient,
    sender: j.data?.sender,
    subject: j.data?.subject,
    delayRemainingMs: Math.max(0, (j.timestamp + (j.opts.delay || 0)) - Date.now()),
    attemptsMade: j.attemptsMade,
    failedReason: j.failedReason,
    timestamp: new Date(j.timestamp).toISOString(),
  });

  return {
    active: active.map((j) => formatJob(j, 'active')),
    delayed: delayed.map((j) => formatJob(j, 'delayed')),
    waiting: waiting.map((j) => formatJob(j, 'waiting')),
    failed: failed.map((j) => formatJob(j, 'failed')),
    completed: completed.map((j) => formatJob(j, 'completed')),
  };
}

export async function pauseSchedulerQueue() {
  const queue = getEmailQueue();
  await queue.pause();
  return true;
}

export async function resumeSchedulerQueue() {
  const queue = getEmailQueue();
  await queue.resume();
  return true;
}

export async function retryAllFailedJobs() {
  const queue = getEmailQueue();
  const failedJobs = await queue.getJobs(['failed'], 0, 100);
  for (const job of failedJobs) {
    await job.retry();
  }
  return { retriedCount: failedJobs.length };
}

export async function cancelJob(emailId: string) {
  const queue = getEmailQueue();
  const job = await queue.getJob(emailId);
  if (job) {
    await job.remove();
  }
  return true;
}
