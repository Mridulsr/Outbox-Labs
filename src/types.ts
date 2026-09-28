export interface Email {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: 'scheduled' | 'sent' | 'failed' | 'rescheduled';
  sent_at: string | null;
  error_message: string | null;
  ethereal_url: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface QueueJob {
  id: string;
  name: string;
  state: 'active' | 'delayed' | 'waiting' | 'failed' | 'completed';
  recipient?: string;
  sender?: string;
  subject?: string;
  delayRemainingMs: number;
  attemptsMade: number;
  failedReason?: string;
  timestamp: string;
}

export interface QueueStats {
  queueName: string;
  isPaused: boolean;
  counts: {
    active: number;
    delayed: number;
    waiting: number;
    completed: number;
    failed: number;
    paused?: number;
  };
  concurrency: number;
  minDelayMs: number;
  maxEmailsPerHour: number;
}

export interface SlackStatus {
  connected: boolean;
  channelName?: string;
  webhookUrlMasked?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

export interface SearchHit {
  id: string;
  score: number;
  email: Email;
  highlights: {
    subject?: string;
    body?: string;
    recipient?: string;
    sender?: string;
  };
}

export interface SearchResponse {
  total: number;
  hits: SearchHit[];
  tookMs: number;
  indexStats: {
    totalDocs: number;
    totalTerms: number;
  };
}
