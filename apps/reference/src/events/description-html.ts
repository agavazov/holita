import sanitizeHtml from 'sanitize-html';
import { invalid } from '../validation.js';

const maxBytes = 100 * 1024;

/** HTML is an API input, never trusted editor output. */
export function descriptionHtml(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') invalid('descriptionHtml', 'Enter a text description.');
  if (value.includes('\0')) invalid('descriptionHtml', 'Remove unsupported NUL characters.');
  if (Buffer.byteLength(value, 'utf8') > maxBytes)
    invalid('descriptionHtml', 'Keep the description within 100 KiB.');

  const clean = sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
    allowedAttributes: { a: ['href'], ol: ['start'] },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    transformTags: {
      b: 'strong',
      i: 'em',
      a: (_tag, attributes) => {
        const href = attributes.href;
        // Only absolute web links; no credentials, relative links or executable schemes.
        if (href && /^https?:\/\//i.test(href)) {
          try {
            const url = new URL(href);
            if (!url.username && !url.password) return { tagName: 'a', attribs: { href } };
          } catch {
            // Keep the visible text, without a link.
          }
        }
        return { tagName: 'a', attribs: {} };
      },
    },
  }).trim();

  // Entity escaping can expand the saved HTML; it must still fit when edited again.
  if (Buffer.byteLength(clean, 'utf8') > maxBytes)
    invalid('descriptionHtml', 'Keep the formatted description within 100 KiB.');
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} });
  return text.replace(/&nbsp;/g, ' ').trim() ? clean : null;
}
