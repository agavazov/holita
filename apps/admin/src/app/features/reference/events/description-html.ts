import DOMPurify from 'dompurify';
export const descriptionMaxBytes = 100 * 1024;
export function descriptionBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
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
// Sanitize pasted/stored HTML at both browser boundaries; the backend independently sanitizes writes.
export function safeDescriptionHtml(value: string): string {
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  for (const node of template.content.querySelectorAll('*')) {
    for (const attribute of Array.from(node.attributes)) {
      if (
        !(
          node.tagName === 'A' &&
          attribute.name === 'href' &&
          isDescriptionLink(attribute.value)
        ) &&
        !(node.tagName === 'OL' && attribute.name === 'start')
      )
        node.removeAttribute(attribute.name);
    }
    if (node.tagName === 'B' || node.tagName === 'I') {
      const replacement = document.createElement(node.tagName === 'B' ? 'strong' : 'em');
      replacement.append(...Array.from(node.childNodes));
      node.replaceWith(replacement);
    }
  }
  return template.innerHTML;
}
