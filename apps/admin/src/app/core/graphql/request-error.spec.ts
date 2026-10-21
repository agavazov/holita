import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { requestError } from './request-error';

function graphqlError(fieldErrors: unknown, code = 'BAD_USER_INPUT') {
  return new CombinedGraphQLErrors({
    errors: [
      {
        message: 'English server validation text.',
        extensions: { code, requestId: 'validation-request', fieldErrors },
      },
    ],
  });
}

describe('Localized request error banners', () => {
  it('uses the caller fallback for bounded field errors and preserves the request ID', () => {
    const error = graphqlError([
      { path: 'name', message: 'English field message.', code: 'TOO_LONG' },
    ]);
    expect(requestError(error, 'Записът е неуспешен.')).toBe(
      'Записът е неуспешен. (validation-request)',
    );
    expect(requestError(error, 'Save failed.')).toBe('Save failed. (validation-request)');
  });

  it('also localizes legacy field errors and invalid reason metadata', () => {
    for (const entry of [
      { path: 'name', message: 'Legacy English.' },
      { path: 'name', message: 'English.', code: 'not-valid' },
      { path: 'name', message: 'x'.repeat(300), code: 'FUTURE_REASON_2' },
    ]) {
      expect(requestError(graphqlError([entry]), 'Проверете полетата.')).toBe(
        'Проверете полетата. (validation-request)',
      );
    }
  });

  it('does not treat malformed or over-limit details as valid field errors', () => {
    for (const entries of [
      [{ path: 'name', message: 'x'.repeat(301) }],
      [{ path: 'name', message: 4 }],
      [{ path: 'invalid.path', message: 'English.' }],
      Array.from({ length: 31 }, (_, index) =>
        index === 30
          ? { path: 'name', message: 'Late.' }
          : { path: 'invalid.path', message: 'Ignored.' },
      ),
      'invalid',
    ]) {
      expect(requestError(graphqlError(entries), 'Fallback.')).toBe(
        'English server validation text. (validation-request)',
      );
    }
  });

  it('retains non-validation GraphQL messages and network request IDs', () => {
    expect(
      requestError(graphqlError([{ path: 'name', message: 'Detail.' }], 'CONFLICT'), 'Fallback.'),
    ).toBe('English server validation text. (validation-request)');
    const error = Object.assign(new Error('Network details'), { requestId: 'network-request' });
    expect(requestError(error, 'Няма връзка.')).toBe('Няма връзка. (network-request)');
    expect(requestError(new Error('Network details'), 'Fallback.')).toBe('Fallback.');
  });
});
