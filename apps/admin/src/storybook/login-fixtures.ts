import {
  AdminBranchesDocument,
  AdminDemoLoginDocument,
  AdminTenantsDocument,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture } from './graphql-fixtures';
import { fixtureBranches, fixtureTenant, fixtureToken } from './session-fixtures';

export const loginTenants = [
  fixtureTenant,
  {
    __typename: 'Tenant',
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Demo Transport Ltd',
  },
] as const;

/** Registers only the real Login's operations; cleanup restores shared Branch discovery. */
export function loginFixtures(
  options: { readonly emptyTenants?: boolean; readonly emptyBranches?: boolean } = {},
): () => void {
  graphqlFixture(AdminTenantsDocument, () => ({
    tenants: options.emptyTenants ? [] : [...loginTenants],
  }));
  graphqlFixture(AdminDemoLoginDocument, (variables) => {
    const tenant = loginTenants.find((item) => item.id === variables.requiredString('tenantId'));
    if (!tenant) throw fixtureError('NOT_FOUND', 'The tenant was not found.');
    return {
      demoLogin: {
        __typename: 'DemoSession',
        token: fixtureToken.replace(fixtureTenant.id, tenant.id),
        tenant,
      },
    };
  });
  graphqlFixture(AdminBranchesDocument, () => ({
    branches: options.emptyBranches ? [] : [...fixtureBranches],
  }));
  return () => {
    graphqlFixture(AdminBranchesDocument, () => ({ branches: [...fixtureBranches] }));
  };
}
