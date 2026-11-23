import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { parse } from 'dotenv';
import pg from 'pg';
import { isContactEmail } from '../apps/sales-api/src/contacts/contact-email.js';
import { normalizeContactPhone } from '../apps/sales-api/src/contacts/contact-phone.js';

const initialSnapshot = '20260821T075453Z';
const sourceSystem = 'red.bg';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const roles = new Set(['owner', 'manager', 'employee', 'technical', 'unknown']);

interface LeadFields {
  displayName: string | null;
  websiteUrl: string | null;
  sourceName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ContactFields {
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  isPrimary: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SourceTimes {
  createdAt: string | null;
  updatedAt: string | null;
}
type SourceLead = Omit<LeadFields, keyof SourceTimes> & SourceTimes & { id: string };
type SourceContact = Omit<ContactFields, keyof SourceTimes | 'isPrimary'> &
  SourceTimes & {
    id: string;
    crmLeadId: string | null;
    isPrimary: string | null;
  };
type Entity = 'lead' | 'contact';

interface KnownMapping {
  sourceId: string;
  targetId: string;
  sourceFingerprint: string;
  targetFingerprint: string;
  liveFingerprint: string | null;
  liveParentId?: string;
}

interface Addition {
  sourceId: string;
  targetId: string;
  sourceFingerprint: string;
  targetFingerprint: string;
}

function totals(source: number) {
  return {
    source,
    plannedInserts: 0,
    inserted: 0,
    alreadyPresent: 0,
    unchanged: 0,
    sourceChanged: 0,
    operatorEdited: 0,
    bothChanged: 0,
    missingFromSnapshot: 0,
    rejected: {
      invalidRecord: 0,
      missingParent: 0,
      missingTarget: 0,
      wrongParent: 0,
      primaryConflict: 0,
    },
  };
}
type Totals = ReturnType<typeof totals>;

function summarize({ rejected: reasons, ...counts }: Totals) {
  return {
    ...counts,
    rejected: Object.values(reasons).reduce((sum, count) => sum + count, 0),
    reasons,
  };
}

class ImportFailure extends Error {}

function options() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean' },
      apply: { type: 'boolean' },
      snapshot: { type: 'string' },
      'expected-tenant': { type: 'string' },
    },
  });
  const { snapshot, 'expected-tenant': tenantId } = values;
  if (
    !snapshot ||
    !/^\d{8}T\d{6}Z$/u.test(snapshot) ||
    snapshot < initialSnapshot ||
    !tenantId ||
    !uuid.test(tenantId) ||
    (values.apply && values['dry-run'])
  ) {
    throw new ImportFailure('invalid_arguments');
  }
  return {
    apply: values.apply === true,
    snapshot,
    tenantId: tenantId.toLowerCase(),
    schema: `red_bg_${snapshot.slice(0, 8)}`,
  };
}

function databaseUrl(value: string | undefined, database: string, role?: string): URL {
  const url = URL.parse(value ?? '');
  if (
    !url ||
    url.protocol !== 'postgresql:' ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== `/${database}` ||
    !url.username ||
    (role && url.username !== role) ||
    url.hash ||
    (url.search && (!role || url.search !== '?schema=public'))
  ) {
    throw new ImportFailure(
      role ? 'invalid_target_configuration' : 'invalid_staging_configuration',
    );
  }
  url.search = '';
  return url;
}

async function verifiedActor(tenantId: string): Promise<string> {
  const bearer = process.env.HOLITA_SALES_IMPORT_BEARER;
  if (!bearer) {
    throw new ImportFailure('missing_sales_bearer');
  }
  const response = await fetch('http://127.0.0.1:12010/graphql', {
    method: 'POST',
    redirect: 'error',
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'query SalesImportActor { salesWorkspaceAccess { tenantId userId } }',
    }),
  });
  const payload: unknown = await response.json();
  if (
    !response.ok ||
    !payload ||
    typeof payload !== 'object' ||
    'errors' in payload ||
    !('data' in payload) ||
    !payload.data ||
    typeof payload.data !== 'object' ||
    !('salesWorkspaceAccess' in payload.data)
  ) {
    throw new ImportFailure('sales_access_failed');
  }
  const actor = payload.data.salesWorkspaceAccess;
  if (
    !actor ||
    typeof actor !== 'object' ||
    !('tenantId' in actor) ||
    actor.tenantId !== tenantId ||
    !('userId' in actor) ||
    typeof actor.userId !== 'string' ||
    !uuid.test(actor.userId)
  ) {
    throw new ImportFailure('unexpected_sales_identity');
  }
  return actor.userId.toLowerCase();
}

async function stagedColumns(
  client: pg.Client,
  schema: string,
  table: 'leads' | 'contacts',
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const { rows } = await client.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = ANY($3::text[])`,
    [schema, table, [...required, ...optional]],
  );
  const columns = new Set(rows.map((row) => row.column_name));
  if (required.some((name) => !columns.has(name)) || rows.some((row) => row.data_type !== 'text')) {
    throw new ImportFailure('staging_projection_mismatch');
  }
  return columns;
}

type Unsupported = Record<
  'leadNotes' | 'legacyCreatorsWithoutMatch' | 'assignmentsPending',
  number
>;

async function readStaging(client: pg.Client, settings: ReturnType<typeof options>) {
  const { schema, snapshot } = settings;
  const leads = `"${schema}"."leads"`;
  const contacts = `"${schema}"."contacts"`;
  const columns = await stagedColumns(
    client,
    schema,
    'leads',
    ['id', 'displayName', 'websiteUrl', 'sourceName', 'createdAt', 'updatedAt'],
    ['notes', 'createdBySalesUserId', 'responsibleSalesUserId'],
  );
  await stagedColumns(client, schema, 'contacts', [
    'id',
    'crmLeadId',
    'name',
    'phone',
    'email',
    'role',
    'isPrimary',
    'notes',
    'createdAt',
    'updatedAt',
  ]);
  const {
    rows: [access],
  } = await client.query<{ database: string; snapshot: string | null; writable: boolean }>(
    `SELECT current_database() AS database,
            obj_description(to_regnamespace($1), 'pg_namespace') AS snapshot,
            has_schema_privilege($1, 'CREATE')
            OR has_table_privilege($2, 'INSERT, UPDATE, DELETE, TRUNCATE')
            OR has_table_privilege($3, 'INSERT, UPDATE, DELETE, TRUNCATE')
            OR has_any_column_privilege($2, 'INSERT, UPDATE')
            OR has_any_column_privilege($3, 'INSERT, UPDATE') AS writable`,
    [schema, leads, contacts],
  );
  if (access?.database !== 'holita_sales_import' || access.writable) {
    throw new ImportFailure('staging_read_only_role_required');
  }
  if (access.snapshot !== snapshot) {
    throw new ImportFailure('staging_snapshot_mismatch');
  }
  const {
    rows: [counts],
  } = await client.query<{ leads: number; contacts: number }>(
    `SELECT (SELECT count(*)::int FROM ${leads}) AS leads,
            (SELECT count(*)::int FROM ${contacts}) AS contacts`,
  );
  if (
    !counts ||
    (snapshot === initialSnapshot && (counts.leads !== 23 || counts.contacts !== 24))
  ) {
    throw new ImportFailure('unexpected_staging_totals');
  }
  const {
    rows: [unsupported],
  } = await client.query<Unsupported>(
    `SELECT ${columns.has('notes') ? "count(*) FILTER (WHERE btrim(notes) <> '')::int" : '0'} AS "leadNotes",
            ${columns.has('createdBySalesUserId') ? 'count("createdBySalesUserId")::int' : '0'} AS "legacyCreatorsWithoutMatch",
            ${columns.has('responsibleSalesUserId') ? 'count("responsibleSalesUserId")::int' : '0'} AS "assignmentsPending"
     FROM ${leads}`,
  );
  const { rows: leadRows } = await client.query<SourceLead>(
    `SELECT lower(id) AS id, "displayName", "websiteUrl", "sourceName", "createdAt", "updatedAt"
     FROM ${leads} ORDER BY id`,
  );
  const { rows: contactRows } = await client.query<SourceContact>(
    `SELECT lower(id) AS id, lower("crmLeadId") AS "crmLeadId",
            name, phone, email, role, "isPrimary", notes, "createdAt", "updatedAt"
     FROM ${contacts} ORDER BY id`,
  );
  return { leadRows, contactRows, unsupported };
}

function clean(value: string | null) {
  return value?.trim() || null;
}

function validText(value: string | null, maximum: number) {
  return !value || (!value.includes('\u0000') && Array.from(value).length <= maximum);
}

function parseTimestamp(value: string | null): Date | null {
  // Staging keeps PostgreSQL COPY text. Round fractional seconds to the target's precision.
  const match =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/u.exec(
      value ?? '',
    );
  const [, date, time, fraction = '', timezone = 'Z'] = match ?? [];
  if (!date || !time || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/u.test(time)) {
    return null;
  }
  const midnight = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date) {
    return null;
  }
  const offset = timezone.length === 3 ? `${timezone}:00` : timezone;
  const seconds = Date.parse(`${date}T${time}${offset}`);
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds + Math.round(Number(fraction.padEnd(6, '0')) / 1000));
}

function normalizedLead(row: SourceLead): LeadFields | null {
  const displayName = clean(row.displayName);
  const websiteUrl = clean(row.websiteUrl);
  const sourceName = clean(row.sourceName);
  const createdAt = parseTimestamp(row.createdAt);
  const updatedAt = parseTimestamp(row.updatedAt);
  if (
    !uuid.test(row.id) ||
    !createdAt ||
    !updatedAt ||
    (!displayName && !websiteUrl) ||
    !validText(displayName, 255) ||
    !validText(websiteUrl, 2048) ||
    !validText(sourceName, 255) ||
    (websiteUrl && (!/^https?:\/\/[^/\s\\]/iu.test(websiteUrl) || !URL.parse(websiteUrl)?.hostname))
  ) {
    return null;
  }
  return { displayName, websiteUrl, sourceName, createdAt, updatedAt };
}

function normalizedContact(row: SourceContact): ContactFields | null {
  const name = clean(row.name);
  const email = clean(row.email);
  const notes = clean(row.notes);
  const rawPhone = clean(row.phone);
  const phone = rawPhone === null ? null : normalizeContactPhone(rawPhone);
  const createdAt = parseTimestamp(row.createdAt);
  const updatedAt = parseTimestamp(row.updatedAt);
  if (
    !uuid.test(row.id) ||
    !createdAt ||
    !updatedAt ||
    (!name && !phone && !email) ||
    !validText(name, 255) ||
    !validText(email, 255) ||
    notes?.includes('\u0000') ||
    (rawPhone && !phone) ||
    (email && !isContactEmail(email)) ||
    !roles.has(row.role) ||
    (row.isPrimary !== 't' && row.isPrimary !== 'f')
  ) {
    return null;
  }
  return {
    name,
    phone,
    email,
    role: row.role,
    isPrimary: row.isPrimary === 't',
    notes,
    createdAt,
    updatedAt,
  };
}

function fingerprint(values: readonly unknown[]) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function leadFingerprint(row: LeadFields, creator: string | null) {
  return fingerprint([
    row.displayName,
    row.websiteUrl,
    row.sourceName,
    row.createdAt,
    row.updatedAt,
    creator,
  ]);
}

function contactFingerprint(row: ContactFields, leadId: string) {
  return fingerprint([
    row.name,
    row.phone,
    row.email,
    row.role,
    row.isPrimary,
    row.notes,
    row.createdAt,
    row.updatedAt,
    leadId,
  ]);
}

async function readMappings(client: pg.Client, tenantId: string) {
  type Mapping = Omit<KnownMapping, 'liveFingerprint' | 'liveParentId'>;
  const { rows: leads } = await client.query<
    Mapping & LeadFields & { liveId: string | null; createdByUserId: string }
  >(
    `SELECT r."sourceId", r."targetId", r."sourceFingerprint", r."targetFingerprint",
            t.id AS "liveId", t."displayName", t."websiteUrl", t."sourceName",
            t."createdAt", t."updatedAt", t."createdByUserId"
     FROM public."salesImportRecord" r
     LEFT JOIN public.lead t ON t."tenantId" = r."tenantId" AND t.id = r."targetId"
     WHERE r."tenantId" = $1 AND r."sourceSystem" = $2 AND r.entity = 'lead'`,
    [tenantId, sourceSystem],
  );
  const { rows: contacts } = await client.query<
    Mapping & ContactFields & { leadId: string | null }
  >(
    `SELECT r."sourceId", r."targetId", r."sourceFingerprint", r."targetFingerprint",
            t."leadId", t.name, t.phone, t.email, t.role, t."isPrimary", t.notes, t."createdAt", t."updatedAt"
     FROM public."salesImportRecord" r
     LEFT JOIN public."leadContact" t ON t."tenantId" = r."tenantId" AND t.id = r."targetId"
     WHERE r."tenantId" = $1 AND r."sourceSystem" = $2 AND r.entity = 'contact'`,
    [tenantId, sourceSystem],
  );
  return {
    leads: new Map<string, KnownMapping>(
      leads.map((row) => [
        row.sourceId,
        { ...row, liveFingerprint: row.liveId ? leadFingerprint(row, row.createdByUserId) : null },
      ]),
    ),
    contacts: new Map<string, KnownMapping>(
      contacts.map((row) => [
        row.sourceId,
        {
          ...row,
          ...(row.leadId ? { liveParentId: row.leadId } : {}),
          liveFingerprint: row.leadId ? contactFingerprint(row, row.leadId) : null,
        },
      ]),
    ),
  };
}

function recordExisting(
  tally: Totals,
  mapping: KnownMapping,
  sourceFingerprint: string,
  leadId?: string,
) {
  if (!mapping.liveFingerprint) {
    tally.rejected.missingTarget++;
    return;
  }
  if (leadId && mapping.liveParentId !== leadId) {
    tally.rejected.wrongParent++;
    return;
  }
  tally.alreadyPresent++;
  const sourceChanged = sourceFingerprint !== mapping.sourceFingerprint;
  const targetChanged = mapping.liveFingerprint !== mapping.targetFingerprint;
  if (sourceChanged && targetChanged) {
    tally.bothChanged++;
  } else if (sourceChanged) {
    tally.sourceChanged++;
  } else if (targetChanged) {
    tally.operatorEdited++;
  } else {
    tally.unchanged++;
  }
}

function planLeads(rows: SourceLead[], mappings: Map<string, KnownMapping>, actor: string) {
  const tally = totals(rows.length);
  const sourceIds = new Set(rows.map((row) => row.id));
  tally.missingFromSnapshot = [...mappings.keys()].filter((id) => !sourceIds.has(id)).length;
  const parents = new Map<string, string>();
  for (const mapping of mappings.values()) {
    if (mapping.liveFingerprint) {
      parents.set(mapping.sourceId, mapping.targetId);
    }
  }
  const additions: (Addition & LeadFields)[] = [];
  for (const row of rows) {
    const fields = normalizedLead(row);
    if (!fields) {
      tally.rejected.invalidRecord++;
      continue;
    }
    const sourceFingerprint = leadFingerprint(fields, null);
    const mapping = mappings.get(row.id);
    if (mapping) {
      recordExisting(tally, mapping, sourceFingerprint);
    } else {
      const targetId = randomUUID();
      additions.push({
        ...fields,
        sourceId: row.id,
        targetId,
        sourceFingerprint,
        targetFingerprint: leadFingerprint(fields, actor),
      });
      parents.set(row.id, targetId);
    }
  }
  tally.plannedInserts = additions.length;
  return { tally, parents, additions };
}

function planContacts(
  rows: SourceContact[],
  mappings: Map<string, KnownMapping>,
  parents: Map<string, string>,
  primaryLeadIds: Set<string>,
) {
  const tally = totals(rows.length);
  const sourceIds = new Set(rows.map((row) => row.id));
  tally.missingFromSnapshot = [...mappings.keys()].filter((id) => !sourceIds.has(id)).length;
  const pending: (Addition & ContactFields & { leadId: string })[] = [];
  const primaryCounts = new Map<string, number>();
  for (const row of rows) {
    const fields = normalizedContact(row);
    if (!fields) {
      tally.rejected.invalidRecord++;
      continue;
    }
    const leadId = row.crmLeadId && parents.get(row.crmLeadId);
    const mapping = mappings.get(row.id);
    if (mapping && !mapping.liveFingerprint && row.crmLeadId) {
      recordExisting(tally, mapping, contactFingerprint(fields, row.crmLeadId));
      continue;
    }
    if (!leadId || !row.crmLeadId) {
      tally.rejected.missingParent++;
      continue;
    }
    const sourceFingerprint = contactFingerprint(fields, row.crmLeadId);
    if (mapping) {
      recordExisting(tally, mapping, sourceFingerprint, leadId);
      continue;
    }
    if (fields.isPrimary) {
      primaryCounts.set(leadId, (primaryCounts.get(leadId) ?? 0) + 1);
    }
    pending.push({
      ...fields,
      leadId,
      sourceId: row.id,
      targetId: randomUUID(),
      sourceFingerprint,
      targetFingerprint: contactFingerprint(fields, leadId),
    });
  }
  const additions = pending.filter((row) => {
    if (
      row.isPrimary &&
      (primaryLeadIds.has(row.leadId) || (primaryCounts.get(row.leadId) ?? 0) > 1)
    ) {
      tally.rejected.primaryConflict++;
      return false;
    }
    return true;
  });
  tally.plannedInserts = additions.length;
  return { tally, additions };
}

async function insertMapping(
  client: pg.Client,
  tenantId: string,
  snapshot: string,
  actor: string,
  entity: Entity,
  change: Addition,
) {
  await client.query(
    `INSERT INTO public."salesImportRecord" (
       "tenantId", "sourceSystem", "entity", "sourceId", "targetId", "snapshotId",
       "sourceFingerprint", "targetFingerprint", "importedByCoreUserId", "leadCreatorProvenance"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tenantId,
      sourceSystem,
      entity,
      change.sourceId,
      change.targetId,
      snapshot,
      change.sourceFingerprint,
      change.targetFingerprint,
      actor,
      entity === 'lead' ? 'verified-import-actor' : null,
    ],
  );
}

async function importIntoTarget(
  client: pg.Client,
  settings: ReturnType<typeof options>,
  actor: string,
  staging: Awaited<ReturnType<typeof readStaging>>,
) {
  const { apply, snapshot, tenantId } = settings;
  const {
    rows: [identity],
  } = await client.query<{
    database: string;
    role: string;
    login: string;
    schema: string;
  }>(
    'SELECT current_database() AS database, current_user AS role, session_user AS login, current_schema() AS schema',
  );
  if (
    identity?.database !== 'holita_sales' ||
    identity.role !== 'holita_sales' ||
    identity.login !== 'holita_sales' ||
    identity.schema !== 'public'
  ) {
    throw new ImportFailure('unexpected_target_identity');
  }
  if (apply) {
    await client.query('LOCK TABLE public."salesImportRecord" IN SHARE ROW EXCLUSIVE MODE');
  }

  const mappings = await readMappings(client, tenantId);
  if (snapshot !== initialSnapshot && mappings.leads.size === 0) {
    throw new ImportFailure('initial_snapshot_required');
  }
  const { rows: primaryContacts } = await client.query<{ leadId: string }>(
    'SELECT "leadId" FROM public."leadContact" WHERE "tenantId" = $1 AND "isPrimary"',
    [tenantId],
  );
  const leads = planLeads(staging.leadRows, mappings.leads, actor);
  const contacts = planContacts(
    staging.contactRows,
    mappings.contacts,
    leads.parents,
    new Set(primaryContacts.map((row) => row.leadId)),
  );
  const {
    rows: [links],
  } = await client.query<{ broken: number }>(
    `SELECT count(*)::int AS broken
     FROM public."leadContact" c
     LEFT JOIN public.lead l ON l."tenantId" = c."tenantId" AND l.id = c."leadId"
     WHERE c."tenantId" = $1 AND l.id IS NULL`,
    [tenantId],
  );
  if (!links || links.broken > 0) {
    throw new ImportFailure('broken_target_contact_links');
  }
  const report = {
    leads: summarize(leads.tally),
    contacts: summarize(contacts.tally),
    brokenTargetContactLinks: links.broken,
    creatorFallbacksPlanned: leads.additions.length,
    unsupported: staging.unsupported,
  };
  console.log(JSON.stringify({ mode: apply ? 'plan' : 'dry-run', ...report }));
  if (!apply) {
    return report;
  }

  for (const row of leads.additions) {
    await client.query(
      `INSERT INTO public.lead
       (id, "tenantId", "displayName", "websiteUrl", "sourceName", "createdByUserId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.targetId,
        tenantId,
        row.displayName,
        row.websiteUrl,
        row.sourceName,
        actor,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await insertMapping(client, tenantId, snapshot, actor, 'lead', row);
  }
  for (const row of contacts.additions) {
    await client.query(
      `INSERT INTO public."leadContact"
       (id, "tenantId", "leadId", name, phone, email, role, "isPrimary", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        row.targetId,
        tenantId,
        row.leadId,
        row.name,
        row.phone,
        row.email,
        row.role,
        row.isPrimary,
        row.notes,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await insertMapping(client, tenantId, snapshot, actor, 'contact', row);
  }
  report.leads.inserted = leads.additions.length;
  report.contacts.inserted = contacts.additions.length;
  return report;
}

async function run() {
  const settings = options();
  const configuration = parse(await readFile(new URL('../config/sales.env', import.meta.url)));
  const targetUrl = databaseUrl(configuration.SALES_DATABASE_URL, 'holita_sales', 'holita_sales');
  const stagingUrl = databaseUrl(
    process.env.HOLITA_SALES_IMPORT_STAGING_URL,
    'holita_sales_import',
  );
  const actor = await verifiedActor(settings.tenantId);

  const staging = new pg.Client({ connectionString: stagingUrl.toString() });
  staging.on('error', () => undefined);
  let data: Awaited<ReturnType<typeof readStaging>>;
  try {
    await staging.connect();
    await staging.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    data = await readStaging(staging, settings);
    await staging.query('COMMIT');
  } finally {
    await staging.end();
  }

  const target = new pg.Client({ connectionString: targetUrl.toString() });
  target.on('error', () => undefined);
  try {
    await target.connect();
    await target.query(
      settings.apply ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const report = await importIntoTarget(target, settings, actor, data);
    await target.query('COMMIT');
    if (settings.apply) {
      console.log(JSON.stringify({ mode: 'applied', ...report }));
    }
  } finally {
    await target.end();
  }
}

try {
  await run();
} catch (error: unknown) {
  let reason = 'import_failed';
  if (error instanceof ImportFailure) {
    reason = error.message;
  } else if (
    error instanceof pg.DatabaseError &&
    error.code === '23505' &&
    error.constraint === 'leadContact_primary_key'
  ) {
    reason = 'target_primary_conflict';
  }
  console.error(JSON.stringify({ error: reason }));
  process.exitCode = 1;
}
