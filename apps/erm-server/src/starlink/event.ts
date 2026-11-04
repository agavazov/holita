import { binaryBody, binaryUnitId, type ParsedFrame } from './protocol.js';
import { decodeEdata, type EdataReport } from './edata.js';

export const DEFAULT_EVENT_STRUCTURE =
  '#EDT#,#EID#,#PDT#,#LAT#,#LONG#,#SPD#,#HEAD#,#ODOD#,#LAC#,#CID#,#ENG#,#VIN#,#VBAT#,#BATC#,#BATH#,#STRT#,#TVI#,#NXT#,#ALT#,#CSS#';

export interface DecodedEvent {
  unitId: string;
  eventId: string | null;
  eventTime: Date | null;
  positionTime: Date | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  heading: number | null;
  odometer: number | null;
  engineOn: boolean | null;
  mainVoltage: number | null;
  backupVoltage: number | null;
  fields: Record<string, string | null | string[] | EdataReport>;
}

function number(raw: string | undefined): number | null {
  if (raw === undefined || !/^[+-]?\d+(?:\.\d+)?$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function timestamp(raw: string | undefined): Date | null {
  // Parameter 0176 defaults to YYMMDDHHMMSS. EDT/PDT are UTC; LDT is the local macro.
  if (raw === undefined || !/^\d{12}$/.test(raw)) {
    return null;
  }
  const year = 2000 + Number(raw.slice(0, 2));
  const month = Number(raw.slice(2, 4));
  const day = Number(raw.slice(4, 6));
  const hour = Number(raw.slice(6, 8));
  const minute = Number(raw.slice(8, 10));
  const second = Number(raw.slice(10, 12));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
    ? date
    : null;
}

function coordinate(raw: string | undefined, degrees: 2 | 3): number | null {
  if (raw === undefined || !new RegExp(`^[+-]\\d{${String(degrees + 2)}}\\.\\d{4}$`).test(raw)) {
    return null;
  }
  const magnitude = Number(raw.slice(1, degrees + 1));
  const minutes = Number(raw.slice(degrees + 1));
  const value = magnitude + minutes / 60;
  if (minutes >= 60 || value > (degrees === 2 ? 90 : 180)) {
    return null;
  }
  return raw.startsWith('-') ? -value : value;
}

export function decodeEvent(
  frame: ParsedFrame,
  structure: readonly string[] = DEFAULT_EVENT_STRUCTURE.split(','),
): DecodedEvent | undefined {
  if (frame.origin !== 'SLU' || (frame.command !== '06' && frame.command !== '86')) {
    return undefined;
  }
  const raw = frame.fields.map((field) => field.toString('latin1'));
  const tokens = new Map(structure.map((token, index) => [token, raw[index]]));
  const fields: DecodedEvent['fields'] = {};
  for (const [token, value] of tokens) {
    fields[token] = value ?? null;
  }
  const extra = raw.slice(structure.length);
  fields['extra'] = extra;
  const eventId = tokens.get('#EID#');
  const edata = eventId === '33' ? decodeEdata(extra) : undefined;
  if (edata) {
    fields['edata'] = edata;
  }
  const speed = number(tokens.get('#SPD#'));
  const engine = tokens.get('#ENG#');
  return {
    unitId: frame.unitId,
    eventId: eventId !== undefined && /^\d{2,3}$/.test(eventId) ? eventId : null,
    eventTime: timestamp(tokens.get('#EDT#')),
    positionTime: timestamp(tokens.get('#PDT#')),
    latitude: coordinate(tokens.get('#LAT#'), 2),
    longitude: coordinate(tokens.get('#LONG#'), 3),
    speedKmh: speed === null ? null : speed * 1.852,
    heading: number(tokens.get('#HEAD#')),
    odometer: number(tokens.get('#ODOD#')),
    engineOn: engine === '1' ? true : engine === '0' ? false : null,
    mainVoltage: number(tokens.get('#VIN#')),
    backupVoltage: number(tokens.get('#VBAT#')),
    fields,
  };
}

// $SLB reports (protocol format 0182=3): after G9 replacement, 04, the BCD IMEI, two bytes, the command
// (06, or 86 without confirmation) and tag/value pairs, mapped from 2026-11-03 captures in
// docs/discocan/erm-resources/starlink-binary-formats.md. An unknown tag leaves the report undecoded.
const binarySizes = new Map([
  [0x03, 4],
  [0x0c, 4],
  [0x08, 1],
  [0x0e, 4],
  [0x19, 8],
  [0x06, 1],
  [0x07, 1],
  [0x12, 2],
  [0x16, 4],
  [0x1b, 7],
  [0x20, 2],
  [0x21, 2],
  [0x27, 1],
  [0x26, 1],
  [0x41, 2],
  [0x18, 2],
  [0x3e, 2],
  [0x42, 2],
  [0x43, 2],
  [0x0f, 4],
  [0x3b, 4],
  [0x51, 1],
  // ff is a marker without a value; 32 carries the flags: bit 0 (and bit 3) ignition, bit 1 engine.
  // CB6711TE also sent 32 without ff (2026-11-04).
  [0xff, 0],
  [0x32, 1],
]);
const since2000 = Date.UTC(2000, 0, 1);

export function decodeBinaryEvent(raw: Buffer): DecodedEvent | undefined {
  const unitId = binaryUnitId(raw);
  const body = binaryBody(raw);
  if (
    raw.subarray(0, 4).toString('latin1') !== '$SLB' ||
    unitId === undefined ||
    (body[10] !== 0x06 && body[10] !== 0x86)
  ) {
    return undefined;
  }
  const values = new Map<number, Buffer>();
  let extra = '';
  for (let index = 11; index < body.length;) {
    const tag = body.readUInt8(index++);
    if (tag === 0xfe) {
      extra = body.subarray(index).toString('latin1');
      break;
    }
    const size = binarySizes.get(tag);
    if (size === undefined || index + size > body.length) {
      return undefined;
    }
    values.set(tag, body.subarray(index, index + size));
    index += size;
  }
  const unsigned = (tag: number): number | null => {
    const value = values.get(tag);
    return value === undefined ? null : value.readUIntBE(0, value.length);
  };
  const time = (tag: number): Date | null => {
    const seconds = unsigned(tag);
    return seconds === null ? null : new Date(since2000 + seconds * 1000);
  };
  const position = values.get(0x19);
  const cell = values.get(0x1b);
  const satellites = values.get(0x18);
  const signal = values.get(0x3e);
  const altitude = values.get(0x0f);
  const heading = values.has(0x07) ? 256 + (unsigned(0x07) ?? 0) : unsigned(0x06);
  const speed = unsigned(0x12);
  const odometer = unsigned(0x16);
  const main = unsigned(0x20);
  const backup = unsigned(0x21);
  const eventId = unsigned(0x08);
  const flags = values.get(0x32)?.[0];
  const edata = eventId === 33 ? decodeEdata(extra.split(',')) : undefined;
  const text = (value: number | null | undefined): string | null =>
    value === null || value === undefined ? null : String(value);
  return {
    unitId,
    eventId: eventId === null ? null : String(eventId).padStart(2, '0'),
    eventTime: time(0x0c),
    positionTime: time(0x0e),
    latitude: position ? position.readInt32BE(0) / 1e6 : null,
    longitude: position ? position.readInt32BE(4) / 1e6 : null,
    speedKmh: speed === null ? null : (speed / 10) * 1.852,
    heading,
    odometer: odometer === null ? null : odometer / 1000,
    engineOn: flags === undefined ? null : (flags & 0x02) !== 0,
    mainVoltage: main === null ? null : main / 1000,
    backupVoltage: backup === null ? null : backup / 1000,
    fields: {
      '#SPD#': speed === null ? null : String(speed / 10),
      '#CID#': text(cell?.readUInt32BE(0)),
      '#LAC#': text(cell?.readUInt16BE(4)),
      '#CSS#': text(cell?.readUInt8(6)),
      '#BATH#': text(unsigned(0x26)),
      '#STRT#': text(unsigned(0x41) === null ? null : (unsigned(0x41) ?? 0) / 100),
      '#SATN#': text(satellites?.readUInt8(0)),
      '#SATU#': text(satellites?.readUInt8(1)),
      '#SAT#': text(signal?.readUInt8(0)),
      '#GSS#': text(signal?.readUInt8(1)),
      '#TVI#': text(unsigned(0x42) === null ? null : (unsigned(0x42) ?? 0) / 10),
      '#NXT#': text(unsigned(0x43)),
      '#ALTD#': altitude ? String(altitude.readInt32BE(0) / 10) : null,
      '#NC#': text(unsigned(0x3b)),
      '#NT#': text(unsigned(0x51)),
      '#IGN#': flags === undefined ? null : (flags & 0x01) !== 0 ? '1' : '0',
      unknown: [values.get(0x27)?.toString('hex') ?? '', values.get(0x32)?.toString('hex') ?? ''],
      extra: extra.split(','),
      ...(edata ? { edata } : {}),
    },
  };
}
