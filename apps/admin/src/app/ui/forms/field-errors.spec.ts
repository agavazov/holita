import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { errorCode, fieldErrors } from './field-errors';

function graphqlError(extensions: Record<string, unknown>) {
  return new CombinedGraphQLErrors({ errors: [{ message: 'Invalid input.', extensions }] });
}

describe('GraphQL field errors', () => {
  it('reads the first known error code', () => {
    expect(errorCode(graphqlError({ code: 'CONFLICT' }))).toBe('CONFLICT');
    expect(errorCode(graphqlError({ code: 'SOMETHING_ELSE' }))).toBeNull();
    expect(errorCode(new Error('network'))).toBeNull();
  });

  it('maps the first message per known path and ignores malformed entries', () => {
    const error = graphqlError({
      code: 'BAD_USER_INPUT',
      fieldErrors: [
        { path: 'vin', message: 'VIN is already used.' },
        { path: 'vin', message: 'Second message.' },
        { path: 'unknown', message: 'Ignored.' },
        { path: 'plate', message: 'x'.repeat(301) },
        { path: 'plate' },
        'not an object',
        { path: 'notes', message: 'Too long.' },
      ],
    });
    expect(fieldErrors(error, ['vin', 'plate', 'notes'] as const)).toEqual({
      vin: 'VIN is already used.',
      notes: 'Too long.',
    });
    expect(fieldErrors(new Error('network'), ['vin'] as const)).toEqual({});
  });

  it('reads at most 30 entries', () => {
    const entries = Array.from({ length: 31 }, (_, index) =>
      index === 30 ? { path: 'late', message: 'Late.' } : { path: 'other', message: 'Other.' },
    );
    expect(fieldErrors(graphqlError({ fieldErrors: entries }), ['late'] as const)).toEqual({});
  });
});
