import { createHash } from 'node:crypto';
import type { WhitelistConfig } from '../database/schema.js';

export interface SanitizedDocument {
  sanitizedText: string;
  contentHash: string;
  includedFields: string[];
  excludedFields: string[];
}

const PII_REGEX = /(password|secret|ssn|social_security|credit_card|card_number|cvv|token|auth_key|private_key)/i;

export class WhitelistSanitizationService {
  /**
   * Validates a WhitelistConfig for PII safety and template integrity.
   */
  validateConfig(config: WhitelistConfig): void {
    const fields = Array.isArray(config.whitelistedFields)
      ? (config.whitelistedFields as string[])
      : [];

    // 1. PII Auto-Guard check
    for (const field of fields) {
      if (PII_REGEX.test(field)) {
        throw new Error(`PII Auto-Guard flagged sensitive field: '${field}' cannot be whitelisted.`);
      }
    }

    // 2. Document template integrity check
    if (config.documentTemplate) {
      const templateTokens = this.extractTemplateTokens(config.documentTemplate);
      for (const token of templateTokens) {
        if (!fields.includes(token)) {
          throw new Error(
            `Template references unwhitelisted field: '${token}' is not in whitelistedFields.`
          );
        }
      }
    }
  }

  /**
   * Sanitizes a raw database record in-memory using strict default-deny filtering.
   */
  sanitize(rawRecord: Record<string, any>, config: WhitelistConfig): SanitizedDocument {
    this.validateConfig(config);

    const whitelistedSet = new Set<string>(
      Array.isArray(config.whitelistedFields) ? (config.whitelistedFields as string[]) : []
    );

    const sanitizedData: Record<string, any> = {};
    const includedFields: string[] = [];
    const excludedFields: string[] = [];

    // Enforce default-deny in memory
    for (const [key, value] of Object.entries(rawRecord)) {
      if (whitelistedSet.has(key) && value !== undefined && value !== null) {
        sanitizedData[key] = value;
        includedFields.push(key);
      } else {
        excludedFields.push(key);
      }
    }

    // Render content
    let sanitizedText: string;
    if (config.documentTemplate) {
      sanitizedText = this.renderTemplate(config.documentTemplate, sanitizedData);
    } else {
      sanitizedText = Object.entries(sanitizedData)
        .map(([key, val]) => `${this.formatKey(key)}: ${val}`)
        .join('\n');
    }

    // Deterministic SHA-256 content hash
    const contentHash = createHash('sha256').update(sanitizedText).digest('hex');

    return {
      sanitizedText,
      contentHash,
      includedFields,
      excludedFields,
    };
  }

  private extractTemplateTokens(template: string): string[] {
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map((match) => match.replace(/^\{\{\s*|\s*\}\}$/g, ''));
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
      const trimmedKey = key.trim();
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : '';
    });
  }

  private formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
