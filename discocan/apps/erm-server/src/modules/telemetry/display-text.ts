export function displayText(value: Uint8Array): string {
  let text = '';
  for (const byte of value) {
    text +=
      byte < 0x20 || (byte >= 0x7f && byte <= 0x9f)
        ? `\\x${byte.toString(16).padStart(2, '0')}`
        : String.fromCharCode(byte);
  }
  return text;
}
