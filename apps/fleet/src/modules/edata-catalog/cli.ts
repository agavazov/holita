import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { createPrismaClient } from '../../database/client.js';
import { getDatabaseUrl } from '../../database/connection.js';
import { check, CatalogValidationError, parseCatalog } from './catalog-file.js';
import { importCatalog } from './catalog.repository.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

async function main() {
  const { values } = parseArgs({
    options: {
      catalog: { type: 'string' },
      exe: { type: 'string' },
      write: { type: 'boolean', default: false },
      'expect-sha256': { type: 'string' },
    },
  });
  check(values.catalog && values.exe, 'Supply --catalog <catalog.json> and --exe <Monitor.exe>');
  const catalog = parseCatalog(await readFile(values.catalog));
  check(
    createHash('sha256')
      .update(await readFile(values.exe))
      .digest('hex') === catalog.sourceSha256,
    'EXE hash does not match catalog provenance',
  );
  if (values.write) {
    check(
      values['expect-sha256'] === catalog.contentSha256,
      'Writing requires --expect-sha256 with the content hash from the reviewed preview',
    );
  }
  const url = new URL(getDatabaseUrl());
  check(
    ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      url.pathname === '/holita_fleet' &&
      decodeURIComponent(url.username) === 'holita_fleet' &&
      !url.search &&
      !url.hash,
    'This CLI only supports the local Fleet development database without URL options',
  );
  const client = createPrismaClient();
  try {
    const result = await importCatalog(client, catalog, values.write);
    console.info(
      JSON.stringify(
        {
          target: `${url.hostname}:${url.port || '5432'}/holita_fleet`,
          packageLabel: catalog.packageLabel,
          contentSha256: catalog.contentSha256,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof CatalogValidationError
      ? error.message
      : 'Catalog import failed. Check the input, Fleet migrations and local database availability. Connection details are not logged.',
  );
  process.exitCode = 1;
}
