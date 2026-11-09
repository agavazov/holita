import {
  AdminBranchesDocument,
  AdminDemoLoginDocument,
  AdminTenantsDocument,
  AdminSignInDocument,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture } from './graphql-fixtures';
import { fixtureAccount, fixtureBranches, fixtureTenant, fixtureToken } from './session-fixtures';

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
  options: {
    readonly emptyTenants?: boolean;
    readonly emptyBranches?: boolean;
    readonly invalidCredentials?: boolean;
  } = {},
): () => void {
  graphqlFixture(AdminSignInDocument, () => {
    if (options.invalidCredentials) {
      throw fixtureError('UNAUTHENTICATED', 'Invalid email or password');
    }
    return {
      signIn: {
        token: fixtureToken,
        expiresAt: '2100-01-01T00:00:00.000Z',
        tenant: fixtureTenant,
        user: fixtureAccount,
      },
    };
  });
  graphqlFixture(AdminTenantsDocument, () => ({
    tenants: options.emptyTenants ? [] : [...loginTenants],
  }));
  graphqlFixture(AdminDemoLoginDocument, (variables) => {
    const tenant = loginTenants.find((item) => item.id === variables.requiredString('tenantId'));
    if (!tenant) {
      throw fixtureError('NOT_FOUND', 'The tenant was not found.');
    }
    return {
      demoLogin: {
        __typename: 'DemoSession',
        token: `discocan-demo.${tenant.id}.4102444800.${'storybook_fixture_signature_'.padEnd(43, '0')}`,
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
