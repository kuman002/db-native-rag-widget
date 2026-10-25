import { z } from 'zod';

export const CdcOperationSchema = z.enum(['INSERT', 'UPDATE', 'DELETE']);
export type CdcOperation = z.infer<typeof CdcOperationSchema>;

export const CdcChangeEventSchema = z.object({
  /** Unique tenant / customer identifier */
  tenantId: z.string().min(1, 'tenantId cannot be empty'),

  /** Database table name (e.g., 'products') */
  table: z.string().min(1, 'table name cannot be empty'),

  /** Mutation type */
  operation: CdcOperationSchema,

  /** Primary key identifier of the mutated record */
  recordId: z.string().min(1, 'recordId cannot be empty'),

  /** ISO-8601 UTC timestamp of mutation */
  timestamp: z.string().min(1, 'timestamp cannot be empty'),

  /** Retry attempt counter */
  retryCount: z.number().int().nonnegative().default(0),
});

export type CdcChangeEvent = z.infer<typeof CdcChangeEventSchema>;

/**
 * Generates a deterministic job ID for BullMQ debouncing.
 * Ensures rapid sequential updates to the same row are collapsed.
 */
export function createDebounceJobId(event: { tenantId: string; table: string; recordId: string }): string {
  return `debounced__${event.tenantId}__${event.table}__${event.recordId}`;
}

/**
 * Safely parses raw notification payloads (JSON string or object)
 * into a strongly typed CdcChangeEvent.
 */
export function parseCdcPayload(raw: unknown): CdcChangeEvent | null {
  try {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      parsed = JSON.parse(raw);
    }
    const result = CdcChangeEventSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('[CDC] Malformed event payload received:', result.error.format());
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('[CDC] Failed to parse JSON notification payload:', err);
    return null;
  }
}
