/**
 * Client-Side XSS Sanitizer and Lightweight Markdown Renderer
 * Zero dependencies, bundle-friendly (< 2KB)
 */

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderSimpleMarkdown(rawText: string): string {
  if (!rawText) return '';

  // 1. First escape all raw HTML to eliminate XSS
  let safe = escapeHtml(rawText);

  // 2. Bold text: **text** -> <strong>text</strong>
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. Inline code: `code` -> <code>code</code>
  safe = safe.replace(/`([^`]+)`/g, '<code class="rag-inline-code">$1</code>');

  // 4. Markdown links: [label](url) -> safe <a> tags
  // Regex handles nested parentheses (e.g. javascript:alert(1) or URLs with query params)
  safe = safe.replace(/\[([^\]]+)\]\(((?:[^()]+|\([^()]*\))*)\)/g, (_match, label, url) => {
    const trimmedUrl = url.trim();
    // Only allow safe protocols to prevent javascript: or data: URIs
    if (/^(https?:\/\/|\/|mailto:)/i.test(trimmedUrl)) {
      return `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer" class="rag-link">${label}</a>`;
    }
    return label;
  });

  // 5. Line breaks: \n -> <br />
  safe = safe.replace(/\n/g, '<br />');

  return safe;
}
