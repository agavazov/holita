// $SLC containers (protocol format 0182=3) hold ordinary frames: after G9 replacement, tag 04 and the
// BCD IMEI, two bytes, the 3-byte uncompressed length and LZF-compressed data. As in
// apps/erm-server/src/starlink/protocol.ts, which tools may not import.
const escapedBytes = new Map([
  [0x10, 0x10],
  [0x01, 0x0d],
  [0x02, 0x0a],
  [0x03, 0x00],
  [0x04, 0x11],
  [0x05, 0x13],
]);

function body(raw: Buffer): Buffer {
  const decoded: number[] = [];
  for (let index = 4; index < raw.length; index++) {
    const byte = raw.readUInt8(index);
    const next = raw[index + 1];
    const replacement = byte === 0x10 && next !== undefined ? escapedBytes.get(next) : undefined;
    if (replacement !== undefined || ((byte === 0x24 || byte === 0x2a) && next === byte)) {
      decoded.push(replacement ?? byte);
      index++;
    } else if (byte === 0x2a) {
      break;
    } else {
      decoded.push(byte);
    }
  }
  return Buffer.from(decoded);
}

export function inflateContainer(raw: Buffer): Buffer[] | undefined {
  const data = body(raw);
  if (raw.subarray(0, 4).toString('latin1') !== '$SLC' || data[0] !== 0x04 || data.length < 13) {
    return undefined;
  }
  const output = Buffer.alloc(data.readUIntBE(10, 3));
  let size = 0;
  for (let index = 13; index < data.length;) {
    const control = data.readUInt8(index++);
    if (control < 32) {
      if (index + control + 1 > data.length || size + control + 1 > output.length) {
        return undefined;
      }
      size += data.copy(output, size, index, index + control + 1);
      index += control + 1;
      continue;
    }
    const extra = control >> 5 === 7 ? data[index++] : 0;
    const offset = data[index++];
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
