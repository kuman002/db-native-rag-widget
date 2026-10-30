import { describe, it, expect } from 'vitest';
import { escapeHtml, renderSimpleMarkdown } from '../../src/widget/sanitizer.js';

describe('Widget Sanitizer & Lightweight Markdown (Task 1)', () => {
  it('escapes dangerous HTML characters', () => {
    const malicious = '<script>alert("xss")</script>&"\'';
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#039;');
    expect(escaped).not.toContain('<script>');
  });

  it('renders bold and inline code safely', () => {
    const markdown = 'This is **bold** and `code` syntax.';
    const html = renderSimpleMarkdown(markdown);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code class="rag-inline-code">code</code>');
  });

  it('renders safe HTTP and HTTPS markdown links', () => {
    const markdown = 'Visit our [Documentation](https://docs.example.com) for details.';
    const html = renderSimpleMarkdown(markdown);
    expect(html).toContain('<a href="https://docs.example.com" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('Documentation</a>');
  });

  it('neutralizes malicious javascript: URI links', () => {
    const evilMarkdown = '[Click here](javascript:alert(1))';
    const html = renderSimpleMarkdown(evilMarkdown);
    expect(html).not.toContain('<a href="javascript');
    expect(html).toBe('Click here');
  });
});

