import { describe, it, expect, afterAll } from 'vitest';
import { pool, db } from '../../src/database/pool.js';
import { runMigrations } from '../../src/database/migrate.js';
import { products } from '../../src/database/schema.js';

describe('Database Schema & Drizzle Migration Integration', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('successfully applies Drizzle migrations and verifies pgvector extension and schemas', async () => {
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

    // 4. Verify unique index on document_vectors
    const indexResult = await pool.query(
      `SELECT indexname FROM pg_indexes 
       WHERE tablename = 'document_vectors' 
       AND indexname = 'uq_tenant_source_record';`
    );
    expect(indexResult.rows.length).toBe(1);

    // 5. Verify Drizzle migrations tracking table exists in drizzle schema
    const drizzleMeta = await pool.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations';`
    );
    expect(drizzleMeta.rows.length).toBe(1);

    // 6. Verify Drizzle typed query execution
    const [newProduct] = await db.insert(products).values({
      tenantId: 'test_tenant',
      name: 'Ergonomic Desk Chair',
      category: 'Furniture',
      retailPrice: '299.99',
      stockStatus: 'in_stock',
    }).returning();

    expect(newProduct.id).toBeDefined();
    expect(newProduct.name).toBe('Ergonomic Desk Chair');

    // Clean up test record
    await pool.query(`DELETE FROM products WHERE id = $1;`, [newProduct.id]);

    // 7. Test migration idempotency: running again should not fail
    await expect(runMigrations()).resolves.not.toThrow();
  });
});
