import { describe, it, expect } from 'vitest';
import {
  CdcChangeEventSchema,
  parseCdcPayload,
  createDebounceJobId,
} from '../../src/ingestion/types.js';

describe('CDC Event Types & Payload Parsing (src/ingestion/types.ts)', () => {
  const validEvent = {
    tenantId: 'tenant_123',
    table: 'products',
    operation: 'UPDATE',
    recordId: '101',
    timestamp: '2026-10-24T14:30:00.000Z',
  };

  it('validates a correct CDC payload object', () => {
    const result = CdcChangeEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tenantId).toBe('tenant_123');
      expect(result.data.operation).toBe('UPDATE');
      expect(result.data.retryCount).toBe(0); // Default
    }
  });

  it('parses a valid JSON string notification payload', () => {
    const rawJson = JSON.stringify(validEvent);
    const parsed = parseCdcPayload(rawJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.recordId).toBe('101');
    expect(parsed?.table).toBe('products');
  });

  it('returns null when given malformed JSON string', () => {
    const malformed = '{"tenantId": "123", invalid-json';
    const parsed = parseCdcPayload(malformed);
    expect(parsed).toBeNull();
  });

  it('returns null when mandatory fields are missing', () => {
    const missingRecordId = {
      tenantId: 'tenant_123',
      table: 'products',
      operation: 'INSERT',
      // recordId missing
      timestamp: '2026-10-24T14:30:00.000Z',
    };
    const parsed = parseCdcPayload(missingRecordId);
    expect(parsed).toBeNull();
  });

  it('rejects unsupported mutation operations', () => {
    const invalidOp = {
      ...validEvent,
      operation: 'TRUNCATE',
    };
    const parsed = parseCdcPayload(invalidOp);
    expect(parsed).toBeNull();
  });

  it('generates consistent deterministic debounce job IDs', () => {
    const jobId1 = createDebounceJobId({
      tenantId: 'tenant_abc',
      table: 'products',
      recordId: '42',
    });
    const jobId2 = createDebounceJobId({
      tenantId: 'tenant_abc',
      table: 'products',
      recordId: '42',
    });
    const differentJobId = createDebounceJobId({
      tenantId: 'tenant_abc',
      table: 'products',
      recordId: '43',
    });

    expect(jobId1).toBe('debounced__tenant_abc__products__42');
    expect(jobId1).toBe(jobId2);
    expect(jobId1).not.toBe(differentJobId);
  });
});
