import {
  AdminChangePasswordDocument,
  AdminProfileDocument,
  AdminUpdateProfileDocument,
  type AdminProfileQuery,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';
import { fixtureTenant } from './session-fixtures';

export const fixtureProfile: WithTypename<AdminProfileQuery['me']> = {
  __typename: 'User',
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Alex Morgan',
  email: 'alex@example.test',
  active: true,
  lastSignInAt: '2026-10-18T06:50:00.000Z',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-18T06:50:00.000Z',
  tenant: fixtureTenant,
};

graphqlFixture(AdminProfileDocument, () => ({ me: fixtureProfile }));
graphqlFixture(AdminUpdateProfileDocument, (variables) => ({
  updateProfile: {
    ...fixtureProfile,
    name: variables.requiredString('name').trim(),
    email: variables.requiredString('email').trim().toLowerCase(),
  },
}));
graphqlFixture(AdminChangePasswordDocument, (variables) => {
  if (variables.requiredString('currentPassword') !== 'Storybook password 12') {
    throw fixtureError('BAD_USER_INPUT', 'Current password is incorrect', [
      {
        path: 'currentPassword',
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
      },
    ]);
  }
  return { changePassword: true };
});
