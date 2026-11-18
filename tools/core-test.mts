import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: 'discocan/config/core.env', quiet: true, override: true });
process.env.CORE_TEST_DATABASE_URL ??=
  'postgresql://discocan_core_test:discocan_core_test_local@127.0.0.1:11084/discocan_core_test';
const result = spawnSync(
  'npm',
  ['run', 'test:db', '--workspace', '@osnova/core', '--', ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;
