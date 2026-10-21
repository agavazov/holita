import { resolve } from 'node:path';

/** Match the development target only inside this checkout, including orphaned CLI processes. */
export function isAdminStorybook(
  root: string,
  directory: string,
  args: readonly string[],
): boolean {
  if (directory !== root && directory !== resolve(root, 'apps/admin')) {
    return false;
  }
  if (/^(?:ng|nx) run admin:storybook(?:\s|$)/.test(args[0] ?? '')) {
    return true;
  }
  const entries = [
    'node_modules/.bin/ng',
    'node_modules/.bin/nx',
    'node_modules/@angular/cli/bin/ng.js',
    'node_modules/nx/bin/nx.js',
  ].map((entry) => resolve(root, entry));
  return (
    args.includes('run') &&
    args.includes('admin:storybook') &&
    args.some((arg) => entries.includes(resolve(directory, arg)))
  );
}
