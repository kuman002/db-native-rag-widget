import { describe, it, expect, afterAll } from 'vitest';
import { pool, db } from '../../src/database/pool.js';
import { whitelistConfigs, products } from '../../src/database/schema.js';
import { eq, and } from 'drizzle-orm';
import { cdcQueue } from '../../src/ingestion/queue.js';
import { CdcListenerService } from '../../src/ingestion/listener.js';
import { WhitelistSanitizationService } from '../../src/privacy/sanitizer.js';

describe('End-to-End Ingestion & Sanitizer Pipeline (Task 5)', () => {
  let listener: CdcListenerService;
  const sanitizer = new WhitelistSanitizationService();
  const testTenantId = 'tenant_pipeline_test';

  afterAll(async () => {
    if (listener && listener.isRunning()) {
      await listener.stop();
    }
    await cdcQueue.close();

    // Clean up test data
    await db
      .delete(products)
      .where(eq(products.tenantId, testTenantId));
    await db
      .delete(whitelistConfigs)
      .where(
        and(
          eq(whitelistConfigs.tenantId, testTenantId),
          eq(whitelistConfigs.tableName, 'products')
        )
      );
  });

  it('captures database row mutations via CDC and executes in-memory privacy sanitization', async () => {
    // 1. Seed Whitelist Config
    await db
      .insert(whitelistConfigs)
      .values({
        tenantId: testTenantId,
        tableName: 'products',
        whitelistedFields: ['name', 'category', 'retailPrice', 'stockStatus'],
        excludedFields: ['supplierCost', 'internalNotes'],
        documentTemplate: 'Product: {{name}} [{{category}}] - ${{retailPrice}} ({{stockStatus}})',
      })
      .onConflictDoUpdate({
        target: [whitelistConfigs.tenantId, whitelistConfigs.tableName],
        set: {
          whitelistedFields: ['name', 'category', 'retailPrice', 'stockStatus'],
          excludedFields: ['supplierCost', 'internalNotes'],
          documentTemplate: 'Product: {{name}} [{{category}}] - ${{retailPrice}} ({{stockStatus}})',
          updatedAt: new Date(),
        },
      });

    // 2. Start CDC Listener
    listener = new CdcListenerService();
    await listener.start();

    // 3. Mutate database table (INSERT with sensitive data)
    const [insertedProduct] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        name: 'Standing Desk',
        category: 'Furniture',
        retailPrice: '399.99',
        stockStatus: 'in_stock',
        supplierCost: '180.00', // SENSITIVE
        internalNotes: 'Vendor contract: CONFIDENTIAL_TIER_A', // SENSITIVE
      })
      .returning();

    expect(insertedProduct.id).toBeDefined();

    // 4. Await CDC Listener job arrival in BullMQ
    const expectedJobId = `${testTenantId}:products:${insertedProduct.id}`;
    let job = null;
    for (let i = 0; i < 25; i++) {
      job = await cdcQueue.getJob(expectedJobId);
      if (job) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(job).not.toBeNull();
    expect(job?.data.operation).toBe('INSERT');
    expect(job?.data.recordId).toBe(insertedProduct.id.toString());

    // 5. Fetch raw record and config for sanitization
    const [fetchedConfig] = await db
      .select()
      .from(whitelistConfigs)
      .where(
        and(
          eq(whitelistConfigs.tenantId, job!.data.tenantId),
          eq(whitelistConfigs.tableName, job!.data.table)
        )
      );
    expect(fetchedConfig).toBeDefined();

    const [fetchedRow] = await db
      .select()
      .from(products)
      .where(eq(products.id, Number(job!.data.recordId)));
    expect(fetchedRow).toBeDefined();

    // 6. Execute Privacy Whitelist Sanitizer
    const sanitizedDoc = sanitizer.sanitize(fetchedRow, fetchedConfig);

    // 7. Verify Privacy Invariants
    expect(sanitizedDoc.sanitizedText).toBe('Product: Standing Desk [Furniture] - $399.99 (in_stock)');
    expect(sanitizedDoc.sanitizedText).not.toContain('180.00');
    expect(sanitizedDoc.sanitizedText).not.toContain('CONFIDENTIAL_TIER_A');

    expect(sanitizedDoc.includedFields).toEqual(
      expect.arrayContaining(['name', 'category', 'retailPrice', 'stockStatus'])
    );
    expect(sanitizedDoc.excludedFields).toEqual(
      expect.arrayContaining(['supplierCost', 'internalNotes'])
    );
    expect(sanitizedDoc.contentHash).toMatch(/^[a-f0-9]{64}$/);

    if (job) {
      await job.remove();
    }
  });
});
