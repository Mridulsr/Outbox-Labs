import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;
let isStartingRedis = false;

function getBinaryPaths() {
  const localDir = path.resolve(process.cwd(), 'bin');
  const localServer = path.join(localDir, 'redis-server');
  const localCli = path.join(localDir, 'redis-cli');

  const serverCmd = fs.existsSync(localServer) ? localServer : 'redis-server';
  const cliCmd = fs.existsSync(localCli) ? localCli : 'redis-cli';

  return { serverCmd, cliCmd };
}

function ensureRedisDaemon(): Promise<void> {
  return new Promise((resolve) => {
    const { serverCmd, cliCmd } = getBinaryPaths();

    exec(`${cliCmd} ping`, (err, stdout) => {
      if (!err && stdout.trim().toUpperCase().includes('PONG')) {
        return resolve();
      }
      console.log(`[Redis] redis-server not running. Starting daemon with ${serverCmd}...`);
      exec(`${serverCmd} --daemonize yes`, (startErr) => {
        if (startErr) {
          console.warn('[Redis] Warning: Failed to spawn redis-server daemon:', startErr.message);
        } else {
          console.log('[Redis] Daemon started successfully.');
        }
        // Brief pause to allow socket to bind
        setTimeout(resolve, 600);
      });
    });
  });
}

export async function getRedisConnection(): Promise<Redis> {
  if (redisInstance && redisInstance.status === 'ready') {
    return redisInstance;
  }

  if (!isStartingRedis) {
    isStartingRedis = true;
    await ensureRedisDaemon();
    isStartingRedis = false;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log(`[Redis] Connecting to ${redisUrl}...`);

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
  });

  client.on('connect', () => {
    console.log('[Redis] Connected successfully.');
  });

  client.on('error', (err) => {
    console.warn('[Redis] Connection warning:', err.message);
  });

  redisInstance = client;
  return redisInstance;
}

export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 200, 3000);
    },
  });

  client.on('error', (err) => {
    console.warn('[RedisClient] Connection warning:', err.message);
  });

  return client;
}

/**
 * Atomic Hourly Rate Limiter per Sender using Redis
 * Key format: `rate_limit:{sender}:{hourWindowTimestamp}`
 * Returns: { allowed: boolean, count: number, limit: number, resetsInMs: number }
 */
export async function checkAndIncrementHourlyRateLimit(
  sender: string,
  limit: number
): Promise<{ allowed: boolean; count: number; limit: number; resetsInMs: number }> {
  const redis = await getRedisConnection();
  const now = Date.now();
  // 1-hour window aligned to clock hour
  const currentHourStart = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000);
  const nextHourStart = currentHourStart + 60 * 60 * 1000;
  const resetsInMs = Math.max(1000, nextHourStart - now);

  const rateKey = `rate_limit:${sender.toLowerCase()}:${currentHourStart}`;

  // Atomic INCR and EXPIRE using pipeline or multi
  const count = await redis.incr(rateKey);
  if (count === 1) {
    // Expire slightly after the hour window finishes (e.g. 70 minutes)
    await redis.expire(rateKey, 4200);
  }

  if (count > limit) {
    return {
      allowed: false,
      count,
      limit,
      resetsInMs,
    };
  }

  return {
    allowed: true,
    count,
    limit,
    resetsInMs,
  };
}

/**
 * Get current rate limit stats for all senders
 */
export async function getSenderRateStats(
  sender: string,
  limit: number
): Promise<{ count: number; limit: number; resetsInSeconds: number }> {
  const redis = await getRedisConnection();
  const now = Date.now();
  const currentHourStart = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000);
  const nextHourStart = currentHourStart + 60 * 60 * 1000;
  const rateKey = `rate_limit:${sender.toLowerCase()}:${currentHourStart}`;

  const currentVal = await redis.get(rateKey);
  const count = currentVal ? parseInt(currentVal, 10) : 0;
  const resetsInSeconds = Math.max(0, Math.ceil((nextHourStart - now) / 1000));

  return {
    count,
    limit,
    resetsInSeconds,
  };
}
