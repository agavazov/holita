import { config } from 'dotenv';
import { setupDatabase } from '../osnova/tools/database/setup.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--test')) {
  throw new Error('Use holita database setup with optional --test');
}
config({ path: '.env', quiet: true });
config({
  path: ['holita/config/core.env', 'holita/config/commerce.env'],
  quiet: true,
  override: true,
});
await setupDatabase(
  {
    name: 'holita',
    services: ['core', 'commerce'],
    envPaths: [],
    adminUser: process.env.POSTGRES_USER ?? 'discocan_admin',
  },
  args[0] === '--test',
);
