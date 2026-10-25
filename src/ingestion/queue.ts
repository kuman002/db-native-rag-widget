import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { CdcChangeEvent, createDebounceJobId } from './types.js';

export const cdcQueue = new Queue<CdcChangeEvent>(env.CDC_QUEUE_NAME, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  },
  defaultJobOptions: {
    attempts: env.CDC_MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: false, // Retain failed jobs for Dead Letter Queue inspection
  },
});

/**
 * Enqueues a CDC change event with deterministic debouncing.
 * Successive mutations to the same record within the debounce window
 * reset the timer and replace the queued job with the latest state.
 */
export async function enqueueCdcEvent(event: CdcChangeEvent): Promise<string> {
  const jobId = createDebounceJobId(event);

  try {
    const existingJob = await cdcQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'delayed' || state === 'waiting') {
        await existingJob.remove();
      }
    }

    const job = await cdcQueue.add('cdc-mutation', event, {
      jobId,
      delay: env.CDC_DEBOUNCE_MS,
    });

    return job.id!;
  } catch (err) {
    console.error(`[Queue] Failed to enqueue CDC event for ${jobId}:`, err);
    throw err;
  }
}

/**
 * Cleanly closes the BullMQ queue connection.
 */
export async function closeQueue(): Promise<void> {
  await cdcQueue.close();
}

/**
 * Retrieves current queue counts for monitoring and health checks.
 */
export async function getQueueMetrics(): Promise<{
  waiting: number;
  delayed: number;
  active: number;
  failed: number;
}> {
  const [waiting, delayed, active, failed] = await Promise.all([
    cdcQueue.getWaitingCount(),
    cdcQueue.getDelayedCount(),
    cdcQueue.getActiveCount(),
    cdcQueue.getFailedCount(),
  ]);

  return { waiting, delayed, active, failed };
}
