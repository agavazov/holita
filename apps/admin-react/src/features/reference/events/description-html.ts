import DOMPurify from 'dompurify';

export const descriptionMaxBytes = 100 * 1024;

export function descriptionBytes(value: string | null | undefined): number {
  return new TextEncoder().encode(value ?? '').byteLength;
}

export function isDescriptionLink(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch {
    return false;
  }
}

// The service sanitizes on write; sanitize again at the browser HTML boundary.
export function safeDescriptionHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
