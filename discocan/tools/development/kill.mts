import { killDevelopment } from '../../../osnova/tools/development/kill.mjs';

await killDevelopment({
  name: 'discocan',
  appDirectories: [
    ...['admin', 'gateway', 'fleet'].map((app) => `discocan/apps/${app}`),
    'osnova/apps/core',
  ],
  backendEntries: [
    ...['fleet'].flatMap((app) =>
      ['dist', 'dist-dev'].flatMap((output) => [
        `discocan/apps/${app}/${output}/main`,
        `discocan/apps/${app}/${output}/main.js`,
      ]),
    ),
    'osnova/apps/core/dist/main.js',
    'osnova/apps/core/dist-discocan/main.js',
  ],
  group: 'gateway,core,fleet,admin',
});
