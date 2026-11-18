/**
 * A random version 4 UUID. Browsers expose `crypto.randomUUID()` only in secure contexts
 * (HTTPS and localhost), so it is missing when the admin is opened as `http://dev.lab:11000`.
 */
export function randomUuid(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte, index) => {
    const value = index === 6 ? (byte & 0x0f) | 0x40 : index === 8 ? (byte & 0x3f) | 0x80 : byte;
    return value.toString(16).padStart(2, '0');
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
