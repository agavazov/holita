import { describe, expect, it } from '@jest/globals';
import { isAdminStorybook } from './admin-storybook-process.mjs';

const root = '/workspace/holita';
describe('Admin Storybook development-process selection', () => {
  it.each([
    [root, ['node', `${root}/node_modules/.bin/nx`, 'run', 'admin:storybook']],
    [`${root}/apps/admin`, ['node', `${root}/node_modules/.bin/ng`, 'run', 'admin:storybook']],
    [root, ['node', `${root}/node_modules/@angular/cli/bin/ng.js`, 'run', 'admin:storybook']],
    [root, ['node', `${root}/node_modules/nx/bin/nx.js`, 'run', 'admin:storybook']],
    [`${root}/apps/admin`, ['ng run admin:storybook --configuration=development']],
    [root, ['nx run admin:storybook']],
  ] as const)('recognizes the target in %s with %j', (directory, args) => {
    expect(isAdminStorybook(root, directory, args)).toBe(true);
  });
  it.each([
    ['/workspace/other', ['ng run admin:storybook']],
    [`${root}-other/apps/admin`, ['ng run admin:storybook']],
    [`${root}/apps/fleet`, ['ng run admin:storybook']],
    [root, ['ng run admin:build-storybook']],
    [root, ['ng run admin:test-storybook']],
    [root, ['ng run admin:storybook-other']],
    [root, ['node', `${root}/node_modules/.bin/nx`, 'run', 'admin:test-storybook']],
    [root, ['node', `${root}/tools/test.mts`, 'run', 'admin:storybook']],
    [root, ['node', '/workspace/other/node_modules/.bin/ng', 'run', 'admin:storybook']],
    [
      root,
      [
        'node',
        `${root}/node_modules/jest/bin/jest.js`,
        '--testNamePattern',
        'ng run admin:storybook',
      ],
    ],
  ] as const)('leaves unrelated work in %s with %j alone', (directory, args) => {
    expect(isAdminStorybook(root, directory, args)).toBe(false);
  });
});
