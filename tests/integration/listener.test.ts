import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../../src/database/pool.js';
import { cdcQueue } from '../../src/ingestion/queue.js';
import { CdcListenerService } from '../../src/ingestion/listener.js';

describe('CDC Notification Listener Service (Task 3)', () => {
  let listener: CdcListenerService;

  afterAll(async () => {
    if (listener && listener.isRunning()) {
      await listener.stop();
    }
    await cdcQueue.close();
  });

  it('listens on rag_cdc_channel and enqueues mutations directly into BullMQ', async () => {
    listener = new CdcListenerService();
    await listener.start();
    expect(listener.isRunning()).toBe(true);

    const tenantId = 'tenant_listener_test';
    const insertRes = await pool.query(
      `INSERT INTO products (tenant_id, name, category, retail_price)
       VALUES ($1, 'Wireless Keyboard', 'Electronics', 59.99)
       RETURNING id;`,
      [tenantId]
    );
    const productId = insertRes.rows[0].id.toString();

    // Poll BullMQ briefly for the enqueued job
    const expectedJobId = `${tenantId}:products:${productId}`;
    let job = null;
    for (let i = 0; i < 20; i++) {
      job = await cdcQueue.getJob(expectedJobId);
      if (job) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(job).not.toBeNull();
    expect(job?.data).toMatchObject({
      tenantId,
      table: 'products',
      operation: 'INSERT',
      recordId: productId,
    });

    // Clean up inserted product and queue job
    await pool.query('DELETE FROM products WHERE id = $1;', [productId]);
    if (job) {
      await job.remove();
    }

    await listener.stop();
    expect(listener.isRunning()).toBe(false);
  });
});

