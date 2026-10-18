import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AdminBranchesDocument } from '../generated/graphql/operations';
import {
  FixtureHttpBackend,
  FixtureVariables,
  failureFor,
  fixtureError,
  graphqlFixture,
  registeredOperations,
  useFixtureScenario,
} from './graphql-fixtures';

function request(operationName: string, variables: Record<string, unknown> = {}) {
  return new HttpRequest(
    'POST',
    '/graphql',
    { operationName, variables },
    {
      headers: new HttpHeaders({ 'x-branch-id': 'branch-a' }),
    },
  );
}

async function send(operationName: string, variables: Record<string, unknown> = {}) {
  try {
    const event = await firstValueFrom(
      new FixtureHttpBackend().handle(request(operationName, variables)),
    );
    return event instanceof HttpResponse ? event.body : event;
  } catch (error) {
    return error;
  }
}

describe('GraphQL fixtures', () => {
  beforeAll(() => {
    graphqlFixture(AdminBranchesDocument, (variables) => ({
      branches: [{ __typename: 'Branch', id: variables.branchId ?? 'none', name: 'Fixture' }],
    }));
  });
  afterEach(() => {
    useFixtureScenario(undefined);
  });

  it('reads typed variables at runtime', () => {
    const variables = new FixtureVariables({
      flag: true,
      ratio: 2.5,
      count: 3,
      text: 'x',
      cleared: null,
      list: ['a', 'b'],
      nested: { limit: 20 },
      infinite: Number.POSITIVE_INFINITY,
    });
    expect(variables.boolean('flag')).toBe(true);
    expect(variables.boolean('text')).toBeNull();
    expect(variables.number('ratio')).toBe(2.5);
    expect(variables.number('infinite')).toBeNull();
    expect(variables.integer('count')).toBe(3);
    expect(variables.integer('ratio')).toBeNull();
    expect(variables.integer('missing')).toBeNull();
    expect(variables.int('missing', 7)).toBe(7);
    expect(variables.isExplicitNull('cleared')).toBe(true);
    expect(variables.isExplicitNull('missing')).toBe(false);
    expect(variables.isExplicitNull('text')).toBe(false);
    expect(variables.strings('list')).toEqual(['a', 'b']);
    expect(variables.object('nested').integer('limit')).toBe(20);
  });

  it('lets record-specific failures win over operation failures', () => {
    useFixtureScenario({
      failures: { AdminAcknowledge: 'graphql', 'AdminAcknowledge:alert-2': 'conflict' },
    });
    expect(failureFor('AdminAcknowledge', new FixtureVariables({ id: 'alert-1' }))).toBe('graphql');
    expect(failureFor('AdminAcknowledge', new FixtureVariables({ id: 'alert-2' }))).toBe(
      'conflict',
    );
    expect(failureFor('AdminOther', new FixtureVariables({ id: 'alert-2' }))).toBeUndefined();
    useFixtureScenario({ failures: { 'AdminAcknowledge:alert-2': 'conflict' } });
    expect(failureFor('AdminAcknowledge', new FixtureVariables({ id: 'alert-1' }))).toBeUndefined();
  });

  it('answers once and then fails for network-after-first', () => {
    useFixtureScenario({ failures: { AdminVehicles: 'network-after-first' } });
    const variables = new FixtureVariables({});
    expect(failureFor('AdminVehicles', variables)).toBeUndefined();
    expect(failureFor('AdminVehicles', variables)).toBe('network');
    useFixtureScenario({ failures: { AdminVehicles: 'network-after-first' } });
    expect(failureFor('AdminVehicles', variables)).toBeUndefined();
  });

  it('answers from handlers with the Branch scope and maps failures to backend codes', async () => {
    expect(registeredOperations()).toContain('AdminBranches');
    await expect(send('AdminBranches')).resolves.toEqual({
      data: { branches: [{ __typename: 'Branch', id: 'branch-a', name: 'Fixture' }] },
    });
    useFixtureScenario({
      failures: { 'AdminBranches:b-9': 'not-found', AdminMissing: 'unavailable' },
    });
    await expect(send('AdminBranches', { id: 'b-9' })).resolves.toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND', requestId: 'fixture-AdminBranches' } }],
    });
    await expect(send('AdminMissing')).resolves.toMatchObject({
      errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
    });
    useFixtureScenario({ failures: { AdminBranches: 'network' } });
    expect(await send('AdminBranches')).toBeInstanceOf(HttpErrorResponse);
    await expect(send('AdminUnknown')).resolves.toMatchObject({
      errors: [{ message: 'No Storybook fixture answers AdminUnknown.' }],
    });
  });

  it('builds field errors with backend codes', () => {
    const error = fixtureError('BAD_USER_INPUT', 'Invalid vehicle.', [
      { path: 'vin', message: 'VIN is already used.' },
    ]);
    expect(error.message).toBe('Invalid vehicle.');
    expect(error.extensions).toEqual({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: 'vin', message: 'VIN is already used.' }],
    });
    expect(fixtureError('CONFLICT', 'Changed.').extensions).toEqual({ code: 'CONFLICT' });
  });
});
