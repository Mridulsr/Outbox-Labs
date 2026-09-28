import { Router, json, urlencoded, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  queryEmails,
  getEmailById,
  insertEmail,
  deleteEmail,
  type EmailRecord,
} from './db.js';
import {
  scheduleEmailJob,
  cancelJob,
  getLiveQueueStats,
  getLiveQueueJobs,
  pauseSchedulerQueue,
  resumeSchedulerQueue,
  retryAllFailedJobs,
  getConfiguredSettings,
  updateConfiguredSettings,
} from './queue.js';
import { emailIndexer } from './indexer.js';
import {
  getSlackIntegrationStatus,
  connectSlackWebhook,
  disconnectSlackIntegration,
  sendSlackTestMessage,
} from './slack.js';
import { getMailCredentials } from './mail.js';
import { getRedisConnection } from './redis.js';

export const apiRouter = Router();

// Middleware
apiRouter.use(json({ limit: '10mb' }));
apiRouter.use(urlencoded({ extended: true, limit: '10mb' }));

/**
 * Health & Diagnostics
 */
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const redis = await getRedisConnection();
    const redisPing = await redis.ping();
    const credentials = await getMailCredentials();
    const settings = await getConfiguredSettings();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      redis: redisPing === 'PONG' ? 'connected' : 'error',
      database: 'postgresql_ready',
      etherealSmtp: credentials ? 'configured' : 'initializing',
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

/**
 * Fetch Emails (all, or filtered)
 */
apiRouter.get('/emails', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const emails = await queryEmails(status);
    res.json({ success: true, count: emails.length, emails });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/emails/scheduled', async (_req: Request, res: Response) => {
  try {
    const all = await queryEmails();
    const scheduled = all.filter((e) => e.status === 'scheduled' || e.status === 'rescheduled');
    res.json({ success: true, count: scheduled.length, emails: scheduled });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/emails/sent', async (_req: Request, res: Response) => {
  try {
    const sent = await queryEmails('sent');
    res.json({ success: true, count: sent.length, emails: sent });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Schedule New Emails (Supports single or batch lead campaigns)
 */
apiRouter.post('/emails/schedule', async (req: Request, res: Response) => {
  try {
    const {
      sender = 'campaign@reachinbox.test',
      recipients, // Array of email strings, or single email string
      subject,
      body,
      startTime, // ISO string or timestamp
      delayBetweenEmailsMs, // e.g. 2000
      hourlyLimit, // e.g. 10
    } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'Subject and body are required' });
    }

    let recipientList: string[] = [];
    if (Array.isArray(recipients)) {
      recipientList = recipients.map((r) => String(r).trim()).filter(Boolean);
    } else if (typeof recipients === 'string') {
      recipientList = recipients
        .split(/[\n,;]+/)
        .map((r) => r.trim())
        .filter(Boolean);
    }

    if (recipientList.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid recipient is required' });
    }

    const baseStartTime = startTime ? new Date(startTime).getTime() : Date.now();
    const minDelay = delayBetweenEmailsMs !== undefined ? Number(delayBetweenEmailsMs) : 2000;
    const limit = hourlyLimit !== undefined ? Number(hourlyLimit) : undefined;

    const scheduledRecords: EmailRecord[] = [];

    for (let i = 0; i < recipientList.length; i++) {
      const recipient = recipientList[i];
      const scheduledTime = new Date(baseStartTime + i * minDelay);
      const emailId = randomUUID();

      // 1. Persist to PostgreSQL database
      const record = await insertEmail({
        id: emailId,
        sender,
        recipient,
        subject,
        body,
        scheduled_at: scheduledTime.toISOString(),
        status: 'scheduled',
      });

      // 2. Index in Elasticsearch engine
      emailIndexer.indexEmail(record);

      // 3. Schedule via BullMQ delayed job
      await scheduleEmailJob({
        id: emailId,
        sender,
        recipient,
        subject,
        body,
        scheduledAt: scheduledTime,
        minDelayMs: minDelay,
        hourlyLimit: limit,
      });

      scheduledRecords.push(record);
    }

    res.json({
      success: true,
      message: `Successfully scheduled ${scheduledRecords.length} email(s) via BullMQ`,
      count: scheduledRecords.length,
      emails: scheduledRecords,
    });
  } catch (err: any) {
    console.error('[API] Schedule error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Cancel a scheduled email
 */
apiRouter.delete('/emails/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const email = await getEmailById(id);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email record not found' });
    }

    // Cancel in BullMQ
    await cancelJob(id);

    // Delete from DB & Index
    await deleteEmail(id);
    emailIndexer.deleteEmail(id);

    res.json({ success: true, message: `Email ${id} canceled and removed` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Elasticsearch Search Endpoint
 */
apiRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string | undefined;
    const status = req.query.status as string | undefined;
    const sender = req.query.sender as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = emailIndexer.search({
      query: q,
      status,
      sender,
      limit,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/search/stats', (_req: Request, res: Response) => {
  res.json({ success: true, stats: emailIndexer.getStats() });
});

/**
 * Live BullMQ Queue Visibility & Control
 */
apiRouter.get('/queue/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getLiveQueueStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/queue/jobs', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const jobs = await getLiveQueueJobs(limit);
    res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/queue/pause', async (_req: Request, res: Response) => {
  try {
    await pauseSchedulerQueue();
    res.json({ success: true, message: 'BullMQ Queue paused' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/queue/resume', async (_req: Request, res: Response) => {
  try {
    await resumeSchedulerQueue();
    res.json({ success: true, message: 'BullMQ Queue resumed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/queue/retry-all', async (_req: Request, res: Response) => {
  try {
    const result = await retryAllFailedJobs();
    res.json({ success: true, message: `Retried ${result.retriedCount} failed jobs`, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Slack Integration
 */
apiRouter.get('/slack/status', async (_req: Request, res: Response) => {
  try {
    const status = await getSlackIntegrationStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/slack/connect', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, channelName } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'Webhook URL is required' });
    }
    await connectSlackWebhook(webhookUrl, channelName);
    res.json({ success: true, message: 'Slack connected successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/slack/test', async (_req: Request, res: Response) => {
  try {
    const sent = await sendSlackTestMessage();
    if (!sent) {
      return res.status(400).json({
        success: false,
        error: 'Failed to send test message. Check your Slack webhook URL.',
      });
    }
    res.json({ success: true, message: 'Test message sent to Slack!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/slack/disconnect', async (_req: Request, res: Response) => {
  try {
    await disconnectSlackIntegration();
    res.json({ success: true, message: 'Slack disconnected' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * System Settings
 */
apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getConfiguredSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  try {
    const { workerConcurrency, minDelayBetweenEmailsMs, maxEmailsPerHourPerSender } = req.body;
    await updateConfiguredSettings({
      workerConcurrency: workerConcurrency ? Number(workerConcurrency) : undefined,
      minDelayBetweenEmailsMs: minDelayBetweenEmailsMs ? Number(minDelayBetweenEmailsMs) : undefined,
      maxEmailsPerHourPerSender: maxEmailsPerHourPerSender ? Number(maxEmailsPerHourPerSender) : undefined,
    });
    const settings = await getConfiguredSettings();
    res.json({ success: true, message: 'Settings updated successfully', settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Ethereal SMTP Diagnostics
 */
apiRouter.get('/mail/account', async (_req: Request, res: Response) => {
  try {
    const credentials = await getMailCredentials();
    res.json({ success: true, credentials });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
