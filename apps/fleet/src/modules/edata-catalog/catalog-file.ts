import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';

export class CatalogValidationError extends Error {}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CatalogValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  check(isRecord(value), 'Expected a catalog object');
  return value;
}

function list(value: unknown): unknown[] {
  check(Array.isArray(value), 'Expected a catalog array');
  return value;
}

function text(value: unknown): string {
  check(
    typeof value === 'string' && value.length > 0 && !value.includes('\0'),
    'Invalid catalog text',
  );
  return value;
}

function integer(value: unknown): number {
  check(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647,
    'Invalid catalog integer',
  );
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function json(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(json);
  return jsonObject(value);
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(record(value)).map(([key, entry]) => [key, json(entry)]),
  );
}

function unique(values: (string | number)[], label: string) {
  check(new Set(values).size === values.length, `Duplicate ${label}`);
}

export function parseCatalog(bytes: Buffer) {
  const document: unknown = JSON.parse(bytes.toString('utf8'));
  const root = record(document);
  check(root.schemaVersion === 1, 'Unsupported catalog schema version');
  const extractorVersion = text(root.extractorVersion);
  const packageLabel = text(root.packageLabel);
  check(
    extractorVersion.length <= 32 && packageLabel.length <= 64,
    'Catalog version text is too long',
  );
  const source = record(root.source);
  const sourceSha256 = text(source.sha256);
  check(/^[a-f0-9]{64}$/.test(sourceSha256), 'Invalid EXE SHA-256');
  text(source.fileName);
  integer(source.bytes);
  const sources = list(root.sources).map((value) => {
    const item = record(value);
    const kind = text(item.kind);
    check(kind === 'monitor' || kind === 'workbook', 'Unsupported catalog source');
    return { key: text(item.key), kind, evidence: jsonObject(item.evidence) };
  });
  unique(
    sources.map((s) => s.key),
    'source keys',
  );
  check(
    sources.filter((s) => s.kind === 'monitor' && s.key === 'monitor').length === 1 &&
      sources.some((s) => s.kind === 'workbook'),
    'Incomplete source coverage',
  );
  const sourceKeys = new Set(sources.map((s) => s.key));
  const parameters = list(root.parameters).map((value) => {
    const item = record(value);
    const sourceKey = text(item.sourceKey);
    check(sourceKeys.has(sourceKey), 'Unknown parameter source');
    const details = record(item.details);
    list(details.issues).forEach(text);
    return {
      key: text(item.key),
      sourceKey,
      parameterId: integer(item.parameterId),
      category: text(item.category),
      name: text(item.name),
      multiply: nullableText(item.multiply),
      offset: nullableText(item.offset),
      details: jsonObject(details),
    };
  });
  unique(
    parameters.map((p) => p.key),
    'parameter keys',
  );
  check(
    parameters.length > 0 && sources.every((s) => parameters.some((p) => p.sourceKey === s.key)),
    'Empty parameter source',
  );
  const sets = list(root.sets).map((value) => {
    const item = record(value);
    const details = record(item.details);
    for (const field of [
      'canBaudCode',
      'isObdUnit',
      'silentMode',
      'obdProtocolsMask',
      'regularProtocolsMask',
    ])
      check(integer(details[field]) <= 255, 'Invalid set default byte');
    const parameterIds = list(item.parameterIds).map(integer);
    const rawIds = text(details.rawParameterIds);
    check(
      /^\d+(?:,\d+)*,?$/.test(rawIds) &&
        JSON.stringify(rawIds.split(',').filter(Boolean).map(Number)) ===
          JSON.stringify(parameterIds),
      'Set membership does not match source',
    );
    return { vendorId: integer(item.vendorId), details: jsonObject(details), parameterIds };
  });
  const categories = list(root.categories).map((value) => {
    const item = record(value);
    return { vendorId: integer(item.vendorId), name: text(item.name) };
  });
  const profiles = list(root.profiles).map((value) => {
    const item = record(value);
    const profile = {
      vendorId: integer(item.vendorId),
      setId: integer(item.setId),
      categoryId: integer(item.categoryId),
      name: text(item.name),
    };
    check(
      sets.some((s) => s.vendorId === profile.setId) &&
        categories.some((c) => c.vendorId === profile.categoryId),
      'Unresolved profile reference',
    );
    return profile;
  });
  for (const rows of [sets, categories, profiles]) {
    check(rows.length > 0, 'Empty Monitor table');
    unique(
      rows.map((r) => r.vendorId),
      'vendor IDs',
    );
  }
  const memberships = sets.flatMap((s) =>
    s.parameterIds.map((parameterId, position) => ({ setId: s.vendorId, parameterId, position })),
  );
  const coverage = record(root.coverage);
  check(coverage.complete === true, 'Catalog extraction is incomplete');
  for (const [name, count] of Object.entries({
    sources: sources.length,
    parameters: parameters.length,
    sets: sets.length,
    memberships: memberships.length,
    categories: categories.length,
    profiles: profiles.length,
  }))
    check(coverage[name] === count, `Invalid coverage count: ${name}`);
  const issues = list(root.issues);
  const issueCounts: Record<string, number> = {};
  for (const value of issues) {
    const kind = text(record(value).kind);
    issueCounts[kind] = (issueCounts[kind] ?? 0) + 1;
  }
  const declaredIssues = record(coverage.issues);
  check(
    Object.keys(declaredIssues).length === Object.keys(issueCounts).length &&
      Object.entries(issueCounts).every(([kind, count]) => declaredIssues[kind] === count),
    'Invalid issue counts',
  );
  const mappings = list(root.mappings);
  const mappedIds = mappings.map((value) => integer(record(value).parameterId));
  unique(mappedIds, 'mapping IDs');
  const allIds = new Set([
    ...parameters.map((p) => p.parameterId),
    ...memberships.map((m) => m.parameterId),
  ]);
  check(
    mappedIds.length === allIds.size && mappedIds.every((id) => allIds.has(id)),
    'Incomplete parameter mappings',
  );
  return {
    sourceSha256,
    extractorVersion,
    schemaVersion: 1,
    packageLabel,
    contentSha256: createHash('sha256').update(bytes.toString('utf8').trimEnd()).digest('hex'),
    metadata: jsonObject({ source, coverage, issues, mappings }),
    sources,
    parameters,
    sets: sets.map(({ parameterIds: _parameterIds, ...s }) => s),
    categories,
    profiles,
    memberships,
    counts: {
      sources: sources.length,
      parameters: parameters.length,
      sets: sets.length,
      memberships: memberships.length,
      categories: categories.length,
      profiles: profiles.length,
      issues: issues.length,
    },
  };
}

export type Catalog = ReturnType<typeof parseCatalog>;
