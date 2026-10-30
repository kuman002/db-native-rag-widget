import { describe, it, expect, afterAll } from 'vitest';
import { VectorRepository } from '../../src/vector/repository.js';
import { pool } from '../../src/database/pool.js';

describe('Document Vectors Repository (Task 2)', () => {
  const repo = new VectorRepository();
  const testTenant = 'tenant_repo_test';
  const testTable = 'products';
  const testId = 'prod_888';

  afterAll(async () => {
    await repo.deleteVector(testTenant, testTable, testId);
  });

  it('inserts and retrieves a document vector', async () => {
    // Clean before start
    await repo.deleteVector(testTenant, testTable, testId);

    const initialEmbedding = new Array(1536).fill(0.05);

    await repo.upsertVector({
      tenantId: testTenant,
      sourceTable: testTable,
      sourceId: testId,
      content: 'Standing Desk with Dual Motors',
      contentHash: 'hash_v1_abc',
      embedding: initialEmbedding,
      metadata: { category: 'Furniture' },
    });

    const hash = await repo.getContentHash(testTenant, testTable, testId);
    expect(hash).toBe('hash_v1_abc');

    const vector = await repo.getVector(testTenant, testTable, testId);
    expect(vector).not.toBeNull();
    expect(vector?.content).toBe('Standing Desk with Dual Motors');
    expect(vector?.contentHash).toBe('hash_v1_abc');
    expect(vector?.metadata).toEqual({ category: 'Furniture' });
  });

  it('updates the vector record in-place on conflict', async () => {
    const updatedEmbedding = new Array(1536).fill(0.12);

    await repo.upsertVector({
      tenantId: testTenant,
      sourceTable: testTable,
      sourceId: testId,
      content: 'Standing Desk with Triple Motors (Updated)',
      contentHash: 'hash_v2_def',
      embedding: updatedEmbedding,
      metadata: { category: 'Furniture', version: 2 },
    });

    const hash = await repo.getContentHash(testTenant, testTable, testId);
    expect(hash).toBe('hash_v2_def');

    const vector = await repo.getVector(testTenant, testTable, testId);
    expect(vector?.content).toBe('Standing Desk with Triple Motors (Updated)');
    expect(vector?.metadata).toEqual({ category: 'Furniture', version: 2 });

    // Verify there is only one row in the table for this record (no duplicates)
    const countRes = await pool.query(
      `SELECT count(*) FROM document_vectors WHERE tenant_id = $1 AND source_table = $2 AND source_id = $3;`,
      [testTenant, testTable, testId]
    );
    expect(Number(countRes.rows[0].count)).toBe(1);
  });

  it('deletes the vector record and returns null on subsequent lookup', async () => {
    const deleted = await repo.deleteVector(testTenant, testTable, testId);
    expect(deleted).toBe(true);

    const vector = await repo.getVector(testTenant, testTable, testId);
    expect(vector).toBeNull();

    const hash = await repo.getContentHash(testTenant, testTable, testId);
    expect(hash).toBeNull();
  });
});

