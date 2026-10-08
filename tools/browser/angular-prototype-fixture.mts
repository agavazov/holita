import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Kind, parse, print, visit } from 'graphql';

export const prototypeStore = '10000000-0000-4000-8000-000000000001';
export const prototypeEvent = '60000000-0000-4000-8000-000000000001';

async function operationQuery(name: string): Promise<string> {
  // Use the same explicit operation inputs as Angular codegen, with only required fragments.
  for (const resource of ['events', 'sessions', 'media']) {
    const source = parse(
      await readFile(
        new URL(
          `../../apps/admin/src/app/features/reference/${resource}/operations.graphql`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const operation = source.definitions.find(
      (node) => node.kind === Kind.OPERATION_DEFINITION && node.name?.value === name,
    );
    if (!operation) continue;
    const fragments = source.definitions.filter((node) => node.kind === Kind.FRAGMENT_DEFINITION);
    const used = new Set<string>();
    function collect(node: Parameters<typeof visit>[0]): void {
      visit(node, {
        FragmentSpread(spread) {
          if (used.has(spread.name.value)) return;
          used.add(spread.name.value);
          const fragment = fragments.find(
            (definition) => definition.name.value === spread.name.value,
          );
          if (!fragment) throw new Error('Missing operation fragment.');
          collect(fragment);
        },
      });
    }
    collect(operation);
    return print({
      kind: Kind.DOCUMENT,
      definitions: [operation, ...fragments.filter((node) => used.has(node.name.value))],
    });
  }
  throw new Error('Missing Angular operation ' + name);
}

// Browser fetch must pass through MSW; APIRequestContext would bypass the worker.
export async function prototypeOperation(
  page: Page,
  name: string,
  variables: Record<string, unknown> = {},
  storeId = prototypeStore,
): Promise<unknown> {
  // Bootstrap completes only after MSW starts; reload's load event alone is too early.
  await page.locator('holita-store-workspace').waitFor();
  return page.evaluate(
    async ({ query, variables, storeId }) => {
      const response = await fetch('/__prototype/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-store-id': storeId },
        body: JSON.stringify({ query, variables }),
      });
      const result: unknown = await response.json();
      return result;
    },
    { query: await operationQuery(name), variables, storeId },
  );
}

export function createdId(result: unknown, field: string): string {
  if (typeof result !== 'object' || result === null || !('data' in result))
    throw new Error('Missing Prototype result.');
  const data = result.data;
  if (typeof data !== 'object' || data === null || !(field in data))
    throw new Error('Missing ' + field);
  const row: unknown = Reflect.get(data, field);
  if (typeof row !== 'object' || row === null || !('id' in row) || typeof row.id !== 'string')
    throw new Error('Missing record ID.');
  return row.id;
}

export async function confirmPrototype(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name, exact: true });
  await dialog.getByRole('button', { name, exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
}
