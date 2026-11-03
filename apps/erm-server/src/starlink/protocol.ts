export type ChecksumState = 'ok' | 'mismatch' | 'absent';

export interface ParsedFrame {
  header: string;
  origin: 'SLU' | 'SRV';
  unitId: string;
  command: string;
  reference: string;
  fields: Buffer[];
  checksum: ChecksumState;
}

const envelope = /^([^,]{0,8}?)(SLU|SRV)([0-9A-Fa-f]{6}|\d{15}),(\d{2,3}),(\d{1,9})(?=[,*]|$)/;
const escapedBytes = new Map([
  [0x10, 0x10],
  [0x01, 0x0d],
  [0x02, 0x0a],
  [0x03, 0x00],
  [0x04, 0x11],
  [0x05, 0x13],
]);
const binaryEscapes = new Map([...escapedBytes].map(([encoded, decoded]) => [decoded, encoded]));

export function unescape(raw: Buffer): Buffer {
  const decoded = Buffer.alloc(raw.length);
  let length = 0;
  for (let index = 0; index < raw.length; index++) {
    const byte = raw.readUInt8(index);
    const next = index + 1 < raw.length ? raw.readUInt8(index + 1) : undefined;
    const replacement = byte === 0x10 && next !== undefined ? escapedBytes.get(next) : undefined;
    if (replacement !== undefined) {
      decoded[length++] = replacement;
      index++;
    } else if ((byte === 0x24 || byte === 0x2a) && next === byte) {
      decoded[length++] = byte;
      index++;
    } else {
      decoded[length++] = byte;
    }
  }
  return decoded.subarray(0, length);
}

function checksum(body: Buffer): string {
  let sum = 0;
  for (const byte of body) {
    sum += byte;
  }
  return (sum % 256).toString(16).toUpperCase().padStart(2, '0');
}

function checksumSeparator(raw: Buffer, start: number): number {
  for (let index = start; index < raw.length; index++) {
    const byte = raw.readUInt8(index);
    const next = index + 1 < raw.length ? raw.readUInt8(index + 1) : undefined;
    if (
      (byte === 0x10 && next !== undefined && escapedBytes.has(next)) ||
      ((byte === 0x24 || byte === 0x2a) && next === byte)
    ) {
      index++;
    } else if (byte === 0x2a) {
      return index;
    }
  }
  return -1;
}

export function parseFrame(raw: Buffer): ParsedFrame | undefined {
  const match = envelope.exec(raw.toString('latin1'));
  if (match === null) {
    return undefined;
  }
  const [prefix, header, origin, unitId, command, reference] = match;
  if (
    header === undefined ||
    (origin !== 'SLU' && origin !== 'SRV') ||
    unitId === undefined ||
    command === undefined ||
    reference === undefined
  ) {
    return undefined;
  }
  const separator = checksumSeparator(raw, header.length);
  const body = unescape(raw.subarray(header.length, separator < 0 ? raw.length : separator));
  const supplied =
    separator < 0 ? '' : raw.subarray(separator + 1, separator + 3).toString('latin1');
  const state: ChecksumState = /^[0-9A-F]{2}$/.test(supplied)
    ? checksum(body) === supplied
      ? 'ok'
      : 'mismatch'
    : 'absent';
  const prefixLength = prefix.length - header.length;
  const fields =
    body.length > prefixLength
      ? body
          .subarray(prefixLength + 1)
          .toString('latin1')
          .split(',')
          .map((field) => Buffer.from(field, 'latin1'))
      : [];
  return { header, origin, unitId, command, reference, fields, checksum: state };
}

export function buildServerFrame(
  unitId: string,
  command: string,
  reference: string,
  fields: readonly (string | Buffer)[] = [],
): Buffer {
  const parts: Buffer[] = [Buffer.from(`SRV${unitId},${command},${reference}`, 'latin1')];
  for (const field of fields) {
    parts.push(Buffer.from(','), typeof field === 'string' ? Buffer.from(field, 'latin1') : field);
  }
  const body = Buffer.concat(parts);
  const encoded: number[] = [];
  for (const byte of body) {
    const replacement = binaryEscapes.get(byte);
    if (replacement !== undefined) {
      encoded.push(0x10, replacement);
    } else if (byte === 0x24 || byte === 0x2a) {
      encoded.push(byte, byte);
    } else {
      encoded.push(byte);
    }
  }
  return Buffer.concat([
    Buffer.from('$'),
    Buffer.from(encoded),
    Buffer.from(`*${checksum(body)}\r\n`),
  ]);
}
