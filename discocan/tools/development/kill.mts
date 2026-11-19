import { killDevelopment } from '../../../osnova/tools/development/kill.mjs';

await killDevelopment({
  name: 'discocan',
  appDirectories: [
    ...['admin', 'gateway', 'fleet', 'device-server'].map((app) => `discocan/apps/${app}`),
    'osnova/apps/core',
  ],
  backendEntries: [
    ...['fleet', 'device-server'].flatMap((app) =>
      ['dist', 'dist-dev'].flatMap((output) => [
        `discocan/apps/${app}/${output}/main`,
        `discocan/apps/${app}/${output}/main.js`,
      ]),
    ),
    'osnova/apps/core/dist/main.js',
    'osnova/apps/core/dist-discocan/main.js',
  ],
  group: 'gateway,core,fleet,device-server,admin',
});
