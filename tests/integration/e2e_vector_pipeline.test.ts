import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/database/pool.js';
import { products, whitelistConfigs, documentVectors } from '../../src/database/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { CdcListenerService } from '../../src/ingestion/listener.js';
import { cdcQueue } from '../../src/ingestion/queue.js';
import { VectorWorkerService, VectorRepository, MockEmbeddingProvider } from '../../src/vector/index.js';

describe('End-to-End Vectorization Pipeline (Task 5)', () => {
  const testTenantId = 'tenant_e2e_vector_test';
  let listener: CdcListenerService;
  let workerService: VectorWorkerService;
  const mockProvider = new MockEmbeddingProvider(1536);
  const vectorRepo = new VectorRepository();

  beforeAll(async () => {
    // 1. Clean existing test data
    await db.delete(documentVectors).where(eq(documentVectors.tenantId, testTenantId));
    await db.delete(products).where(eq(products.tenantId, testTenantId));
    await db
      .delete(whitelistConfigs)
      .where(and(eq(whitelistConfigs.tenantId, testTenantId), eq(whitelistConfigs.tableName, 'products')));

    // 2. Configure Whitelist
    await db.insert(whitelistConfigs).values({
      tenantId: testTenantId,
      tableName: 'products',
      whitelistedFields: ['name', 'category', 'retailPrice', 'stockStatus'],
      excludedFields: ['supplierCost', 'internalNotes'],
      documentTemplate: 'Product: {{name}} [{{category}}] - ${{retailPrice}} ({{stockStatus}})',
    });

    // 3. Start CDC Listener
    listener = new CdcListenerService();
    await listener.start();

    // 4. Start Vector Worker
    workerService = new VectorWorkerService({
      embeddingProvider: mockProvider,
      vectorRepository: vectorRepo,
    });
    workerService.start();
  });

  afterAll(async () => {
    if (workerService) {
      await workerService.close();
    }
    if (listener && listener.isRunning()) {
      await listener.stop();
    }
    await cdcQueue.close();

    // Final clean up
    await db.delete(documentVectors).where(eq(documentVectors.tenantId, testTenantId));
    await db.delete(products).where(eq(products.tenantId, testTenantId));
    await db
      .delete(whitelistConfigs)
      .where(and(eq(whitelistConfigs.tenantId, testTenantId), eq(whitelistConfigs.tableName, 'products')));
  });

  it('completes full flow: PostgreSQL Mutation -> CDC pg_notify -> BullMQ -> VectorWorker -> pgvector', async () => {
    // Step 1: Live INSERT into products
    const [inserted] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        name: 'Wireless Ergonomic Mouse',
        category: 'Peripherals',
        retailPrice: '69.99',
        stockStatus: 'in_stock',
        supplierCost: '22.50', // SENSITIVE: MUST BE EXCLUDED
        internalNotes: 'Tier 1 Supplier contract #SECRET99', // SENSITIVE: MUST BE EXCLUDED
      })
      .returning();

    expect(inserted.id).toBeDefined();

    // Poll until BullMQ worker vectorizes the record into document_vectors
    let vectorRecord = null;
    for (let i = 0; i < 40; i++) {
      vectorRecord = await vectorRepo.getVector(testTenantId, 'products', inserted.id.toString());
      if (vectorRecord) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    expect(vectorRecord).not.toBeNull();
    expect(vectorRecord?.content).toBe(
      'Product: Wireless Ergonomic Mouse [Peripherals] - $69.99 (in_stock)'
    );
    expect(vectorRecord?.content).not.toContain('22.50');
    expect(vectorRecord?.content).not.toContain('SECRET99');
    expect(vectorRecord?.embedding).toHaveLength(1536);

    // Step 2: Verify vector similarity search using pgvector cosine operator (<=>)
    const embeddingStr = `[${vectorRecord!.embedding!.join(',')}]`;
    const searchResult = await db.execute(
      sql`SELECT id, content, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
          FROM document_vectors
          WHERE tenant_id = ${testTenantId}
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT 1`
    );

    expect(searchResult.rows.length).toBe(1);
    const topMatch = searchResult.rows[0] as { similarity: string | number; content: string };
    expect(Number(topMatch.similarity)).toBeGreaterThanOrEqual(0.99);

    // Step 3: Live UPDATE on products
    await db
      .update(products)
      .set({
        name: 'Wireless Ergonomic Mouse v2',
        retailPrice: '79.99',
      })
      .where(eq(products.id, inserted.id));

    // Poll until vector record is updated with new content
    let updatedRecord = null;
    for (let i = 0; i < 40; i++) {
      updatedRecord = await vectorRepo.getVector(testTenantId, 'products', inserted.id.toString());
      if (
        updatedRecord &&
        updatedRecord.content.includes('Wireless Ergonomic Mouse v2') &&
        updatedRecord.content.includes('$79.99')
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    expect(updatedRecord?.content).toBe(
      'Product: Wireless Ergonomic Mouse v2 [Peripherals] - $79.99 (in_stock)'
    );

    // Step 4: Live DELETE on products
    await db.delete(products).where(eq(products.id, inserted.id));

    // Poll until vector record is removed from document_vectors
    let deletedRecord = updatedRecord;
    for (let i = 0; i < 40; i++) {
      deletedRecord = await vectorRepo.getVector(testTenantId, 'products', inserted.id.toString());
      if (!deletedRecord) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    expect(deletedRecord).toBeNull();
  });
});
