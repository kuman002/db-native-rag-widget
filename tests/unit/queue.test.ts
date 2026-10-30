import { describe, it, expect, afterAll } from 'vitest';
import { cdcQueue, enqueueChangeEvent } from '../../src/ingestion/queue.js';
import type { CdcChangeEvent } from '../../src/ingestion/types.js';

describe('Ingestion Queue Client (BullMQ)', () => {
  afterAll(async () => {
    await cdcQueue.close();
  });

  it('successfully validates and enqueues a valid CDC change event', async () => {
    const validEvent: CdcChangeEvent = {
      tenantId: 'tenant_test_123',
      table: 'products',
      operation: 'INSERT',
      recordId: '101',
      timestamp: new Date().toISOString(),
    };

    const job = await enqueueChangeEvent(validEvent);

    expect(job).toBeDefined();
    expect(job.id).toBe('tenant_test_123:products:101');
    expect(job.data).toEqual(validEvent);

    // Verify it is in the queue
    const fetchedJob = await cdcQueue.getJob(job.id!);
    expect(fetchedJob).not.toBeNull();
    expect(fetchedJob?.data.recordId).toBe('101');
  });

  it('rejects an invalid event missing mandatory fields', async () => {
    const invalidEvent = {
      tenantId: 'tenant_test_123',
      table: 'products',
      operation: 'INVALID_OP',
      // missing recordId and timestamp
    } as unknown as CdcChangeEvent;

    await expect(enqueueChangeEvent(invalidEvent)).rejects.toThrow();
  });
});
