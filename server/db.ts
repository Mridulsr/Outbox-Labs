import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export interface EmailRecord {
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

let dbInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.resolve(process.cwd(), 'data', 'pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log(`[Database] Initializing PostgreSQL database at ${dataDir}`);
  const db = new PGlite(dataDir);
  await db.waitReady;

  // Create tables if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      sent_at TIMESTAMPTZ,
      error_message TEXT,
      ethereal_url TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
    CREATE INDEX IF NOT EXISTS idx_emails_scheduled ON emails(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS slack_config (
      id TEXT PRIMARY KEY,
      webhook_url TEXT NOT NULL,
      channel_name TEXT,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('[Database] PostgreSQL schema initialized successfully.');
  dbInstance = db;
  return dbInstance;
}

export async function queryEmails(statusFilter?: string): Promise<EmailRecord[]> {
  const db = await getDb();
  let res;
  if (statusFilter) {
    res = await db.query<EmailRecord>(
      'SELECT * FROM emails WHERE status = $1 ORDER BY scheduled_at DESC, created_at DESC',
      [statusFilter]
    );
  } else {
    res = await db.query<EmailRecord>(
      'SELECT * FROM emails ORDER BY created_at DESC'
    );
  }
  return res.rows;
}

export async function getEmailById(id: string): Promise<EmailRecord | null> {
  const db = await getDb();
  const res = await db.query<EmailRecord>('SELECT * FROM emails WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function insertEmail(email: {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status?: 'scheduled' | 'sent' | 'failed' | 'rescheduled';
}): Promise<EmailRecord> {
  const db = await getDb();
  const res = await db.query<EmailRecord>(
    `INSERT INTO emails (id, sender, recipient, subject, body, scheduled_at, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [
      email.id,
      email.sender,
      email.recipient,
      email.subject,
      email.body,
      email.scheduled_at,
      email.status || 'scheduled',
    ]
  );
  return res.rows[0];
}

export async function updateEmailStatus(
  id: string,
  update: {
    status: 'scheduled' | 'sent' | 'failed' | 'rescheduled';
    sent_at?: string | null;
    error_message?: string | null;
    ethereal_url?: string | null;
    scheduled_at?: string;
    attemptsIncrement?: boolean;
  }
): Promise<EmailRecord | null> {
  const db = await getDb();
  const existing = await getEmailById(id);
  if (!existing) return null;

  const newAttempts = update.attemptsIncrement ? existing.attempts + 1 : existing.attempts;
  const newSentAt = update.sent_at !== undefined ? update.sent_at : existing.sent_at;
  const newErr = update.error_message !== undefined ? update.error_message : existing.error_message;
  const newUrl = update.ethereal_url !== undefined ? update.ethereal_url : existing.ethereal_url;
  const newScheduledAt = update.scheduled_at !== undefined ? update.scheduled_at : existing.scheduled_at;

  const res = await db.query<EmailRecord>(
    `UPDATE emails
     SET status = $1,
         sent_at = $2,
         error_message = $3,
         ethereal_url = $4,
         scheduled_at = $5,
         attempts = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      update.status,
      newSentAt,
      newErr,
      newUrl,
      newScheduledAt,
      newAttempts,
      id,
    ]
  );
  return res.rows[0] || null;
}

export async function deleteEmail(id: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.query('DELETE FROM emails WHERE id = $1', [id]);
  return (res.affectedRows || 0) > 0;
}

export async function getUnfinishedEmails(): Promise<EmailRecord[]> {
  const db = await getDb();
  const res = await db.query<EmailRecord>(
    "SELECT * FROM emails WHERE status IN ('scheduled', 'rescheduled') ORDER BY scheduled_at ASC"
  );
  return res.rows;
}

export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  const db = await getDb();
  const res = await db.query<{ key: string; value: string }>(
    'SELECT value FROM system_settings WHERE key = $1',
    [key]
  );
  return res.rows[0]?.value ?? defaultValue;
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

export async function getSlackConfig(): Promise<{ webhook_url: string; channel_name?: string } | null> {
  const db = await getDb();
  const res = await db.query<{ webhook_url: string; channel_name: string }>(
    'SELECT webhook_url, channel_name FROM slack_config WHERE id = $1',
    ['primary']
  );
  return res.rows[0] || null;
}

export async function saveSlackConfig(webhookUrl: string, channelName: string = 'reachinbox-alerts'): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO slack_config (id, webhook_url, channel_name, connected_at)
     VALUES ('primary', $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET webhook_url = EXCLUDED.webhook_url, channel_name = EXCLUDED.channel_name, connected_at = NOW()`,
    [webhookUrl, channelName]
  );
}

export async function deleteSlackConfig(): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM slack_config WHERE id = 'primary'");
}
