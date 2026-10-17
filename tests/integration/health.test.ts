import { describe, it, expect, afterAll } from 'vitest';
import { checkSystemHealth } from '../../src/database/health.js';
import { pool } from '../../src/database/pool.js';
import { redis } from '../../src/database/redis.js';

describe('System Health & Services Connectivity Integration (Task 5)', () => {
  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  it('verifies system health returns healthy with pgvector and redis connectivity', async () => {
    const health = await checkSystemHealth();

    expect(health.status).toBe('healthy');
    expect(health.postgres.connected).toBe(true);
    expect(health.postgres.pgvectorVersion).toBeDefined();
    expect(typeof health.postgres.pgvectorVersion).toBe('string');
    expect(health.postgres.latencyMs).toBeGreaterThanOrEqual(0);

    expect(health.redis.connected).toBe(true);
    expect(health.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('successfully computes cosine similarity using pgvector <=> operator', async () => {
    const result = await pool.query<{ similarity: string }>(
      `SELECT 1 - ('[1,0,0]'::vector <=> '[1,0,0]'::vector) AS similarity;`
    );
    expect(result.rows.length).toBe(1);
    expect(parseFloat(result.rows[0].similarity)).toBeCloseTo(1.0, 5);
  });
});
