import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { check, type Catalog } from './catalog-file.js';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function sameRows(actual: unknown[], expected: unknown[], label: string) {
  check(
    stable(actual.map(stable).sort()) === stable(expected.map(stable).sort()),
    `Stored ${label} differ from the reviewed catalog`,
  );
}

export async function verifyCatalog(
  client: Prisma.TransactionClient,
  catalogId: string,
  catalog: Catalog,
) {
  const where = { catalogId };
  const [release, sources, parameters, sets, memberships, categories, profiles] = await Promise.all(
    [
      client.edataCatalog.findUniqueOrThrow({ where: { id: catalogId } }),
      client.edataCatalogSource.findMany({ where, omit: { catalogId: true } }),
      client.edataCatalogParameter.findMany({ where, omit: { catalogId: true } }),
      client.edataCatalogSet.findMany({ where, omit: { catalogId: true } }),
      client.edataCatalogSetMember.findMany({ where, omit: { catalogId: true } }),
      client.edataCatalogCategory.findMany({ where, omit: { catalogId: true } }),
      client.edataCatalogProfile.findMany({ where, omit: { catalogId: true } }),
    ],
  );
  check(
    release.contentSha256 === catalog.contentSha256 &&
      release.packageLabel === catalog.packageLabel &&
      stable(release.metadata) === stable(catalog.metadata),
    'Stored catalog metadata differs',
  );
  for (const [actual, expected, label] of [
    [sources, catalog.sources, 'sources'],
    [parameters, catalog.parameters, 'parameters'],
    [sets, catalog.sets, 'sets'],
    [memberships, catalog.memberships, 'memberships'],
    [categories, catalog.categories, 'categories'],
    [profiles, catalog.profiles, 'profiles'],
  ] satisfies [unknown[], unknown[], string][])
    sameRows(actual, expected, label);
}

export async function importCatalog(client: PrismaClient, catalog: Catalog, write = false) {
  const identity = {
    sourceSha256: catalog.sourceSha256,
    extractorVersion: catalog.extractorVersion,
    schemaVersion: catalog.schemaVersion,
  };
  async function existing(tx: Prisma.TransactionClient) {
    const row = await tx.edataCatalog.findUnique({
      where: { sourceSha256_extractorVersion_schemaVersion: identity },
    });
    if (row) {
      check(
        row.contentSha256 === catalog.contentSha256,
        'This EXE/extractor/schema identity already has different content; inspect the change and revise the extractor version',
      );
      await verifyCatalog(tx, row.id, catalog);
    }
    return row;
  }
  if (!write) {
    const row = await existing(client);
    return {
      action: row ? 'verified' : 'would_insert',
      catalogId: row?.id ?? null,
      counts: catalog.counts,
    };
  }
  return client.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(identity)}, 0))::text`;
      const row = await existing(tx);
      if (row) return { action: 'verified', catalogId: row.id, counts: catalog.counts };
      const release = await tx.edataCatalog.create({
        data: {
          ...identity,
          contentSha256: catalog.contentSha256,
          packageLabel: catalog.packageLabel,
          metadata: catalog.metadata,
        },
      });
      const catalogId = release.id;
      await tx.edataCatalogSource.createMany({
        data: catalog.sources.map((s) => ({ catalogId, ...s })),
      });
      await tx.edataCatalogParameter.createMany({
        data: catalog.parameters.map((p) => ({ catalogId, ...p })),
      });
      await tx.edataCatalogSet.createMany({ data: catalog.sets.map((s) => ({ catalogId, ...s })) });
      await tx.edataCatalogSetMember.createMany({
        data: catalog.memberships.map((m) => ({ catalogId, ...m })),
      });
      await tx.edataCatalogCategory.createMany({
        data: catalog.categories.map((c) => ({ catalogId, ...c })),
      });
      await tx.edataCatalogProfile.createMany({
        data: catalog.profiles.map((p) => ({ catalogId, ...p })),
      });
      await verifyCatalog(tx, catalogId, catalog);
      return { action: 'inserted', catalogId, counts: catalog.counts };
    },
    { timeout: 60000, maxWait: 10000 },
  );
}
