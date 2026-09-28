import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { apiRouter } from './server/api.js';
import { getDb } from './server/db.js';
import { getRedisConnection } from './server/redis.js';
import { initializeScheduler } from './server/queue.js';
import { getTransporter } from './server/mail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use('/api', apiRouter);

// Serve static assets from dist in production
const distDir = path.resolve(__dirname, 'dist');
app.use(express.static(distDir));

app.get('*', (_req, res) => {
  res.sendFile(path.resolve(distDir, 'index.html'));
});

async function startServer() {
  console.log('[Server] Starting ReachInbox Full-Stack Email Scheduler...');
  await getDb();
  await getRedisConnection();
  await getTransporter();
  await initializeScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] ReachInbox Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
