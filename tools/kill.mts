import { execFileSync } from 'node:child_process';
import { killDevelopment } from '../osnova/tools/development/kill.mjs';

execFileSync('node_modules/.bin/tsx', ['discocan/tools/development/kill.mts'], {
  stdio: 'inherit',
});
await killDevelopment({
  name: 'holita',
  appDirectories: [
    'holita/apps/admin',
    'holita/apps/backoffice',
    'holita/apps/sales',
    'holita/apps/storefront',
    'holita/apps/gateway',
    'holita/apps/commerce',
    'osnova/apps/core',
  ],
  backendEntries: [
    'holita/apps/commerce/dist/main.js',
    'holita/apps/commerce/dist-dev/main.js',
    'osnova/apps/core/dist-holita/main.js',
  ],
  group: 'core,commerce,gateway,admin,backoffice,sales,storefront-router,storefront',
});
