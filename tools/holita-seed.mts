import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({
  path: ['holita/config/core.env', 'holita/config/seed-accounts.env'],
  quiet: true,
  override: true,
});
const value = process.env.CORE_DATABASE_URL;
if (!value) {
  throw new Error('Holita Core database configuration is missing');
}
const url = new URL(value);
if (
  url.hostname !== '127.0.0.1' ||
  url.pathname !== '/holita_core' ||
  url.username !== 'holita_core' ||
  url.search ||
  url.hash
) {
  throw new Error('Seed only the dedicated local Holita Core database');
}
const result = spawnSync('npm', ['run', 'db:seed', '--workspace', '@osnova/core'], {
  stdio: 'inherit',
  env: { ...process.env, CORE_SEED_FILE: resolve('holita/config/core-seed.json') },
});
process.exitCode = result.status ?? 1;
