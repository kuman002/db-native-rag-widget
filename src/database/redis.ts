import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: false,
});

redis.on('error', (err) => {
  console.error('[Redis] Client error:', err);
});

redis.on('connect', () => {
  if (env.NODE_ENV !== 'test') {
    console.log(`[Redis] Connected to redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);
  }
});
