import type { Email, QueueStats, QueueJob, SlackStatus, SearchResponse } from '../types';

const BASE_URL = '/api';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Emails
  getEmails: (status?: string) =>
    fetchJson<{ success: boolean; count: number; emails: Email[] }>(
      `/emails${status ? `?status=${status}` : ''}`
    ),

  getScheduledEmails: () =>
    fetchJson<{ success: boolean; count: number; emails: Email[] }>('/emails/scheduled'),

  getSentEmails: () =>
    fetchJson<{ success: boolean; count: number; emails: Email[] }>('/emails/sent'),

  scheduleEmails: (data: {
    sender: string;
    recipients: string[];
    subject: string;
    body: string;
    startTime?: string;
    delayBetweenEmailsMs?: number;
    hourlyLimit?: number;
  }) =>
    fetchJson<{ success: boolean; message: string; count: number; emails: Email[] }>(
      '/emails/schedule',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  cancelEmail: (id: string) =>
    fetchJson<{ success: boolean; message: string }>(`/emails/${id}`, {
      method: 'DELETE',
    }),

  // Search
  searchEmails: (query?: string, status?: string, sender?: string) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (status && status !== 'all') params.append('status', status);
    if (sender) params.append('sender', sender);
    return fetchJson<SearchResponse & { success: boolean }>(`/search?${params.toString()}`);
  },

  getSearchStats: () =>
    fetchJson<{ success: boolean; stats: { totalDocs: number; totalTerms: number; fields: string[] } }>(
      '/search/stats'
    ),

  // BullMQ Queue
  getQueueStats: () => fetchJson<{ success: boolean; stats: QueueStats }>('/queue/stats'),

  getQueueJobs: (limit = 20) =>
    fetchJson<{
      success: boolean;
      jobs: {
        active: QueueJob[];
        delayed: QueueJob[];
        waiting: QueueJob[];
        failed: QueueJob[];
        completed: QueueJob[];
      };
    }>(`/queue/jobs?limit=${limit}`),

  pauseQueue: () => fetchJson<{ success: boolean; message: string }>('/queue/pause', { method: 'POST' }),

  resumeQueue: () => fetchJson<{ success: boolean; message: string }>('/queue/resume', { method: 'POST' }),

  retryAllFailed: () =>
    fetchJson<{ success: boolean; message: string; retriedCount: number }>('/queue/retry-all', {
      method: 'POST',
    }),

  // Slack Integration
  getSlackStatus: () => fetchJson<{ success: boolean } & SlackStatus>('/slack/status'),

  connectSlack: (webhookUrl: string, channelName?: string) =>
    fetchJson<{ success: boolean; message: string }>('/slack/connect', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl, channelName }),
    }),

  testSlack: () => fetchJson<{ success: boolean; message: string }>('/slack/test', { method: 'POST' }),

  disconnectSlack: () =>
    fetchJson<{ success: boolean; message: string }>('/slack/disconnect', { method: 'POST' }),

  // Settings
  getSettings: () =>
    fetchJson<{
      success: boolean;
      settings: {
        workerConcurrency: number;
        minDelayBetweenEmailsMs: number;
        maxEmailsPerHourPerSender: number;
      };
    }>('/settings'),

  updateSettings: (settings: {
    workerConcurrency?: number;
    minDelayBetweenEmailsMs?: number;
    maxEmailsPerHourPerSender?: number;
  }) =>
    fetchJson<{ success: boolean; message: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // SMTP Info
  getMailAccount: () =>
    fetchJson<{
      success: boolean;
      credentials: { user: string; pass: string; webUrl?: string } | null;
    }>('/mail/account'),
};
