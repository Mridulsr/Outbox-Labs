import type { Plugin } from 'vite';
import express from 'express';
import cors from 'cors';
import { apiRouter } from './api.js';
import { getDb } from './db.js';
import { getRedisConnection } from './redis.js';
import { initializeScheduler } from './queue.js';
import { getTransporter } from './mail.js';

let initialized = false;

export function emailSchedulerPlugin(): Plugin {
  const app = express();
  app.use(cors());
  app.use('/api', apiRouter);

  return {
    name: 'email-scheduler-server',
    configureServer(server) {
      if (!initialized) {
        initialized = true;
        (async () => {
          console.log('[EmailSchedulerPlugin] Bootstrapping ReachInbox Backend Services in background...');
          try {
            await getDb();
            await getRedisConnection();
            await getTransporter();
            await initializeScheduler();
            console.log('[EmailSchedulerPlugin] ReachInbox Backend successfully initialized.');
          } catch (err: any) {
            console.error('[EmailSchedulerPlugin] Startup error:', err.message);
          }
        })();
      }

      // Mount Express app onto Vite Connect middleware only when path begins with /api
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url.startsWith('/api') || req.url === '/api')) {
          app(req as any, res as any, next);
        } else {
          next();
        }
      });
    },
  };
}
