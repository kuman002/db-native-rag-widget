import { describe, it, expect } from 'vitest';
import {
  formatDatabaseContext,
  buildSystemPrompt,
  FALLBACK_RESPONSE,
} from '../../src/query/prompt.js';
import type { RetrievedChunk } from '../../src/query/types.js';

describe('Prompt Engineering & Guardrails (Task 2)', () => {
  it('formats retrieved chunks into structured context', () => {
    const chunks: RetrievedChunk[] = [
      {
        id: '1',
        sourceTable: 'products',
        sourceId: 'prod_101',
        content: 'Name: Ergonomic Desk Chair\nPrice: $299.99\nStock: In stock (42 units)',
        similarity: 0.88,
      },
      {
        id: '2',
        sourceTable: 'shipping_policy',
        sourceId: 'shp_01',
        content: 'Standard Shipping: Free for orders over $50.',
        similarity: 0.79,
      },
    ];

    const formatted = formatDatabaseContext(chunks);
    expect(formatted).toContain('--- Record 1 [Type: products] ---');
    expect(formatted).toContain('Name: Ergonomic Desk Chair');
    expect(formatted).toContain('--- Record 2 [Type: shipping_policy] ---');
    expect(formatted).toContain('Standard Shipping: Free for orders over $50.');
  });

  it('handles empty chunks gracefully', () => {
    const formatted = formatDatabaseContext([]);
    expect(formatted).toBe('NO VERIFIED DATABASE RECORDS AVAILABLE.');
  });

  it('buildSystemPrompt injects context and critical anti-hallucination rules', () => {
    const context = 'Product: Solar Backpack';
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain('VERIFIED DATABASE CONTEXT:');
    expect(prompt).toContain('Product: Solar Backpack');
    expect(prompt).toContain(FALLBACK_RESPONSE);
    expect(prompt).toContain('Never mention internal database IDs');
  });
});

