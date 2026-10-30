import { z } from 'zod';

export const cdcChangeEventSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  table: z.string().min(1, 'table is required'),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  recordId: z.string().min(1, 'recordId is required'),
  timestamp: z.string().datetime({ offset: true }).or(z.string().min(1)),
  retryCount: z.number().int().nonnegative().default(0),
});

export const CdcChangeEventSchema = cdcChangeEventSchema;
export type CdcChangeEvent = z.infer<typeof cdcChangeEventSchema>;

export function parseCdcPayload(raw: string | unknown): CdcChangeEvent | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const parsed = CdcChangeEventSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createDebounceJobId(event: {
  tenantId: string;
  table: string;
  recordId: string;
}): string {
  return `debounced__${event.tenantId}__${event.table}__${event.recordId}`;
}
