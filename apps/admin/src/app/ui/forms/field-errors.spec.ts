import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { Language } from '../../i18n/messages';
import { uiMessages } from '../i18n/messages';
import { errorCode, fieldErrors } from './field-errors';

function graphqlError(extensions: Record<string, unknown>) {
  return new CombinedGraphQLErrors({ errors: [{ message: 'Invalid input.', extensions }] });
}

function reason(code: unknown) {
  return graphqlError({
    code: 'BAD_USER_INPUT',
    fieldErrors: [{ path: 'name', message: 'Same English compatibility message.', code }],
  });
}

const languages: readonly Language[] = ['bg', 'en'];

describe('GraphQL field errors', () => {
  it('reads the first known error code', () => {
    expect(errorCode(graphqlError({ code: 'CONFLICT' }))).toBe('CONFLICT');
    expect(errorCode(graphqlError({ code: 'SOMETHING_ELSE' }))).toBeNull();
    expect(errorCode(new Error('network'))).toBeNull();
  });

  it.each([
    { code: 'INVALID_VALUE', key: 'invalid' },
    { code: 'REQUIRED', key: 'required' },
    { code: 'INVALID_TYPE', key: 'invalid' },
    { code: 'INVALID_FORMAT', key: 'pattern' },
    { code: 'TOO_LONG', key: 'tooLong' },
    { code: 'TOO_MANY_ITEMS', key: 'tooManyItems' },
    { code: 'DUPLICATE_VALUE', key: 'duplicateValue' },
    { code: 'NOT_INTEGER', key: 'integer' },
    { code: 'OUT_OF_RANGE', key: 'outOfRange' },
    { code: 'UNSUPPORTED_VALUE', key: 'unsupportedValue' },
    { code: 'INVALID_RANGE', key: 'invalidRange' },
  ] as const)('localizes $code independently of English message text', ({ code, key }) => {
    for (const language of languages) {
      expect(fieldErrors(reason(code), ['name'], language)).toEqual({
        name: uiMessages[language].validation[key],
      });
    }
  });

  it('shows distinct reasons on the same field in Bulgarian and English', () => {
    for (const language of languages) {
      const required = fieldErrors(reason('REQUIRED'), ['name'], language).name;
      const tooLong = fieldErrors(reason('TOO_LONG'), ['name'], language).name;
      expect(required).not.toBe(tooLong);
      expect(required).not.toContain('English compatibility');
      expect(tooLong).not.toContain('English compatibility');
    }
    expect(fieldErrors(reason('REQUIRED'), ['name'], 'bg').name).not.toBe(
      fieldErrors(reason('REQUIRED'), ['name'], 'en').name,
    );
  });

  it.each([
    { code: undefined },
    { code: null },
    { code: 'FUTURE_REASON_2' },
    { code: 'A'.repeat(64) },
    { code: 'A'.repeat(65) },
    { code: '' },
    { code: 'required' },
    { code: '_REQUIRED' },
    { code: '2_REQUIRED' },
    { code: 'REQUIRED\n' },
    { code: ['REQUIRED'] },
    { code: { code: 'REQUIRED' } },
  ])('keeps unknown, legacy or malformed reason $code with a localized fallback', ({ code }) => {
    for (const language of languages) {
      expect(fieldErrors(reason(code), ['name'], language)).toEqual({
        name: uiMessages[language].validation.invalid,
      });
    }
  });

  it('accepts legacy messages without displaying them in Bulgarian or English', () => {
    const error = graphqlError({ fieldErrors: [{ path: 'name', message: 'Legacy English.' }] });
    for (const language of languages) {
      expect(fieldErrors(error, ['name'], language)).toEqual({
        name: uiMessages[language].validation.invalid,
      });
    }
  });

  it('maps only whitelisted paths and keeps the first bounded entry per field', () => {
    const error = graphqlError({
      fieldErrors: [
        { path: 'vin', message: 'First.', code: 'INVALID_FORMAT' },
        { path: 'vin', message: 'Second.', code: 'REQUIRED' },
        { path: 'unknown', message: 'Ignored.', code: 'REQUIRED' },
        { path: 'plate', message: 'x'.repeat(301), code: 'REQUIRED' },
        { path: 'plate' },
        'not an object',
        { path: 'notes', message: '😀'.repeat(150), code: 'TOO_LONG' },
      ],
    });
    expect(fieldErrors(error, ['vin', 'plate', 'notes'], 'bg')).toEqual({
      vin: uiMessages.bg.validation.pattern,
      notes: uiMessages.bg.validation.tooLong,
    });
    expect(fieldErrors(new Error('network'), ['vin'])).toEqual({});
  });

  it('keeps the first legacy field error across separate GraphQL failures', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        { message: 'Legacy.', extensions: { fieldErrors: [{ path: 'name', message: 'Legacy.' }] } },
        {
          message: 'New.',
          extensions: { fieldErrors: [{ path: 'name', message: 'New.', code: 'REQUIRED' }] },
        },
      ],
    });
    expect(fieldErrors(error, ['name'], 'bg')).toEqual({ name: uiMessages.bg.validation.invalid });
  });

  it('reads at most 30 entries and bounds messages in UTF-16 units', () => {
    const entries = Array.from({ length: 31 }, (_, index) =>
      index === 30 ? { path: 'late', message: 'Late.' } : { path: 'other', message: 'Other.' },
    );
    expect(fieldErrors(graphqlError({ fieldErrors: entries }), ['late'])).toEqual({});
    expect(
      fieldErrors(
        graphqlError({
          fieldErrors: [{ path: 'name', message: '😀'.repeat(151), code: 'REQUIRED' }],
        }),
        ['name'],
      ),
    ).toEqual({});
  });

  it('passes only valid reasons and known paths to a concrete feature translator', () => {
    const translate = vi.fn((code: string) =>
      code === 'FUTURE_REASON_2' ? 'Feature text.' : undefined,
    );
    expect(fieldErrors(reason('FUTURE_REASON_2'), ['name'], 'en', translate)).toEqual({
      name: 'Feature text.',
    });
    expect(translate).toHaveBeenCalledWith('FUTURE_REASON_2', 'name');
    expect(fieldErrors(reason('A'.repeat(64)), ['name'], 'en', translate)).toEqual({
      name: uiMessages.en.validation.invalid,
    });
    expect(translate).toHaveBeenCalledWith('A'.repeat(64), 'name');
    expect(fieldErrors(reason('A'), ['name'], 'en', translate)).toEqual({
      name: uiMessages.en.validation.invalid,
    });
    expect(translate).toHaveBeenCalledWith('A', 'name');
    translate.mockClear();
    expect(fieldErrors(reason('A'.repeat(65)), ['name'], 'en', translate)).toEqual({
      name: uiMessages.en.validation.invalid,
    });
    expect(fieldErrors(reason('REQUIRED\n'), ['name'], 'en', translate)).toEqual({
      name: uiMessages.en.validation.invalid,
    });
    expect(fieldErrors(reason('REQUIRED'), ['other'], 'en', translate)).toEqual({});
    expect(translate).not.toHaveBeenCalled();
    expect(fieldErrors(reason('DRIVER_ASSIGNED'), ['name'], 'en')).toEqual({
      name: uiMessages.en.validation.invalid,
    });
  });
});
