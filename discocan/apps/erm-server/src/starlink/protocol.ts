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

// Multiple-parameter responses quote values, including comma-separated settings such as 0177.
function dataFields(data: Buffer): Buffer[] {
  const fields: Buffer[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < data.length; index++) {
    if (data[index] === 0x22) {
      quoted = !quoted;
    } else if (data[index] === 0x2c && !quoted) {
      fields.push(data.subarray(start, index));
      start = index + 1;
    }
  }
  fields.push(data.subarray(start));
  return fields;
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
  const fields = body.length > prefixLength ? dataFields(body.subarray(prefixLength + 1)) : [];
  return { header, origin, unitId, command, reference, fields, checksum: state };
}

// The G9-replaced body of a binary frame, between its 4-byte header and the checksum separator.
export function binaryBody(raw: Buffer): Buffer {
  const separator = checksumSeparator(raw, 4);
  return unescape(raw.subarray(4, separator < 0 ? raw.length : separator));
}

// $SLC containers (protocol format 0182=3) hold ordinary text frames: after G9 replacement, tag 04 and
// the BCD IMEI, two bytes (3f 01), the 3-byte uncompressed length and LZF-compressed data.
export function inflateContainer(raw: Buffer): Buffer[] | undefined {
  const body = binaryBody(raw);
  if (raw.subarray(0, 4).toString('latin1') !== '$SLC' || body[0] !== 0x04 || body.length < 13) {
    return undefined;
  }
  const output = Buffer.alloc(body.readUIntBE(10, 3));
  let size = 0;
  for (let index = 13; index < body.length;) {
    const control = body.readUInt8(index++);
    if (control < 32) {
      if (index + control + 1 > body.length || size + control + 1 > output.length) {
        return undefined;
      }
      size += body.copy(output, size, index, index + control + 1);
      index += control + 1;
      continue;
    }
    const extra = control >> 5 === 7 ? body[index++] : 0;
    const offset = body[index++];
    if (extra === undefined || offset === undefined) {
      return undefined;
    }
    const length = (control >> 5) + extra + 2;
    const reference = size - ((control & 0x1f) << 8) - offset - 1;
    if (reference < 0 || size + length > output.length) {
      return undefined;
    }
    for (let copied = 0; copied < length; copied++) {
      output[size++] = output[reference + copied] ?? 0;
    }
  }
  return size === output.length
    ? output
        .toString('latin1')
        .split('\r\n')
        .filter((frame) => frame !== '')
        .map((frame) => Buffer.from(frame, 'latin1'))
    : undefined;
}

// CB5640XP's undocumented $SLB/$SLC frames start, after G9 replacement, with tag 04 and the first 14
// IMEI digits in BCD; the 15th is the Luhn check digit.
export function binaryUnitId(raw: Buffer): string | undefined {
  const header = raw.subarray(0, 4).toString('latin1');
  const body = unescape(raw.subarray(4, 24));
  const digits = body.subarray(1, 8).toString('hex');
  if ((header !== '$SLB' && header !== '$SLC') || body[0] !== 0x04 || !/^\d{14}$/.test(digits)) {
    return undefined;
  }
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    const digit = Number(digits[digits.length - 1 - index]) * (index % 2 === 0 ? 2 : 1);
    sum += digit > 9 ? digit - 9 : digit;
  }
  return `${digits}${String((10 - (sum % 10)) % 10)}`;
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
