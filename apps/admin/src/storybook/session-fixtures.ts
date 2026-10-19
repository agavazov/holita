import { AdminBranchesDocument } from '../generated/graphql/operations';
import { graphqlFixture } from './graphql-fixtures';

// Synthetic identities only; no real tenant, branch or person appears in Storybook.

export const fixtureTenant = {
  __typename: 'Tenant',
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Demo Logistics Ltd',
} as const;

export const fixtureBranches = [
  { __typename: 'Branch', id: '20000000-0000-4000-8000-0000000000a1', name: 'Sofia Fleet' },
  { __typename: 'Branch', id: '20000000-0000-4000-8000-0000000000a2', name: 'Plovdiv Fleet' },
] as const;

export const defaultBranchId = fixtureBranches[0].id;

// The client accepts the demo token shape; Storybook never sends it to a real backend.
export const fixtureToken = `holita-demo.${fixtureTenant.id}.4102444800.${'storybook_fixture_signature_'.padEnd(43, '0')}`;

/** Seeds the stored demo session before the application bootstraps. */
export function seedSession(branchId: string | null): void {
  sessionStorage.setItem(
    'holita.admin.demo-session',
    JSON.stringify({
      token: fixtureToken,
      tenant: { id: fixtureTenant.id, name: fixtureTenant.name },
      branchId,
    }),
  );
}

export function clearSession(): void {
  sessionStorage.removeItem('holita.admin.demo-session');
}

graphqlFixture(AdminBranchesDocument, () => ({ branches: [...fixtureBranches] }));
