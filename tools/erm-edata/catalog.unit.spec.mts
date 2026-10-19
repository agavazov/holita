import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { crc32 } from 'node:zlib';
import { archiveCandidates, PortableExecutable, u16, u32, zipEntries } from './binary.mjs';
import { compare, extract, inventory, reconcile } from './catalog.mjs';
import { array, at, canonical, number, object, requireValue, sha256, string } from './data.mjs';
import type { Catalog, Workbook } from './data.mjs';
import { constantWrites, floatText, metadata, monitorRecords } from './monitor.mjs';
import { workbookRecords, xml } from './workbook.mjs';

const exe = resolve(
  'resources/discocan/Simple eData FMS Monitor/Simple eData FMS Monitor v9.56.exe',
);
const committed = resolve('docs/discocan/erm-resources/simple-edata-catalog/v9.56');
const contentHash = '85eeba3a3a918aee35ff73abb839bbc7539ff136ba58f86bb6d1f15f33a6b151';
// Stored ZIP writer for mutation fixtures, independent of the production reader.
function zip(entries: { path: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [],
    directory: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path),
      local = Buffer.alloc(30),
      central = Buffer.alloc(46),
      checksum = crc32(entry.data);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, entry.data);
    directory.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }
  const end = Buffer.alloc(22),
    central = Buffer.concat(directory);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
function mutateBook(book: Workbook, path: string, replace: (value: string) => string): Workbook {
  return {
    ...book,
    payload: zip(
      zipEntries(book.payload).map((entry) =>
        entry.path === path
          ? { ...entry, data: Buffer.from(replace(entry.data.toString('utf8'))) }
          : entry,
      ),
    ),
  };
}
function cli(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'tools/erm-edata/catalog.mts', ...args], {
    encoding: 'utf8',
  });
}
describe('static eData catalog', () => {
  let scratch: string, input: string, catalog: Catalog, books: Workbook[];
  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'holita-edata-test-'));
    input = join(scratch, basename(exe));
    copyFileSync(exe, input);
    catalog = extract(input, 'v9.56');
    books = inventory(input).workbooks;
  });
  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('extracts from only the EXE and preserves every baseline record and source byte', () => {
    expect(readdirSync(scratch)).toEqual([basename(exe)]);
    expect(sha256(readFileSync(input))).toBe(
      '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0',
    );
    expect(catalog.coverage).toEqual({
      complete: true,
      sources: 3,
      parameters: 5488,
      sets: 203,
      memberships: 3728,
      profiles: 2,
      categories: 1,
      issues: {
        decimal_hex_mismatch: 40,
        set_member_without_monitor_definition: 10,
        source_coverage_difference: 46,
      },
    });
    for (const book of books) {
      const records = catalog.parameters.filter((parameter) => parameter.sourceKey === book.key);
      expect(records).toHaveLength(book.key.startsWith('fc5b') ? 1855 : 1819);
      expect(
        records.filter((parameter) =>
          array(parameter.details['issues']).includes('decimal_hex_mismatch'),
        ),
      ).toHaveLength(20);
      expect(book.payload).toEqual(readFileSync(join(committed, 'workbooks', `${book.key}.xlsx`)));
    }
    expect(
      at(
        books.filter((book) => book.key.startsWith('fc5b')),
        0,
      ).locations,
    ).toHaveLength(3);
    expect(catalog.profiles).toEqual([
      { vendorId: 343, setId: 135, categoryId: 3, name: 'FMS Parameters (250k)' },
      { vendorId: 430, setId: 135, categoryId: 3, name: 'FMS Parameters (500k)' },
    ]);
    expect(
      array(
        at(
          catalog.sets.filter((set) => set['vendorId'] === 135),
          0,
        )['parameterIds'],
      ),
    ).toHaveLength(1262);
  });
  it('reproduces the entire Python-produced catalog byte for byte, deterministically', () => {
    expect(
      Buffer.from(`${canonical(catalog)}\n`).equals(readFileSync(join(committed, 'catalog.json'))),
    ).toBe(true);
    expect(sha256(canonical(catalog))).toBe(contentHash);
    expect(canonical(extract(input, 'v9.56'))).toBe(canonical(catalog));
  });
  it('retains category duplicates, unresolved IDs and shared formula provenance', () => {
    const records = catalog.parameters.filter((parameter) => parameter.parameterId === 781);
    expect(records.length).toBeGreaterThan(3);
    expect(new Set(records.map((parameter) => parameter.key)).size).toBe(records.length);
    const follower = at(
      catalog.parameters.filter(
        (parameter) => parameter.sourceKey !== 'monitor' && parameter.details['row'] === 4,
      ),
      0,
    );
    expect(
      object(object(object(follower.details['cells'])['B'])['formula'])['sharedAnchor'],
    ).toEqual({ cell: 'B3', text: 'DEC2HEX(A3)', range: 'B3:B66' });
    expect(
      catalog.issues.filter((issue) => issue['kind'] === 'set_member_without_monitor_definition'),
    ).toHaveLength(10);
  });
  it('discovers initializers by symbols instead of fixed metadata row numbers', () => {
    const pe = new PortableExecutable(readFileSync(input)),
      model = metadata(pe);
    model.methods.reverse();
    const result = constantWrites(pe, model, 'Parameters_Details_Array');
    expect(result.writes.size).toBe(1814 * 5);
    expect(result.evidence['methodToken']).not.toBe('0x06000001');
    expect(monitorRecords(pe, model).parameters).toEqual(
      catalog.parameters.filter((parameter) => parameter.sourceKey === 'monitor'),
    );
  });
  it('rejects unsupported CIL instructions and incomplete/changed constant-array layouts', () => {
    const pe = new PortableExecutable(Buffer.from(readFileSync(input))),
      model = metadata(pe),
      method = at(
        model.methods.filter(
          (method) =>
            method.name.includes('@Parameters_Details_Array@') && method.name.includes('??__E'),
        ),
        0,
      ),
      offset = pe.offset(method.rva),
      start = offset + (u16(pe.raw, offset) >> 12) * 4,
      size = u32(pe.raw, offset + 4);
    const original = pe.raw.readUInt8(start);
    pe.raw.writeUInt8(0x28, start);
    expect(() => constantWrites(pe, model, 'Parameters_Details_Array')).toThrow(
      'Unsupported initializer instruction',
    );
    pe.raw.writeUInt8(original, start);
    expect(pe.raw.readUInt8(start + size - 2)).toBe(0x54);
    pe.raw.writeUInt8(0x52, start + size - 2);
    expect(() => monitorRecords(pe, model)).toThrow('Unsupported memory layout');
    pe.raw.writeUInt32LE(0xffffffff, offset + 4);
    expect(() => constantWrites(pe, model, 'Parameters_Details_Array')).toThrow(
      'Invalid/unbacked PE RVA',
    );
  });
  it('rejects missing, truncated, corrupt, encrypted, duplicate and oversized inputs', () => {
    expect(() => extract(join(scratch, 'missing.exe'), 'test')).toThrow();
    expect(() => archiveCandidates(Buffer.from('504b0506', 'hex'))).toThrow('Truncated ZIP');
    const broken = Buffer.from(at(books, 0).payload);
    broken[1000] = broken.readUInt8(1000) ^ 255;
    expect(() => archiveCandidates(broken)).toThrow();
    expect(() => new PortableExecutable(readFileSync(input).subarray(0, 32))).toThrow();
    const fixture = zip([
      { path: '[Content_Types].xml', data: Buffer.from('x') },
      { path: '_rels/.rels', data: Buffer.from('x') },
    ]);
    const encrypted = Buffer.from(fixture);
    encrypted.writeUInt16LE(1, encrypted.indexOf(Buffer.from('504b0102', 'hex')) + 8);
    expect(() => archiveCandidates(encrypted)).toThrow('Encrypted');
    expect(() =>
      zipEntries(
        zip([
          { path: 'a', data: Buffer.from('a') },
          { path: 'a', data: Buffer.from('b') },
        ]),
      ),
    ).toThrow('Duplicate');
    const oversized = Buffer.from(fixture);
    oversized.writeUInt32LE(100_000_001, oversized.indexOf(Buffer.from('504b0102', 'hex')) + 24);
    expect(() => archiveCandidates(oversized)).toThrow('Oversized');
  });
  it('rejects unknown headers, broken shared formulas, external relationships and XML declarations', () => {
    const book = at(books, 0);
    expect(() =>
      workbookRecords(
        mutateBook(book, 'xl/sharedStrings.xml', (value) =>
          value.replace('Parametr ID (Dec)', 'Unknown ID format'),
        ),
      ),
    ).toThrow('Unsupported headers');
    expect(() =>
      workbookRecords(
        mutateBook(book, 'xl/worksheets/sheet1.xml', (value) => value.replace('DEC2HEX(A3)', '')),
      ),
    ).toThrow('Missing shared formula anchor');
    expect(() =>
      workbookRecords(
        mutateBook(book, 'xl/_rels/workbook.xml.rels', (value) =>
          value.replace('Target=', 'TargetMode="External" Target='),
        ),
      ),
    ).toThrow('External workbook');
    expect(() => xml(Buffer.from('<!DOCTYPE r><r/>'))).toThrow('DTD/entity');
    expect(() => xml(Buffer.from('<r><x></r>'))).toThrow('Malformed');
    for (const invalid of [
      '<r>&unknown;</r>',
      '<r>&#0;</r>',
      '<r a="<"/>',
      '<r>]]></r>',
      '<r><!-- a--b --></r>',
    ]) {
      expect(() => xml(Buffer.from(invalid))).toThrow();
    }
    expect(xml(Buffer.from('<r>&amp;&#65;<![CDATA[&unknown;]]></r>')).text).toBe('&A&unknown;');
  });
  it('ignores metadata changes and reports domain changes, category moves and formula changes with original records', () => {
    const changed = structuredClone(catalog);
    changed.packageLabel = 'another label';
    changed.extractorVersion = 'next';
    changed.source['fileName'] = 'renamed.exe';
    expect(array(compare(catalog, changed)['changed'])).toHaveLength(0);
    at(changed.parameters, 0).name = 'Renamed parameter';
    at(changed.parameters, 1).multiply = '2.0';
    array(at(changed.sets, 0)['parameterIds']).push(99999);
    at(changed.profiles, 0)['setId'] = 9999;
    expect(array(compare(catalog, changed)['changed'])).toHaveLength(4);
    at(changed.parameters, 0).category = 'new category';
    const moved = compare(catalog, changed);
    expect(array(moved['added'])).toHaveLength(1);
    expect(array(moved['removed'])).toHaveLength(1);
    const formulas = structuredClone(catalog),
      parameter = at(
        formulas.parameters.filter((parameter) => parameter.sourceKey !== 'monitor'),
        0,
      ),
      cells = object(parameter.details['cells']),
      cell = object(cells['B']),
      formula = object(cell['formula']);
    formula['text'] = 'DEC2HEX(A3+1)';
    formula['sharedAnchor'] = { ...object(formula['sharedAnchor']), text: 'DEC2HEX(A3+1)' };
    cell['formula'] = formula;
    cells['B'] = cell;
    parameter.details['cells'] = cells;
    const report = compare(catalog, formulas);
    expect(array(report['changed']).length).toBeGreaterThan(0);
    const difference = object(at(array(report['changed']), 0));
    const after = object(difference['after']);
    expect(object(at(array(after['records']), 0))['details']).toBeDefined();
  });
  it('preserves duplicate memberships and rejects broken profile references or duplicate vendor IDs', () => {
    const changed = structuredClone(catalog),
      set = at(changed.sets, 0),
      id = number(at(array(set['parameterIds']), 0));
    array(set['parameterIds']).push(id);
    reconcile(changed);
    const mapping = at(
      changed.mappings.filter((mapping) => mapping['parameterId'] === id),
      0,
    );
    expect(
      array(mapping['setIds']).filter((value) => value === set['vendorId']).length,
    ).toBeGreaterThan(1);
    at(changed.profiles, 0)['setId'] = -1;
    expect(() => {
      reconcile(changed);
    }).toThrow('Unresolved profile');
    changed.profiles = catalog.profiles;
    changed.sets.push(structuredClone(set));
    expect(() => {
      reconcile(changed);
    }).toThrow('Duplicate sets');
  });
  it('preserves legacy double conversion text', () => {
    expect([1, -0, 0.001, 0.00001, 1e16, -1e-7].map(floatText)).toEqual([
      '1.0',
      '-0.0',
      '0.001',
      '1e-05',
      '1e+16',
      '-1e-07',
    ]);
  });
  it('supports direct inspect/extract/diff commands and refuses output overwrites or invalid arguments', () => {
    const out = join(scratch, 'cli-output'),
      result = cli(['extract', input, '--label', 'v9.56', '--out', out]);
    expect(result.status).toBe(0);
    expect(
      readFileSync(join(out, 'catalog.json')).equals(readFileSync(join(committed, 'catalog.json'))),
    ).toBe(true);
    expect(cli(['extract', input, '--label', 'v9.56', '--out', out]).status).toBe(1);
    const inspection = cli(['inspect', input]);
    expect(inspection.status).toBe(0);
    const parsed: unknown = JSON.parse(inspection.stdout);
    expect(array(object(parsed)['workbooks'])).toHaveLength(2);
    const report = join(scratch, 'diff.json');
    expect(
      cli(['diff', join(committed, 'catalog.json'), join(out, 'catalog.json'), '--out', report])
        .status,
    ).toBe(0);
    const diff: unknown = JSON.parse(readFileSync(report, 'utf8'));
    expect(array(object(diff)['changed'])).toHaveLength(0);
    expect(
      cli(['diff', join(committed, 'catalog.json'), join(out, 'catalog.json'), '--out', report])
        .status,
    ).toBe(1);
    const bad = join(scratch, 'bad.exe');
    writeFileSync(bad, readFileSync(input).subarray(0, 32));
    const invalidOut = join(scratch, 'invalid-output');
    expect(cli(['extract', bad, '--label', 'test', '--out', invalidOut]).status).toBe(1);
    expect(existsSync(invalidOut)).toBe(false);
    expect(cli(['inspect', input, '--unknown']).status).toBe(1);
    expect(string(object(object(parsed)['source'])['sha256'])).toBe(catalog.source['sha256']);
    requireValue(existsSync(input), 'Source must remain intact');
  });
});
