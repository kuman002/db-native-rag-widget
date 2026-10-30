import { describe, it, expect } from 'vitest';
import { WhitelistSanitizationService } from '../../src/privacy/sanitizer.js';
import type { WhitelistConfig } from '../../src/database/schema.js';

describe('Privacy & Whitelist Sanitization Service (Task 4)', () => {
  const service = new WhitelistSanitizationService();

  const baseConfig: WhitelistConfig = {
    tenantId: 'tenant_enterprise_402',
    tableName: 'products',
    whitelistedFields: ['name', 'description', 'category', 'retail_price', 'stock_status'],
    excludedFields: ['supplier_cost', 'internal_notes'],
    documentTemplate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('enforces default-deny by stripping all non-whitelisted fields in-memory', () => {
    const rawRow = {
      id: 101,
      tenant_id: 'tenant_enterprise_402',
      name: 'Ergonomic Desk Chair',
      description: 'High-comfort office chair with lumbar support',
      category: 'Furniture',
      retail_price: '299.99',
      stock_status: 'in_stock',
      supplier_cost: '110.00', // SENSITIVE
      internal_notes: 'Vendor discount code: SECRET_50', // SENSITIVE
      extra_unlisted_column: 'confidential_metric', // UNLISTED
    };

    const result = service.sanitize(rawRow, baseConfig);

    expect(result.sanitizedText).toContain('Name: Ergonomic Desk Chair');
    expect(result.sanitizedText).toContain('Category: Furniture');
    expect(result.sanitizedText).toContain('Retail Price: 299.99');

    // Never contain sensitive or unlisted values
    expect(result.sanitizedText).not.toContain('110.00');
    expect(result.sanitizedText).not.toContain('SECRET_50');
    expect(result.sanitizedText).not.toContain('confidential_metric');

    // Field auditing
    expect(result.includedFields).toEqual(
      expect.arrayContaining(['name', 'description', 'category', 'retail_price', 'stock_status'])
    );
    expect(result.excludedFields).toEqual(
      expect.arrayContaining(['supplier_cost', 'internal_notes', 'extra_unlisted_column', 'id', 'tenant_id'])
    );
  });

  it('interpolates sanitized fields correctly with documentTemplate', () => {
    const templateConfig: WhitelistConfig = {
      ...baseConfig,
      whitelistedFields: ['name', 'category', 'retail_price'],
      documentTemplate: 'Product: {{name}} | Category: {{category}} | Price: ${{retail_price}}',
    };

    const rawRow = {
      name: 'Mechanical Keyboard',
      category: 'Electronics',
      retail_price: '129.99',
      supplier_cost: '45.00',
    };

    const result = service.sanitize(rawRow, templateConfig);

    expect(result.sanitizedText).toBe('Product: Mechanical Keyboard | Category: Electronics | Price: $129.99');
    expect(result.sanitizedText).not.toContain('45.00');
  });

  it('rejects documentTemplate that references non-whitelisted or sensitive fields', () => {
    const invalidTemplateConfig: WhitelistConfig = {
      ...baseConfig,
      whitelistedFields: ['name', 'retail_price'],
      documentTemplate: 'Product: {{name}} | Cost: ${{supplier_cost}}',
    };

    expect(() => service.validateConfig(invalidTemplateConfig)).toThrow(
      /Template references unwhitelisted field: 'supplier_cost'/
    );
  });

  it('PII Auto-Guard rejects whitelisting columns with sensitive names', () => {
    const dangerousConfig: WhitelistConfig = {
      ...baseConfig,
      whitelistedFields: ['name', 'customer_password_hash', 'user_ssn'],
    };

    expect(() => service.validateConfig(dangerousConfig)).toThrow(
      /PII Auto-Guard flagged sensitive field/
    );
  });

  it('generates deterministic SHA-256 content hashes for deduplication', () => {
    const rawRowA = {
      name: 'Monitor Stand',
      category: 'Accessories',
      retail_price: '49.99',
      updated_at: '2026-10-30T10:00:00Z', // Ignored column
    };

    const rawRowB = {
      name: 'Monitor Stand',
      category: 'Accessories',
      retail_price: '49.99',
      updated_at: '2026-10-30T11:00:00Z', // Updated timestamp, but sanitized content identical!
    };

    const resultA = service.sanitize(rawRowA, baseConfig);
    const resultB = service.sanitize(rawRowB, baseConfig);

    expect(resultA.contentHash).toBe(resultB.contentHash);
    expect(resultA.contentHash).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hex
  });
});
