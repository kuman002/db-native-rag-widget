import { Queue, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { cdcChangeEventSchema, type CdcChangeEvent } from './types.js';

export const QUEUE_NAME = 'rag_cdc_events';

export const cdcQueue = new Queue<CdcChangeEvent>(QUEUE_NAME, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function enqueueChangeEvent(rawEvent: CdcChangeEvent): Promise<Job<CdcChangeEvent>> {
  const event = cdcChangeEventSchema.parse(rawEvent);

  const jobId = `${event.tenantId}:${event.table}:${event.recordId}`;

  // If a job already exists with this ID, attempt to remove it so subsequent mutations update with the latest state
  const existingJob = await cdcQueue.getJob(jobId);
  if (existingJob) {
    try {
      await existingJob.remove();
    } catch {
      // Ignore if job is currently active/locked by an active worker
    }
  }

  return await cdcQueue.add(event.operation, event, {
    jobId,
  });
}

export async function closeQueue(): Promise<void> {
  await cdcQueue.close();
}

export async function enqueueCdcEvent(event: CdcChangeEvent): Promise<string> {
  const job = await enqueueChangeEvent(event);
  return job.id!;
}


