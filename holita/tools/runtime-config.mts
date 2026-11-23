import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { parse } from 'dotenv';

const directory = fileURLToPath(new URL('../config/', import.meta.url));
const secret = () => randomBytes(36).toString('base64url');
const url = (name: string, password: string, port: string) =>
  `postgresql://${name}:${password}@127.0.0.1:${port}/${name}`;

function salesConfig(port: string, internalToken: string): string {
  return [
    'PORT=12015',
    `SALES_DATABASE_URL=${url('holita_sales', secret(), port)}`,
    `SALES_TEST_DATABASE_URL=${url('holita_sales_test', secret(), port)}`,
    'CORE_AUTH_VERIFY_URL=http://127.0.0.1:12011/internal/auth/verify',
    `CORE_INTERNAL_AUTH_TOKEN=${JSON.stringify(internalToken)}`,
    '',
  ].join('\n');
}

function writePrivateFile(path: string, content: string): void {
  writeFileSync(path, content, { flag: 'wx', mode: 0o600 });
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--sales-only') {
  const core = parse(readFileSync(join(directory, 'core.env')));
  const token = core['CORE_INTERNAL_AUTH_TOKEN'];
  const database = URL.parse(core['CORE_DATABASE_URL'] ?? '');
  if (!token || token.length < 32 || !database) {
    throw new Error('Holita Core database URL and internal token are required');
  }
  writePrivateFile(join(directory, 'sales.env'), salesConfig(database.port || '5432', token));
  console.info('Created Holita Sales runtime configuration.');
} else if (args.length === 0) {
  initialize();
} else {
  throw new Error('Use holita runtime configuration with optional --sales-only');
}

function initialize(): void {
  const files = ['core.env', 'commerce.env', 'sales.env', 'seed-accounts.env'].map((name) =>
    join(directory, name),
  );
  if (files.some(existsSync)) {
    throw new Error(
      'Holita configuration already exists; preserve it and configure missing files manually.',
    );
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const corePassword = secret();
  const coreTestPassword = secret();
  const commercePassword = secret();
  const commerceTestPassword = secret();
  const internalToken = secret();
  const demoSecret = secret();
  const port = process.env.POSTGRES_PORT ?? '11084';
  if (!/^\d+$/.test(port)) {
    throw new Error('POSTGRES_PORT must be numeric');
  }
  const content = [
    [
      'CORE_TOKEN_PREFIX=holita',
      'PORT=12011',
      `CORE_DATABASE_URL=${url('holita_core', corePassword, port)}`,
      `CORE_TEST_DATABASE_URL=${url('holita_core_test', coreTestPassword, port)}`,
      `CORE_INTERNAL_AUTH_TOKEN=${internalToken}`,
      `DEMO_AUTH_SECRET=${demoSecret}`,
      'DEMO_AUTH_ENABLED=false',
    ].join('\n') + '\n',
    [
      'PORT=12013',
      `COMMERCE_DATABASE_URL=${url('holita_commerce', commercePassword, port)}`,
      `COMMERCE_TEST_DATABASE_URL=${url('holita_commerce_test', commerceTestPassword, port)}`,
      `CORE_INTERNAL_AUTH_TOKEN=${internalToken}`,
      'CORE_AUTH_VERIFY_URL=http://127.0.0.1:12011/internal/auth/verify',
      'CORE_GRAPHQL_URL=http://127.0.0.1:12011/graphql',
      `HOLITA_COMMERCE_IMAGE_DIR="${resolve(directory, '../../.volumes/holita/images')}"`,
    ].join('\n') + '\n',
    salesConfig(port, internalToken),
    [
      'HOLITA_STAFF_EMAIL=staff@holita.test',
      `HOLITA_STAFF_PASSWORD=${secret()}`,
      'HOLITA_SALES_EMAIL=sales@holita.test',
      `HOLITA_SALES_PASSWORD=${secret()}`,
      'HOLITA_MERCHANT_EMAIL=admin@demo.holita.test',
      `HOLITA_MERCHANT_PASSWORD=${secret()}`,
      `HOLITA_DEMO_SHOPPER_PASSWORD=${secret()}`,
    ].join('\n') + '\n',
  ];
  for (const [index, path] of files.entries()) {
    const value = content[index];
    if (value === undefined) {
      throw new Error('Missing configuration content');
    }
    writePrivateFile(path, value);
  }
  console.info('Created Holita runtime and seed configuration files.');
}
