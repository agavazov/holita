# 003 Admin initial bundle over budget

**Status:** Ready, low priority. **Product:** Discocan (admin).

## Background

`discocan/apps/admin/angular.json` sets the initial bundle budget to a 700 kB warning and a 1 MB
error. After the device refactor (`1c5c41d`) the initial bundle is about 725 kB, so every
production build prints a budget warning.

## Goal

The initial bundle is back under 700 kB with no change in behavior. If that is not reasonable, the
owner decides whether to raise the warning.

## Steps

1. Check the machine load, then run one production build of the admin with `--stats-json`.
2. Find what landed in the initial chunk. Likely suspects are ERM feature code, contract parsers or
   PrimeNG modules imported by eager components (shell, navigation, Branch workspace).
3. Compare the imports of those files with `16477e0` using `git show`. Do not create a worktree.
4. Move the eager imports behind lazy routes or `@defer`, only where the change is small and local.
5. If nothing reasonable remains, report the sizes and the main contributors, and ask the owner
   whether to raise the warning (for example to 750 kB).

## Done when

The build prints no budget warning, or the owner has decided to raise it.

## Limits

One build at a time. No new dependencies or build tools.
