import type { ParsedFrame } from './protocol.js';

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
  fields: Record<string, string | null | string[]>;
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
  fields['extra'] = raw.slice(structure.length);
  const eventId = tokens.get('#EID#');
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
