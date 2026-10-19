/** Static Simple eData Monitor extraction. Never loads or executes the EXE. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { PortableExecutable, resourceInventory, slice } from './binary.mjs';
import { array, canonical, number, object, requireValue, sha256, string } from './data.mjs';
import type { Catalog, Json, JsonObject, Parameter } from './data.mjs';
import { metadata, monitorRecords } from './monitor.mjs';
import { workbookRecords } from './workbook.mjs';

export function inventory(path: string) {
  const raw = readFileSync(path),
    pe = new PortableExecutable(raw),
    model = metadata(pe);
  const { resources, versions, workbooks } = resourceInventory(pe);
  const source: JsonObject = {
    fileName: basename(path),
    sha256: sha256(raw),
    bytes: raw.length,
    machine: pe.machine,
    binaryVersionInfo: versions,
    assemblyIdentity: model.assemblies,
    managedResources: model.resources,
    nativeResources: resources,
  };
  return { pe, model, source, workbooks };
}
export function reconcile(catalog: Catalog): void {
  const issues: JsonObject[] = [],
    mappings: JsonObject[] = [],
    byId = new Map<number, Parameter[]>(),
    membership = new Map<number, number[]>();
  for (const set of catalog.sets)
    for (const id of array(set['parameterIds'])) {
      const key = number(id),
        members = membership.get(key) ?? [];
      members.push(number(set['vendorId']));
      membership.set(key, members);
    }
  for (const parameter of catalog.parameters) {
    const records = byId.get(parameter.parameterId) ?? [];
    records.push(parameter);
    byId.set(parameter.parameterId, records);
    for (const issue of array(parameter.details['issues']))
      issues.push({ kind: string(issue), parameterKey: parameter.key });
  }
  for (const id of [...new Set([...byId.keys(), ...membership.keys()])].sort((a, b) => a - b)) {
    const records = byId.get(id) ?? [],
      monitor = records.filter((record) => record.sourceKey === 'monitor'),
      workbook = records.filter((record) => record.sourceKey !== 'monitor'),
      setIds = membership.get(id) ?? [];
    mappings.push({
      parameterId: id,
      monitorCandidates: monitor.map((record) => ({ key: record.key, category: record.category })),
      workbookCandidates: workbook.map((record) => ({
        key: record.key,
        category: record.category,
      })),
      setIds,
      matchBasis: 'id_only',
      deviceSupport: 'unverified',
      karmaMapping: 'unverified',
    });
    if (!monitor.length && setIds.length)
      issues.push({ kind: 'set_member_without_monitor_definition', parameterId: id, setIds });
    if (!monitor.length || !workbook.length)
      issues.push({
        kind: 'source_coverage_difference',
        parameterId: id,
        missing: monitor.length ? 'workbook' : 'monitor',
      });
  }
  for (const key of ['sets', 'profiles', 'categories']) {
    const ids = array(catalog[key]).map((row) => number(object(row)['vendorId']));
    requireValue(ids.length === new Set(ids).size, `Duplicate ${key} IDs`);
  }
  const sets = new Set(catalog.sets.map((row) => number(row['vendorId']))),
    categories = new Set(catalog.categories.map((row) => number(row['vendorId'])));
  requireValue(
    catalog.profiles.every(
      (profile) =>
        sets.has(number(profile['setId'])) && categories.has(number(profile['categoryId'])),
    ),
    'Unresolved profile references',
  );
  const counts: JsonObject = {};
  for (const issue of issues) {
    const kind = string(issue['kind']);
    counts[kind] = number(counts[kind] ?? 0) + 1;
  }
  catalog.mappings = mappings;
  catalog.issues = issues;
  catalog.coverage = {
    complete: true,
    sources: catalog.sources.length,
    parameters: catalog.parameters.length,
    sets: sets.size,
    memberships: catalog.sets.reduce((total, row) => total + array(row['parameterIds']).length, 0),
    profiles: catalog.profiles.length,
    categories: categories.size,
    issues: Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  };
}
export function extract(path: string, label: string): Catalog {
  const { pe, model, source, workbooks } = inventory(path),
    monitor = monitorRecords(pe, model);
  const catalog: Catalog = {
    schemaVersion: 1,
    extractorVersion: '1.0.0',
    packageLabel: label,
    source,
    sources: [monitor.source],
    parameters: monitor.parameters,
    sets: monitor.sets,
    profiles: monitor.profiles,
    categories: monitor.categories,
    mappings: [],
    issues: [],
    coverage: {},
  };
  for (const book of workbooks) {
    const workbook = workbookRecords(book);
    catalog.sources.push(workbook.source);
    catalog.parameters.push(...workbook.parameters);
  }
  reconcile(catalog);
  return catalog;
}
// Semantic identities retain schema 1's spaced, ASCII-escaped JSON strings.
function identity(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(identity).join(', ')}]`;
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
function semanticRecords(catalog: JsonObject): Map<string, JsonObject> {
  const sourceNames = new Map(
    array(catalog['sources']).map((value) => {
      const source = object(value),
        evidence = object(source['evidence']);
      return [
        string(source['key']),
        array(evidence['locations'] ?? [])
          .map(object)
          .filter((location) => location['kind'] === 'resource')
          .map((location) => string(location['path']))
          .sort(),
      ];
    }),
  );
  const groups = new Map<string, JsonObject[]>(),
    result = new Map<string, JsonObject>();
  for (const value of array(catalog['parameters'])) {
    const parameter = object(value),
      key = string(parameter['sourceKey']),
      names = sourceNames.get(key);
    requireValue(names, 'Missing parameter source');
    const origin = key === 'monitor' ? 'monitor' : identity(names.length ? names : [key]),
      id = identity([
        'parameter',
        origin,
        string(parameter['category']),
        number(parameter['parameterId']),
      ]);
    const records = groups.get(id) ?? [];
    records.push(parameter);
    groups.set(id, records);
  }
  for (const [key, records] of groups) {
    const values = records.map((parameter) => {
      const details = object(parameter['details']),
        formulas: JsonObject = {};
      for (const [column, value] of Object.entries(object(details['cells'] ?? {}))) {
        const cell = object(value);
        if (cell['formula'] === undefined) continue;
        const formula = object(cell['formula']),
          anchor = object(
            formula['sharedAnchor'] ?? {
              cell: string(cell['address']),
              text: formula['text'] ?? null,
            },
          );
        let expression = anchor['text'] ?? null;
        const originRow = /[0-9]+$/.exec(string(anchor['cell']));
        requireValue(originRow, 'Invalid formula cell');
        if (expression === `DEC2HEX(A${originRow[0]})`) expression = 'DEC2HEX(parameterId)';
        formulas[column] = expression;
      }
      return {
        name: parameter['name'] ?? null,
        multiply: parameter['multiply'] ?? null,
        offset: parameter['offset'] ?? null,
        sourceHex: details['sourceHex'] ?? null,
        issues: array(details['issues']),
        formulas,
      };
    });
    // CPython sorts canonical UTF-8 bytes, rather than locale or UTF-16 order.
    values.sort((a, b) => Buffer.compare(Buffer.from(canonical(a)), Buffer.from(canonical(b))));
    result.set(key, { value: values, records });
  }
  for (const kind of ['sets', 'profiles', 'categories'])
    for (const value of array(catalog[kind])) {
      const row = object(value);
      result.set(identity([kind, number(row['vendorId'])]), { value: row, records: [row] });
    }
  return result;
}
export function compare(before: JsonObject, after: JsonObject): JsonObject {
  const old = semanticRecords(before),
    current = semanticRecords(after),
    added: JsonObject[] = [],
    removed: JsonObject[] = [],
    changed: JsonObject[] = [];
  for (const key of [...current.keys()].filter((key) => !old.has(key)).sort())
    added.push({ identity: key, after: current.get(key) ?? null });
  for (const key of [...old.keys()].filter((key) => !current.has(key)).sort())
    removed.push({ identity: key, before: old.get(key) ?? null });
  for (const key of [...old.keys()].filter((key) => current.has(key)).sort()) {
    const previous = old.get(key),
      next = current.get(key);
    requireValue(previous && next, 'Missing comparison record');
    if (canonical(previous['value'] ?? null) !== canonical(next['value'] ?? null))
      changed.push({ identity: key, before: previous, after: next });
  }
  const oldSource = object(before['source']),
    newSource = object(after['source']);
  return {
    before: string(oldSource['sha256']),
    after: string(newSource['sha256']),
    added,
    removed,
    changed,
    sourceRecords: { before: oldSource, after: newSource },
    issuesBefore: array(before['issues']),
    issuesAfter: array(after['issues']),
  };
}
export function markdown(catalog: Catalog): string {
  const lines = [
    `# Simple eData Monitor catalog ${catalog.packageLabel}`,
    '',
    `Source: \`${string(catalog.source['fileName'])}\`; SHA-256 \`${string(catalog.source['sha256'])}\`.`,
    '',
    `Extractor ${catalog.extractorVersion}; schema ${String(catalog.schemaVersion)}. The EXE was inspected statically and never executed.`,
    '',
    '[Complete source records and mappings](catalog.json). [Regeneration procedure](../README.md).',
    '',
    '## Coverage',
    '',
    '| Source | Category/sheet | Records |',
    '| --- | --- | ---: |',
  ];
  for (const source of catalog.sources) {
    if (source['kind'] === 'workbook') {
      const evidence = object(source['evidence']),
        locations =
          array(evidence['locations'])
            .map(object)
            .filter((location) => location['kind'] === 'resource')
            .map((location) => string(location['path']))
            .join(', ') || string(source['key']);
      for (const sheet of array(evidence['sheets']).map(object))
        lines.push(
          `| ${locations} | ${string(sheet['name'])} | ${String(number(sheet['rows']))} |`,
        );
    } else {
      const counts = new Map<string, number>();
      for (const parameter of catalog.parameters.filter(
        (parameter) => parameter.sourceKey === 'monitor',
      ))
        counts.set(parameter.category, (counts.get(parameter.category) ?? 0) + 1);
      for (const category of [...counts.keys()].sort())
        lines.push(`| Monitor | ${category} | ${String(counts.get(category))} |`);
    }
  }
  lines.push(
    '',
    `Parameter sets: ${String(catalog.sets.length)}; profiles: ${String(catalog.profiles.length)}; categories: ${String(catalog.categories.length)}.`,
    '',
    '## Profiles',
    '',
    '| ID | Name | Set | Category |',
    '| --- | --- | --- | --- |',
  );
  for (const profile of catalog.profiles)
    lines.push(
      `| ${String(number(profile['vendorId']))} | ${string(profile['name'])} | ${String(number(profile['setId']))} | ${String(number(profile['categoryId']))} |`,
    );
  lines.push(
    '',
    '## Source qualifications',
    '',
    '- Both different workbooks are retained; their runtime purpose is unresolved. Identical archives are deduplicated by SHA-256 while every discovered location is retained.',
    '- IDs are not globally unique. Mappings contain candidates matched by ID only; category equivalence, Karma correspondence and device support are unverified.',
    '- Cached formula values and shared formula anchors are preserved, not recalculated. Decimal/hex disagreements are retained.',
    '- Display multipliers/offsets do not define CAN decoding or prove units. Profile labels and stored baud defaults are independent source facts.',
    '- This is a vendor catalog, not device configuration, firmware detection or evidence of live measurements. No device commands are generated.',
    '',
    '## Issues',
    '',
  );
  for (const [kind, count] of Object.entries(object(catalog.coverage['issues'])))
    lines.push(`- \`${kind}\`: ${String(number(count))}.`);
  return `${lines.join('\n')}\n`;
}
export function main(args = process.argv.slice(2)): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { label: { type: 'string' }, out: { type: 'string' } },
  });
  const [command, input, after] = positionals;
  requireValue(
    input && ['inspect', 'extract', 'diff'].includes(command ?? ''),
    'Usage: catalog.mts inspect EXE | extract EXE --label LABEL --out FRESH_DIRECTORY | diff BEFORE AFTER --out FRESH_FILE',
  );
  if (command === 'inspect') {
    requireValue(
      positionals.length === 2 && values.label === undefined && values.out === undefined,
      'Invalid inspect arguments',
    );
    const { pe, model, source, workbooks } = inventory(input),
      monitor = monitorRecords(pe, model);
    const summaries = workbooks.map((book) => {
      const workbook = workbookRecords(book);
      return { ...workbook.source, parameters: workbook.parameters.length };
    });
    console.log(
      JSON.stringify(
        {
          source,
          workbooks: summaries,
          monitor: monitor.source,
          counts: {
            parameters: monitor.parameters.length,
            sets: monitor.sets.length,
            profiles: monitor.profiles.length,
            categories: monitor.categories.length,
          },
        },
        null,
        2,
      ),
    );
  } else if (command === 'extract') {
    requireValue(
      positionals.length === 2 && values.label && values.out,
      'extract requires --label and --out',
    );
    const out = values.out;
    requireValue(!existsSync(out), 'Output directory already exists; use a fresh directory');
    const catalog = extract(input, values.label),
      raw = readFileSync(input);
    requireValue(sha256(raw) === catalog.source['sha256'], 'EXE changed during extraction');
    const workbooks = catalog.sources
      .filter((source) => source['kind'] === 'workbook')
      .map((source) => {
        const locations = array(object(source['evidence'])['locations']),
          location = object(locations[0]);
        const payload = slice(raw, number(location['offset']), number(location['bytes'])),
          key = string(source['key']);
        requireValue(sha256(payload) === key, 'Workbook source location does not match its hash');
        return { key, payload };
      });
    mkdirSync(out, { recursive: true });
    mkdirSync(join(out, 'workbooks'));
    for (const book of workbooks)
      writeFileSync(join(out, 'workbooks', `${book.key}.xlsx`), book.payload, { flag: 'wx' });
    const content = canonical(catalog),
      contentSha256 = sha256(content);
    writeFileSync(join(out, 'catalog.json'), `${content}\n`, { flag: 'wx' });
    writeFileSync(join(out, 'README.md'), markdown(catalog), { flag: 'wx' });
    writeFileSync(
      join(out, 'run.json'),
      `${JSON.stringify({ analyzedAtUtc: new Date().toISOString(), contentSha256 }, null, 2)}\n`,
      { flag: 'wx' },
    );
    console.log(JSON.stringify({ contentSha256, coverage: catalog.coverage }, null, 2));
  } else {
    requireValue(
      positionals.length === 3 && after && values.out && values.label === undefined,
      'diff requires BEFORE AFTER --out',
    );
    const beforeValue: unknown = JSON.parse(readFileSync(input, 'utf8')),
      afterValue: unknown = JSON.parse(readFileSync(after, 'utf8')),
      report = compare(object(beforeValue), object(afterValue));
    writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(
      JSON.stringify({
        added: array(report['added']).length,
        removed: array(report['removed']).length,
        changed: array(report['changed']).length,
      }),
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(
      `Catalog extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
