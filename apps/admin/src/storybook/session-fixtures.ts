import {
  AdminBranchesDocument,
  AdminMeDocument,
  AdminSignOutDocument,
} from '../generated/graphql/operations';
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

// Synthetic opaque bearer; Storybook never sends it to a real backend.
export const fixtureToken = `holita-session.${'storybook_fixture_session_'.padEnd(43, '0')}`;

export const fixtureAccount = {
  __typename: 'User',
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Alex Morgan',
  email: 'alex@example.test',
  active: true,
  lastSignInAt: '2026-10-18T06:50:00.000Z',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-18T06:50:00.000Z',
  tenant: fixtureTenant,
} as const;

/** Seeds the stored session before the application bootstraps. */
export function seedSession(branchId: string | null): void {
  sessionStorage.setItem(
    'holita.admin.session',
    JSON.stringify({
      token: fixtureToken,
      tenant: { id: fixtureTenant.id, name: fixtureTenant.name },
      expiresAt: '2100-01-01T00:00:00.000Z',
      branchId,
    }),
  );
}

export function clearSession(): void {
  sessionStorage.removeItem('holita.admin.session');
  sessionStorage.removeItem('holita.admin.demo-session');
}

graphqlFixture(AdminBranchesDocument, () => ({ branches: [...fixtureBranches] }));
graphqlFixture(AdminMeDocument, () => ({ me: fixtureAccount }));
graphqlFixture(AdminSignOutDocument, () => ({ signOut: true }));
