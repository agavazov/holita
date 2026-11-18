import { setupDatabase } from '../../../osnova/tools/database/setup.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--test')) {
  throw new Error('Usage: npm run db:setup or npm run db:test:setup');
}
await setupDatabase(
  {
    name: 'discocan',
    services: ['core', 'fleet', 'erm'],
    envPaths: [
      '.env',
      'discocan/apps/core/.env',
      'discocan/apps/fleet/.env',
      'discocan/apps/erm-server/.env',
    ],
    adminUser: 'discocan_admin',
  },
  args[0] === '--test',
);
