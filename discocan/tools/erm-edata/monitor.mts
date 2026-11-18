import { type PortableExecutable, slice, u16, u32, utf8 } from './binary.mjs';
import { at, requireValue } from './data.mjs';
import type { JsonObject, Parameter } from './data.mjs';

// ECMA-335 II.22 table columns. Only the tables used below are materialized;
// all preceding widths are computed from heap flags, row counts and coded indices.
const coded: Record<string, { bits: number; tables: number[] }> = {
  resolution: { bits: 2, tables: [0, 26, 35, 1] },
  type: { bits: 2, tables: [2, 1, 27] },
  member: { bits: 3, tables: [2, 1, 26, 6, 27] },
  constant: { bits: 2, tables: [4, 8, 23] },
  custom: {
    bits: 5,
    tables: [6, 4, 1, 2, 8, 9, 10, 0, 14, 23, 20, 17, 26, 27, 32, 35, 38, 39, 40, 42, 44, 43],
  },
  customType: { bits: 3, tables: [6, 10] },
  marshal: { bits: 1, tables: [4, 8] },
  security: { bits: 2, tables: [2, 6, 32] },
  semantics: { bits: 1, tables: [20, 23] },
  method: { bits: 1, tables: [6, 10] },
  forwarded: { bits: 1, tables: [4, 6] },
  implementation: { bits: 2, tables: [38, 35, 39] },
  owner: { bits: 1, tables: [2, 6] },
};
const schemas = [
  '2 s g g g',
  'c:resolution s s',
  '4 s s c:type t:4 t:6',
  't:4',
  '2 s b',
  't:6',
  '4 2 2 s b t:8',
  't:8',
  '2 2 s',
  't:2 c:type',
  'c:member s b',
  '2 c:constant b',
  'c:custom c:customType b',
  'c:marshal b',
  '2 c:security b',
  '2 4 t:2',
  '4 t:4',
  'b',
  't:2 t:20',
  't:20',
  '2 s c:type',
  't:2 t:23',
  't:23',
  '2 s b',
  '2 t:6 c:semantics',
  't:2 c:method c:method',
  's',
  'b',
  '2 c:forwarded s t:26',
  '4 t:4',
  '4 4',
  '4',
  '4 2 2 2 2 4 b s s',
  '4',
  '4 4 4',
  '2 2 2 2 4 b s s b',
  '4 t:35',
  '4 4 4 t:35',
  '4 s b',
  '4 4 s s c:implementation',
  '4 4 s c:implementation',
  't:2 t:2',
  '2 2 c:owner s',
  'c:method b',
  't:42 c:type',
];
export interface Method {
  name: string;
  rva: number;
}
export interface Metadata {
  methods: Method[];
  fields: string[];
  fieldRvas: Map<number, number>;
  assemblies: JsonObject[];
  resources: string[];
}
export function metadata(pe: PortableExecutable): Metadata {
  const cli = pe.directory(14);
  requireValue(cli.rva && cli.size >= 72, 'Missing CLI metadata');
  const header = pe.data(cli.rva, 72),
    root = pe.data(u32(header, 8), u32(header, 12));
  requireValue(u32(root, 0) === 0x424a5342, 'Invalid CLI metadata signature');
  let cursor = (16 + u32(root, 12) + 3) & ~3;
  const streamCount = u16(root, cursor + 2),
    streams = new Map<string, Buffer>();
  cursor += 4;
  for (let i = 0; i < streamCount; i++) {
    const offset = u32(root, cursor),
      size = u32(root, cursor + 4),
      end = root.indexOf(0, cursor + 8);
    requireValue(end >= cursor + 8 && end - cursor <= 40, 'Invalid metadata stream name');
    const name = utf8(slice(root, cursor + 8, end - cursor - 8));
    requireValue(!streams.has(name), 'Duplicate CLI stream');
    streams.set(name, slice(root, offset, size));
    cursor = (end + 4) & ~3;
  }
  const tables = streams.get('#~'),
    strings = streams.get('#Strings');
  requireValue(tables && strings, 'Unsupported CLI metadata streams');
  const stringHeap = strings;
  const heap = at([...slice(tables, 6, 1)], 0),
    present = slice(tables, 8, 8).readBigUInt64LE(),
    counts = new Map<number, number>();
  cursor = 24;
  for (let i = 0; i < 64; i++) {
    if (present & (1n << BigInt(i))) {
      requireValue(i < schemas.length, 'Unsupported CLI metadata table');
      counts.set(i, u32(tables, cursor));
      cursor += 4;
    }
  }
  function width(column: string): number {
    if (column === '2' || column === '4') {
      return Number(column);
    }
    if (column === 's' || column === 'g' || column === 'b') {
      return heap & { s: 1, g: 2, b: 4 }[column] ? 4 : 2;
    }
    if (column.startsWith('t:')) {
      return (counts.get(Number(column.slice(2))) ?? 0) >= 65536 ? 4 : 2;
    }
    const code = coded[column.slice(2)];
    requireValue(code, 'Unknown coded metadata index');
    return code.tables.some((table) => (counts.get(table) ?? 0) >= 2 ** (16 - code.bits)) ? 4 : 2;
  }
  const rows = new Map<number, number[][]>();
  for (let table = 0; table < schemas.length; table++) {
    const widths = at(schemas, table).split(' ').map(width),
      count = counts.get(table) ?? 0,
      rowSize = widths.reduce((a, b) => a + b, 0);
    slice(tables, cursor, rowSize * count);
    if ([4, 6, 29, 32, 40].includes(table)) {
      const values: number[][] = [];
      for (let row = 0; row < count; row++) {
        let offset = cursor + row * rowSize;
        values.push(
          widths.map((size) => {
            const value = size === 2 ? u16(tables, offset) : u32(tables, offset);
            offset += size;
            return value;
          }),
        );
      }
      rows.set(table, values);
    }
    cursor += rowSize * count;
  }
  function text(index: number): string {
    const end = stringHeap.indexOf(0, index);
    requireValue(end >= index, 'Invalid CLI string heap index');
    return utf8(slice(stringHeap, index, end - index));
  }
  return {
    methods: (rows.get(6) ?? []).map((row) => ({ rva: at(row, 0), name: text(at(row, 3)) })),
    fields: (rows.get(4) ?? []).map((row) => text(at(row, 1))),
    fieldRvas: new Map((rows.get(29) ?? []).map((row) => [at(row, 1), at(row, 0)])),
    assemblies: (rows.get(32) ?? []).map((row) => ({
      name: text(at(row, 7)),
      version: row.slice(1, 5).join('.'),
    })),
    resources: (rows.get(40) ?? []).map((row) => text(at(row, 2))),
  };
}
interface Address {
  field: number;
  offset: number;
}
type Constant = number | Address;
export interface ConstantWrite {
  value: Constant;
  width: number;
}
export function constantWrites(
  pe: PortableExecutable,
  model: Metadata,
  symbol: string,
): { writes: Map<number, ConstantWrite>; evidence: JsonObject } {
  const matches = model.methods
    .map((method, index) => ({ method, index }))
    .filter(({ method }) => method.name.includes('??__E') && method.name.includes(`@${symbol}@`));
  requireValue(matches.length === 1, `Cannot uniquely locate initializer for ${symbol}`);
  const { method, index } = at(matches, 0),
    offset = pe.offset(method.rva),
    first = pe.raw.readUInt8(offset);
  let start: number, size: number;
  if ((first & 3) === 2) {
    start = offset + 1;
    size = first >> 2;
  } else {
    requireValue(
      (first & 3) === 3 && u16(pe.raw, offset) >> 12 >= 3,
      'Unsupported CIL method header',
    );
    start = offset + (u16(pe.raw, offset) >> 12) * 4;
    size = u32(pe.raw, offset + 4);
  }
  const body = pe.data(method.rva, start - offset + size);
  const code = slice(body, start - offset, size),
    stack: Constant[] = [],
    writes = new Map<number, ConstantWrite>(),
    fields = new Set<number>();
  function pop(): Constant {
    const value = stack.pop();
    requireValue(value !== undefined, 'Unbalanced initializer stack');
    return value;
  }
  function write(destination: Constant, value: Constant, width: number): void {
    requireValue(
      typeof destination !== 'number' && !writes.has(destination.offset),
      'Overlapping or invalid constant writes',
    );
    fields.add(destination.field);
    writes.set(destination.offset, { value, width });
  }
  let cursor = 0;
  while (cursor < code.length) {
    const op = code.readUInt8(cursor++);
    if (op === 0x7f || op === 0x80) {
      const token = u32(code, cursor);
      cursor += 4;
      requireValue(token >>> 24 === 4, 'Unsupported field token');
      const address = { field: token & 0xffffff, offset: 0 };
      requireValue(
        address.field > 0 && address.field <= model.fields.length,
        'Invalid field token',
      );
      if (op === 0x7f) {
        stack.push(address);
      } else {
        write(address, pop(), 4);
      }
    } else if (op >= 0x15 && op <= 0x1e) {
      stack.push(op - 0x16);
    } else if (op === 0x1f) {
      stack.push(slice(code, cursor, 1).readInt8());
      cursor++;
    } else if (op === 0x20) {
      stack.push(slice(code, cursor, 4).readInt32LE());
      cursor += 4;
    } else if (op === 0x23) {
      const value = slice(code, cursor, 8).readDoubleLE();
      requireValue(Number.isFinite(value), 'Nonfinite conversion');
      stack.push(value);
      cursor += 8;
    } else if (op === 0x58) {
      const right = pop(),
        left = pop();
      requireValue(
        typeof left !== 'number' && typeof right === 'number' && Number.isInteger(right),
        'Unsupported initializer address arithmetic',
      );
      stack.push({ field: left.field, offset: left.offset + right });
    } else if (op === 0x52 || op === 0x54 || op === 0x57) {
      const value = pop();
      write(pop(), value, op === 0x52 ? 1 : op === 0x54 ? 4 : 8);
    } else if (op === 0x2a) {
      requireValue(stack.length === 0, 'Unbalanced initializer stack');
    } else {
      throw new Error(`Unsupported initializer instruction 0x${op.toString(16)} for ${symbol}`);
    }
  }
  requireValue(fields.size === 1 && !stack.length, `Invalid initializer writes for ${symbol}`);
  const field = at([...fields], 0),
    fieldName = at(model.fields, field - 1);
  requireValue(fieldName.endsWith(`.${symbol}`), 'Initializer targets unexpected field');
  return {
    writes,
    evidence: {
      methodName: method.name,
      methodToken: `0x${(0x06000000 | (index + 1)).toString(16).toUpperCase().padStart(8, '0')}`,
      rva: method.rva,
      fieldName,
      assignments: writes.size,
    },
  };
}
// Preserve the original catalog's CPython float text, including integral doubles
// and scientific-notation thresholds; conversions remain source text in the DB.
export function floatText(value: number): string {
  requireValue(Number.isFinite(value), 'Nonfinite conversion');
  if (Object.is(value, -0)) {
    return '-0.0';
  }
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 1e-4 || magnitude >= 1e16)) {
    const [mantissa, exponent] = value.toExponential().split('e');
    requireValue(mantissa && exponent, 'Invalid float');
    const power = Number(exponent);
    return `${mantissa}e${power < 0 ? '-' : '+'}${String(Math.abs(power)).padStart(2, '0')}`;
  }
  return Number.isInteger(value) ? `${String(value)}.0` : String(value);
}
export function monitorRecords(pe: PortableExecutable, model = metadata(pe)) {
  requireValue(
    pe.machine === 0x14c,
    'Only the structurally validated x86 CLI table layout is supported',
  );
  const initializers: JsonObject[] = [];
  function text(pointer: Constant): string {
    requireValue(typeof pointer !== 'number' && pointer.offset === 0, 'Unsupported string pointer');
    const rva = model.fieldRvas.get(pointer.field);
    requireValue(rva !== undefined, 'Unsupported string pointer');
    const raw = pe.available(rva, 65536),
      end = raw.indexOf(0);
    requireValue(end >= 0, 'Unterminated catalog string');
    return utf8(raw.subarray(0, end));
  }
  function table(
    symbol: string,
    lengthSymbol: string,
    size: number,
    layout: [number, number][],
  ): Map<number, Constant>[] {
    const { writes, evidence } = constantWrites(pe, model, symbol),
      length = constantWrites(pe, model, lengthSymbol),
      item = length.writes.get(0);
    requireValue(length.writes.size === 1 && item?.width === 4, 'Invalid array length initializer');
    const count = item.value;
    requireValue(
      typeof count === 'number' && Number.isInteger(count) && count > 0 && count <= 100000,
      'Unsupported array length',
    );
    requireValue(
      writes.size === count * layout.length,
      `Unsupported memory layout or incomplete coverage for ${symbol}`,
    );
    const rows: Map<number, Constant>[] = [];
    for (let i = 0; i < count; i++) {
      const row = new Map<number, Constant>();
      for (const [offset, width] of layout) {
        const value = writes.get(i * size + offset);
        requireValue(
          value?.width === width,
          `Unsupported memory layout or incomplete coverage for ${symbol}`,
        );
        row.set(offset, value.value);
      }
      rows.push(row);
    }
    initializers.push({
      ...evidence,
      lengthInitializer: length.evidence,
      recordBytes: size,
      records: count,
    });
    return rows;
  }
  function get(row: Map<number, Constant>, offset: number): Constant {
    const value = row.get(offset);
    requireValue(value !== undefined, 'Missing table value');
    return value;
  }
  function integer(row: Map<number, Constant>, offset: number): number {
    const value = get(row, offset);
    requireValue(typeof value === 'number' && Number.isSafeInteger(value), 'Invalid integer field');
    return value;
  }
  function conversion(row: Map<number, Constant>, offset: number): string {
    const value = get(row, offset);
    requireValue(typeof value === 'number', 'Invalid conversion');
    return floatText(value);
  }
  const rawParameters = table('Parameters_Details_Array', 'Parameters_Array_Length', 32, [
    [0, 4],
    [4, 4],
    [8, 8],
    [16, 8],
    [24, 4],
  ]);
  const rawSets = table('Parameters_Sets_Details_Array', 'Parameters_Sets_Array_Length', 16, [
    [0, 4],
    [4, 1],
    [5, 1],
    [6, 1],
    [7, 1],
    [8, 1],
    [12, 4],
  ]);
  const rawProfiles = table('Car_Details_Array', 'Cars_Array_Length', 16, [
    [0, 4],
    [4, 4],
    [8, 4],
    [12, 4],
  ]);
  const rawCategories = table('Cars_Categories_Array', 'Categories_Array_Length', 8, [
    [0, 4],
    [4, 4],
  ]);
  const parameters: Parameter[] = rawParameters.map((row, ordinal) => ({
    key: `monitor:${String(ordinal)}`,
    sourceKey: 'monitor',
    parameterId: integer(row, 0),
    category: String(integer(row, 4)),
    name: text(get(row, 24)),
    multiply: conversion(row, 8),
    offset: conversion(row, 16),
    details: { ordinal, issues: [] },
  }));
  const sets: JsonObject[] = rawSets.map((row) => {
    const ids = text(get(row, 12));
    requireValue(/^[0-9]+(?:,[0-9]+)*,?$/.test(ids), 'Unsupported parameter membership list');
    const parameterIds = ids.split(',').filter(Boolean).map(Number);
    requireValue(parameterIds.every(Number.isSafeInteger), 'Unsupported parameter ID');
    return {
      vendorId: integer(row, 0),
      parameterIds,
      details: {
        canBaudCode: integer(row, 4),
        isObdUnit: integer(row, 5),
        silentMode: integer(row, 6),
        obdProtocolsMask: integer(row, 7),
        regularProtocolsMask: integer(row, 8),
        rawParameterIds: ids,
      },
    };
  });
  const profiles: JsonObject[] = rawProfiles.map((row) => ({
    vendorId: integer(row, 0),
    setId: integer(row, 4),
    categoryId: integer(row, 8),
    name: text(get(row, 12)),
  }));
  const categories: JsonObject[] = rawCategories.map((row) => ({
    vendorId: integer(row, 0),
    name: text(get(row, 4)),
  }));
  return {
    parameters,
    sets,
    profiles,
    categories,
    source: {
      key: 'monitor',
      kind: 'monitor',
      evidence: { initializers, layout: 'x86-constant-arrays-v1' },
    },
  };
}
