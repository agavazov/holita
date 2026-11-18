import { killDevelopment } from '../../../osnova/tools/development/kill.mjs';

await killDevelopment({
  name: 'discocan',
  appDirectories: ['admin', 'gateway', 'core', 'fleet'].map((app) => `discocan/apps/${app}`),
  backendEntries: ['core', 'fleet'].flatMap((app) =>
    ['dist', 'dist-dev'].flatMap((output) => [
      `discocan/apps/${app}/${output}/main`,
      `discocan/apps/${app}/${output}/main.js`,
    ]),
  ),
  group: 'gateway,core,fleet,admin',
});
