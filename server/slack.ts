import { getSlackConfig, saveSlackConfig, deleteSlackConfig } from './db.js';

export interface SlackAlertData {
  sender: string;
  count: number;
  limit: number;
  rescheduledTo: Date;
  jobId: string;
  recipient: string;
}

export async function getSlackIntegrationStatus(): Promise<{
  connected: boolean;
  channelName?: string;
  webhookUrlMasked?: string;
}> {
  const envWebhook = process.env.SLACK_WEBHOOK_URL;
  const dbConfig = await getSlackConfig();

  const webhook = dbConfig?.webhook_url || envWebhook;
  if (!webhook) {
    return { connected: false };
  }

  // Mask webhook URL for safety (e.g. https://hooks.slack.com/.../XXXXX)
  const parts = webhook.split('/');
  const lastPart = parts[parts.length - 1] || '';
  const masked = lastPart ? `.../${lastPart.slice(-6)}` : 'configured';

  return {
    connected: true,
    channelName: dbConfig?.channel_name || '#general',
    webhookUrlMasked: masked,
  };
}

export async function connectSlackWebhook(webhookUrl: string, channelName?: string): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    throw new Error('Invalid Slack webhook URL. Must start with https://hooks.slack.com/');
  }
  await saveSlackConfig(webhookUrl, channelName || '#general');
  return true;
}

export async function disconnectSlackIntegration(): Promise<void> {
  await deleteSlackConfig();
}

export async function sendSlackPayload(payload: any): Promise<boolean> {
  const dbConfig = await getSlackConfig();
  const webhookUrl = dbConfig?.webhook_url || process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Slack] No Slack webhook configured. Rate limit alert skipped.');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Slack] Webhook response error (${response.status}): ${errText}`);
      return false;
    }

    console.log('[Slack] Webhook notification sent successfully!');
    return true;
  } catch (err: any) {
    console.error('[Slack] Error dispatching webhook:', err.message);
    return false;
  }
}

/**
 * Live notification sent immediately when a sender exceeds the hourly rate limit
 */
export async function notifyRateLimitHit(data: SlackAlertData): Promise<boolean> {
  const status = await getSlackIntegrationStatus();
  if (!status.connected) {
    console.log(`[Slack] Rate limit reached for ${data.sender} (${data.count}/${data.limit}), but Slack is not connected.`);
    return false;
  }

  const payload = {
    text: `⚠️ *ReachInbox Rate Limit Alert*: Sender \`${data.sender}\` exceeded hourly limit!`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ ReachInbox Hourly Rate Limit Hit',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender Account:*\n\`${data.sender}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Hourly Limit:*\n*${data.limit} emails / hour*`,
          },
          {
            type: 'mrkdwn',
            text: `*Attempts This Window:*\n*${data.count} sends attempted*`,
          },
          {
            type: 'mrkdwn',
            text: `*Affected Recipient:*\n\`${data.recipient}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🛡️ *Automatic Resilience:* This job (ID \`${data.jobId}\`) has been *automatically rescheduled* to \`${data.rescheduledTo.toLocaleTimeString()} UTC\` in the next hour window. *No jobs were dropped.*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `⚡ BullMQ Worker Engine | System Time: ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  return await sendSlackPayload(payload);
}

/**
 * Send a verification test message to the user's Slack
 */
export async function sendSlackTestMessage(): Promise<boolean> {
  const payload = {
    text: '🚀 *ReachInbox Scheduler*: Slack Integration Connected!',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 ReachInbox Notification Test',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Your Slack channel is now connected to **ReachInbox Email Scheduler**.\nYou will receive real-time alerts whenever a sender exceeds their hourly rate limit.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Connected at: ${new Date().toLocaleString()} | Worker Status: Healthy`,
          },
        ],
      },
    ],
  };

  return await sendSlackPayload(payload);
}
