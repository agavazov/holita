import {
  AdminCreateUserDocument,
  AdminDeactivateUserDocument,
  AdminReactivateUserDocument,
  AdminUpdateUserDocument,
  AdminUsersDocument,
  type AdminUserDetailsFragment,
  type UserRole,
} from '../generated/graphql/operations';
import {
  fixtureError,
  graphqlFixture,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { fixtureTenant } from './session-fixtures';

export const fixtureUsers: readonly WithTypename<AdminUserDetailsFragment>[] = [
  {
    __typename: 'User',
    id: '30000000-0000-4000-8000-000000000001',
    tenant: fixtureTenant,
    name: 'Alex Morgan',
    email: 'alex@example.test',
    role: 'ADMINISTRATOR',
    active: true,
    lastSignInAt: '2026-10-18T06:45:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-18T06:45:00.000Z',
  },
  {
    __typename: 'User',
    id: '31000000-0000-4000-8000-000000000002',
    tenant: fixtureTenant,
    name: 'Мария Иванова',
    email: 'maria.ivanova@example.test',
    role: 'ENGINEER',
    active: true,
    lastSignInAt: '2026-10-17T13:12:00.000Z',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-10-17T13:12:00.000Z',
  },
  {
    __typename: 'User',
    id: '31000000-0000-4000-8000-000000000003',
    tenant: fixtureTenant,
    name: 'Jordan Taylor',
    email: 'jordan.taylor@example.test',
    role: 'OPERATOR',
    active: false,
    lastSignInAt: '2026-09-09T10:00:00.000Z',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    __typename: 'User',
    id: '31000000-0000-4000-8000-000000000004',
    tenant: fixtureTenant,
    name: 'Samira Anderson with a longer account display name',
    email: 'samira.anderson.operations@example.test',
    role: 'VIEWER',
    active: true,
    lastSignInAt: null,
    createdAt: '2026-10-18T06:55:00.000Z',
    updatedAt: '2026-10-18T06:55:00.000Z',
  },
];

function findUser(variables: FixtureVariables): WithTypename<AdminUserDetailsFragment> {
  const user = fixtureUsers.find((candidate) => candidate.id === variables.requiredString('id'));
  if (!user) {
    throw fixtureError('NOT_FOUND', 'The user was not found.');
  }
  return user;
}

function savedUser(variables: FixtureVariables): WithTypename<AdminUserDetailsFragment> {
  const base = variables.has('id') ? findUser(variables) : fixtureUsers[1];
  if (!base) {
    throw fixtureError('NOT_FOUND', 'The user was not found.');
  }
  const email = variables.requiredString('email').trim().toLowerCase();
  if (
    fixtureUsers.some(
      (user) => user.email === email && (!variables.has('id') || user.id !== base.id),
    )
  ) {
    throw fixtureError('BAD_USER_INPUT', 'Email is already in use.', [
      { path: 'email', message: 'Email is already in use.', code: 'DUPLICATE' },
    ]);
  }
  const role = variables.requiredString('role');
  const roles: readonly UserRole[] = ['VIEWER', 'OPERATOR', 'ENGINEER', 'ADMINISTRATOR'];
  const selectedRole = roles.find((candidate) => candidate === role);
  if (!selectedRole) {
    throw fixtureError('BAD_USER_INPUT', 'A valid user role is required.');
  }
  return {
    ...base,
    role: selectedRole,
    id: variables.has('id') ? base.id : '31000000-0000-4000-8000-000000000005',
    name: variables.requiredString('name'),
    email,
    active: variables.has('id') ? base.active : true,
    lastSignInAt: variables.has('id') ? base.lastSignInAt : null,
    updatedAt: '2026-10-18T07:00:00.000Z',
  };
}

// Immutable snapshots; submitted edits return the saved record without simulating persistence.
graphqlFixture(AdminUsersDocument, () => ({ users: [...fixtureUsers] }));
graphqlFixture(AdminCreateUserDocument, (variables) => ({ createUser: savedUser(variables) }));
graphqlFixture(AdminUpdateUserDocument, (variables) => ({ updateUser: savedUser(variables) }));
graphqlFixture(AdminDeactivateUserDocument, (variables) => ({
  deactivateUser: { ...findUser(variables), active: false },
}));
graphqlFixture(AdminReactivateUserDocument, (variables) => ({
  reactivateUser: { ...findUser(variables), active: true },
}));
