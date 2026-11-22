import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const directory = fileURLToPath(new URL('../config/', import.meta.url));
const files = ['core.env', 'commerce.env', 'seed-accounts.env'].map((name) =>
  join(directory, name),
);
if (files.some(existsSync)) {
  throw new Error(
    'Holita configuration already exists; preserve it and configure missing files manually.',
  );
}
mkdirSync(directory, { recursive: true, mode: 0o700 });
const secret = () => randomBytes(36).toString('base64url');
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
const url = (name: string, password: string) =>
  `postgresql://${name}:${password}@127.0.0.1:${port}/${name}`;
const content = [
  [
    'CORE_TOKEN_PREFIX=holita',
    'PORT=12011',
    `CORE_DATABASE_URL=${url('holita_core', corePassword)}`,
    `CORE_TEST_DATABASE_URL=${url('holita_core_test', coreTestPassword)}`,
    `CORE_INTERNAL_AUTH_TOKEN=${internalToken}`,
    `DEMO_AUTH_SECRET=${demoSecret}`,
    'DEMO_AUTH_ENABLED=false',
  ].join('\n') + '\n',
  [
    'PORT=12013',
    `COMMERCE_DATABASE_URL=${url('holita_commerce', commercePassword)}`,
    `COMMERCE_TEST_DATABASE_URL=${url('holita_commerce_test', commerceTestPassword)}`,
    `CORE_INTERNAL_AUTH_TOKEN=${internalToken}`,
    'CORE_AUTH_VERIFY_URL=http://127.0.0.1:12011/internal/auth/verify',
    'CORE_GRAPHQL_URL=http://127.0.0.1:12011/graphql',
    `HOLITA_COMMERCE_IMAGE_DIR="${resolve(directory, '../../.volumes/holita/images')}"`,
  ].join('\n') + '\n',
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
  writeFileSync(path, value, { flag: 'wx', mode: 0o600 });
}
console.info('Created Holita runtime and seed configuration files.');
