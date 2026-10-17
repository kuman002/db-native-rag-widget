import { pool } from './pool.js';
import { redis } from './redis.js';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  postgres: {
    connected: boolean;
    pgvectorVersion?: string;
    latencyMs: number;
    error?: string;
  };
  redis: {
    connected: boolean;
    latencyMs: number;
    error?: string;
  };
}

export async function checkSystemHealth(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    postgres: { connected: false, latencyMs: -1 },
    redis: { connected: false, latencyMs: -1 },
  };

  // 1. Check PostgreSQL & pgvector extension
  const pgStart = Date.now();
  try {
    const pgRes = await pool.query<{ extversion: string }>(
      `SELECT extversion FROM pg_extension WHERE extname = 'vector';`
    );
    result.postgres.latencyMs = Date.now() - pgStart;
    result.postgres.connected = true;
    if (pgRes.rows.length > 0) {
      result.postgres.pgvectorVersion = pgRes.rows[0].extversion;
    } else {
      result.postgres.error = 'pgvector extension is not installed in database';
      result.status = 'unhealthy';
    }
  } catch (err) {
    result.postgres.latencyMs = Date.now() - pgStart;
    result.postgres.connected = false;
    result.postgres.error = (err as Error).message;
    result.status = 'unhealthy';
  }

  // 2. Check Redis
  const redisStart = Date.now();
  try {
    const pong = await redis.ping();
    result.redis.latencyMs = Date.now() - redisStart;
    result.redis.connected = pong === 'PONG';
    if (!result.redis.connected) {
      result.status = 'unhealthy';
    }
  } catch (err) {
    result.redis.latencyMs = Date.now() - redisStart;
    result.redis.connected = false;
    result.redis.error = (err as Error).message;
    result.status = 'unhealthy';
  }

  return result;
}

// Support CLI execution for manual health check
if (process.argv[1] && process.argv[1].endsWith('health.ts')) {
  checkSystemHealth()
    .then((health) => {
      console.log('System Health Check Result:', JSON.stringify(health, null, 2));
      process.exit(health.status === 'healthy' ? 0 : 1);
    })
    .catch((err) => {
      console.error('Health check script error:', err);
      process.exit(1);
    });
}
