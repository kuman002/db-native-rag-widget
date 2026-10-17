import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../../src/database/pool.js';
import { runMigrations } from '../../src/database/migrate.js';

describe('Database Schema & Migration Engine Integration (Task 4)', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('successfully applies migrations and verifies pgvector extension and schemas', async () => {
    // 1. Run migrations
    await runMigrations();

    // 2. Verify pgvector extension is installed
    const extResult = await pool.query(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`
    );
    expect(extResult.rows.length).toBe(1);
    expect(extResult.rows[0].extname).toBe('vector');

    // 3. Verify tables exist
    const tablesResult = await pool.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name IN ('document_vectors', 'whitelist_configs', 'products');`
    );
    const tableNames = tablesResult.rows.map((r) => r.table_name);
    expect(tableNames).toContain('document_vectors');
    expect(tableNames).toContain('whitelist_configs');
    expect(tableNames).toContain('products');

    // 4. Verify unique constraint on document_vectors
    const constraintResult = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'uq_tenant_source_record';`
    );
    expect(constraintResult.rows.length).toBe(1);

    // 5. Test migration idempotency: running again should not fail
    await expect(runMigrations()).resolves.not.toThrow();
  });
});
