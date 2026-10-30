import { z } from 'zod';

export const cdcChangeEventSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  table: z.string().min(1, 'table is required'),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  recordId: z.string().min(1, 'recordId is required'),
  timestamp: z.string().datetime({ offset: true }).or(z.string().min(1)),
  retryCount: z.number().int().nonnegative().optional(),
});

export type CdcChangeEvent = z.infer<typeof cdcChangeEventSchema>;

