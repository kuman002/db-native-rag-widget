import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../src/database/pool.js';
import { products, whitelistConfigs, documentVectors } from '../../src/database/schema.js';
import { eq, and } from 'drizzle-orm';
import { VectorWorkerService } from '../../src/vector/worker.js';
import { MockEmbeddingProvider } from '../../src/vector/provider.js';
import { VectorRepository } from '../../src/vector/repository.js';
import { cdcQueue } from '../../src/ingestion/queue.js';

describe('VectorWorkerService Integration (Task 3)', () => {
  const testTenantId = 'tenant_worker_test';
  let workerService: VectorWorkerService;
  let mockProvider: MockEmbeddingProvider;
  let vectorRepo: VectorRepository;

  beforeAll(async () => {
    mockProvider = new MockEmbeddingProvider(1536);
    vectorRepo = new VectorRepository();
    workerService = new VectorWorkerService({
      embeddingProvider: mockProvider,
      vectorRepository: vectorRepo,
    });
    workerService.start();

    // Whitelist config: whitelists name, category, retailPrice
    await db
      .insert(whitelistConfigs)
      .values({
        tenantId: testTenantId,
        tableName: 'products',
        whitelistedFields: ['name', 'category', 'retailPrice'],
        excludedFields: ['supplierCost', 'internalNotes'],
        documentTemplate: 'Product: {{name}} [{{category}}] costs ${{retailPrice}}',
      })
      .onConflictDoUpdate({
        target: [whitelistConfigs.tenantId, whitelistConfigs.tableName],
        set: {
          whitelistedFields: ['name', 'category', 'retailPrice'],
          excludedFields: ['supplierCost', 'internalNotes'],
          documentTemplate: 'Product: {{name}} [{{category}}] costs ${{retailPrice}}',
          updatedAt: new Date(),
        },
      });
  });

  afterAll(async () => {
    await workerService.close();
    await cdcQueue.close();

    // Clean up
    await db.delete(documentVectors).where(eq(documentVectors.tenantId, testTenantId));
    await db.delete(products).where(eq(products.tenantId, testTenantId));
    await db
      .delete(whitelistConfigs)
      .where(and(eq(whitelistConfigs.tenantId, testTenantId), eq(whitelistConfigs.tableName, 'products')));
  });

  it('processes an INSERT event: sanitizes, embeds, and saves to document_vectors', async () => {
    const [inserted] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        name: 'Ergonomic Keyboard',
        category: 'Electronics',
        retailPrice: '149.99',
        supplierCost: '45.00',
        internalNotes: 'SECRET_CODE_KEY',
      })
      .returning();

    const result = await workerService.processChange({
      tenantId: testTenantId,
      table: 'products',
      operation: 'INSERT',
      recordId: inserted.id.toString(),
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe('vectorized');

    // Verify stored vector in DB
    const saved = await vectorRepo.getVector(testTenantId, 'products', inserted.id.toString());
    expect(saved).not.toBeNull();
    expect(saved?.content).toBe('Product: Ergonomic Keyboard [Electronics] costs $149.99');
    expect(saved?.content).not.toContain('45.00');
    expect(saved?.content).not.toContain('SECRET_CODE_KEY');
    expect(saved?.contentHash).toBeDefined();
    expect(saved?.embedding).toHaveLength(1536);
  });

  it('processes a DELETE event: removes vector from document_vectors', async () => {
    const [inserted] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        name: 'Trackball Mouse',
        category: 'Electronics',
        retailPrice: '79.99',
      })
      .returning();

    // First vectorize
    await workerService.processChange({
      tenantId: testTenantId,
      table: 'products',
      operation: 'INSERT',
      recordId: inserted.id.toString(),
      timestamp: new Date().toISOString(),
    });

    const beforeDelete = await vectorRepo.getVector(testTenantId, 'products', inserted.id.toString());
    expect(beforeDelete).not.toBeNull();

    // Now delete
    const result = await workerService.processChange({
      tenantId: testTenantId,
      table: 'products',
      operation: 'DELETE',
      recordId: inserted.id.toString(),
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe('deleted');

    const afterDelete = await vectorRepo.getVector(testTenantId, 'products', inserted.id.toString());
    expect(afterDelete).toBeNull();
  });

  it('skips processing if no whitelist configuration exists for the table', async () => {
    const result = await workerService.processChange({
      tenantId: 'unconfigured_tenant',
      table: 'unknown_table',
      operation: 'INSERT',
      recordId: '9999',
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe('skipped_no_whitelist');
  });

  it('skips embedding and vector generation when contentHash is unchanged on UPDATE', async () => {
    // 1. Insert product
    const [inserted] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        name: 'Noise Cancelling Headphones',
        category: 'Audio',
        retailPrice: '299.00',
        supplierCost: '110.00',
        internalNotes: 'Batch #41',
      })
      .returning();

    // 2. Initial insert processing
    const initialResult = await workerService.processChange({
      tenantId: testTenantId,
      table: 'products',
      operation: 'INSERT',
      recordId: inserted.id.toString(),
      timestamp: new Date().toISOString(),
    });
    expect(initialResult.status).toBe('vectorized');

    // 3. Spy on embedding generator
    const embeddingSpy = vi.spyOn(mockProvider, 'generateEmbedding');

    // 4. Update an unwhitelisted/excluded field (supplierCost & internalNotes)
    await db
      .update(products)
      .set({
        supplierCost: '95.00',
        internalNotes: 'Batch #41 (renegotiated discount)',
      })
      .where(eq(products.id, inserted.id));

    // 5. Process UPDATE event
    const updateResult1 = await workerService.processChange({
      tenantId: testTenantId,
      table: 'products',
      operation: 'UPDATE',
      recordId: inserted.id.toString(),
      timestamp: new Date().toISOString(),
    });

    // Content hasn't changed because whitelisted fields are unchanged
    expect(updateResult1.status).toBe('skipped_unchanged');
    expect(embeddingSpy).toHaveBeenCalledTimes(0);

    // 6. Update a whitelisted field (name)
    await db
      .update(products)
      .set({
        name: 'Noise Cancelling Headphones Pro',
      })
      .where(eq(products.id, inserted.id));

    // 7. Process UPDATE event
    const updateResult2 = await workerService.processChange({
      tenantId: testTenantId,
      table: 'products',
      operation: 'UPDATE',
      recordId: inserted.id.toString(),
      timestamp: new Date().toISOString(),
    });

    expect(updateResult2.status).toBe('vectorized');
    expect(embeddingSpy).toHaveBeenCalledTimes(1);

    embeddingSpy.mockRestore();
  });
});
