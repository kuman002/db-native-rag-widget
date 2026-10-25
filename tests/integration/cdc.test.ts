import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, db } from '../../src/database/pool.js';
import { products } from '../../src/database/schema.js';
import { eq } from 'drizzle-orm';
import { CdcListenerService } from '../../src/ingestion/listener.js';
import { cdcQueue, closeQueue, enqueueCdcEvent } from '../../src/ingestion/queue.js';
import { CdcChangeEvent, createDebounceJobId } from '../../src/ingestion/types.js';

describe('CDC Pipeline Integration (Triggers -> pg_notify -> Listener -> BullMQ Queue)', () => {
  let listener: CdcListenerService;

  beforeAll(async () => {
    // Clean any residual test jobs from the queue
    await cdcQueue.drain();
    await cdcQueue.clean(0, 0, 'delayed');
    await cdcQueue.clean(0, 0, 'completed');
    await cdcQueue.clean(0, 0, 'failed');

    listener = new CdcListenerService();
    await listener.start();
    // Allow listener connection to establish
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  afterAll(async () => {
    await listener.stop();
    await closeQueue();
    await pool.end();
  });

  it('captures INSERT on products table and enqueues debounced job in BullMQ', async () => {
    const receivedEvents: CdcChangeEvent[] = [];
    const unsubscribe = listener.onEvent((event) => {
      receivedEvents.push(event);
    });

    // 1. Insert product
    const [inserted] = await db
      .insert(products)
      .values({
        tenantId: 'tenant_cdc_test',
        name: 'Wireless Noise-Canceling Headphones',
        category: 'Audio',
        retailPrice: '199.99',
        stockStatus: 'in_stock',
      })
      .returning();

    expect(inserted.id).toBeDefined();

    // 2. Wait for async pg_notify delivery
    await new Promise((resolve) => setTimeout(resolve, 350));
    unsubscribe();

    // 3. Verify event captured by listener
    const insertEvent = receivedEvents.find(
      (e) => e.recordId === String(inserted.id) && e.operation === 'INSERT'
    );
    expect(insertEvent).toBeDefined();
    expect(insertEvent?.table).toBe('products');
    expect(insertEvent?.tenantId).toBe('tenant_cdc_test');

    // 4. Verify job in BullMQ queue
    const expectedJobId = createDebounceJobId({
      tenantId: 'tenant_cdc_test',
      table: 'products',
      recordId: String(inserted.id),
    });

    const job = await cdcQueue.getJob(expectedJobId);
    expect(job).not.toBeNull();
    expect(job?.data.operation).toBe('INSERT');
    expect(job?.data.recordId).toBe(String(inserted.id));

    // Cleanup
    await db.delete(products).where(eq(products.id, inserted.id));
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  it('captures UPDATE on products table and updates BullMQ queue payload', async () => {
    // 1. Create a baseline product
    const [item] = await db
      .insert(products)
      .values({
        tenantId: 'tenant_cdc_test',
        name: 'Mechanical Keyboard',
        retailPrice: '89.99',
      })
      .returning();

    await new Promise((resolve) => setTimeout(resolve, 200));

    const receivedEvents: CdcChangeEvent[] = [];
    const unsubscribe = listener.onEvent((event) => {
      receivedEvents.push(event);
    });

    // 2. Mutate price
    await db
      .update(products)
      .set({ retailPrice: '79.99', stockStatus: 'low_stock' })
      .where(eq(products.id, item.id));

    await new Promise((resolve) => setTimeout(resolve, 350));
    unsubscribe();

    // 3. Verify UPDATE notification received
    const updateEvent = receivedEvents.find(
      (e) => e.recordId === String(item.id) && e.operation === 'UPDATE'
    );
    expect(updateEvent).toBeDefined();
    expect(updateEvent?.operation).toBe('UPDATE');

    // 4. Verify updated BullMQ job
    const jobId = createDebounceJobId({
      tenantId: 'tenant_cdc_test',
      table: 'products',
      recordId: String(item.id),
    });

    const job = await cdcQueue.getJob(jobId);
    expect(job).not.toBeNull();
    expect(job?.data.operation).toBe('UPDATE');

    // Cleanup
    await db.delete(products).where(eq(products.id, item.id));
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  it('captures DELETE on products table and queues DELETE event with old record ID', async () => {
    // 1. Create product to be deleted
    const [item] = await db
      .insert(products)
      .values({
        tenantId: 'tenant_cdc_test',
        name: 'Temporary Item',
        retailPrice: '10.00',
      })
      .returning();

    await new Promise((resolve) => setTimeout(resolve, 200));

    const receivedEvents: CdcChangeEvent[] = [];
    const unsubscribe = listener.onEvent((event) => {
      receivedEvents.push(event);
    });

    // 2. Delete item
    await db.delete(products).where(eq(products.id, item.id));

    await new Promise((resolve) => setTimeout(resolve, 350));
    unsubscribe();

    // 3. Verify DELETE notification received
    const deleteEvent = receivedEvents.find(
      (e) => e.recordId === String(item.id) && e.operation === 'DELETE'
    );
    expect(deleteEvent).toBeDefined();
    expect(deleteEvent?.operation).toBe('DELETE');
    expect(deleteEvent?.recordId).toBe(String(item.id));
  });

  it('debounces rapid sequential mutations into a single consolidated queue job', async () => {
    const [rapidItem] = await db
      .insert(products)
      .values({
        tenantId: 'tenant_debounce',
        name: 'Debounce Subject',
        retailPrice: '50.00',
      })
      .returning();

    const jobId = createDebounceJobId({
      tenantId: 'tenant_debounce',
      table: 'products',
      recordId: String(rapidItem.id),
    });

    // Wait for initial insert notification to settle
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Rapidly execute 4 consecutive price updates within 150ms
    await Promise.all([
      db.update(products).set({ retailPrice: '51.00' }).where(eq(products.id, rapidItem.id)),
      db.update(products).set({ retailPrice: '52.00' }).where(eq(products.id, rapidItem.id)),
      db.update(products).set({ retailPrice: '53.00' }).where(eq(products.id, rapidItem.id)),
      db.update(products).set({ retailPrice: '54.00' }).where(eq(products.id, rapidItem.id)),
    ]);

    // Wait for debouncing window
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verify there is only 1 job for this record ID in the BullMQ queue
    const delayedJobs = await cdcQueue.getJobs(['delayed', 'waiting']);
    const jobsForRecord = delayedJobs.filter((j) => j.id === jobId);

    expect(jobsForRecord.length).toBe(1);
    expect(jobsForRecord[0].data.operation).toBe('UPDATE');

    // Cleanup
    await db.delete(products).where(eq(products.id, rapidItem.id));
  });
});
