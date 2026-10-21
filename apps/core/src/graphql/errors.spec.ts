import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { formatGraphqlError } from './errors.js';

function formattedFields(fieldErrors: unknown): unknown {
  const failure = new BadRequestException({ message: 'Invalid input.', fieldErrors });
  return formatGraphqlError(
    { message: failure.message },
    new GraphQLError(failure.message, { path: ['fixtureMutation'], originalError: failure }),
  ).extensions?.['fieldErrors'];
}

describe('Core GraphQL error fields', () => {
  it('publishes safe field errors for invalid input while dropping other exception details', () => {
    const failure = new BadRequestException({
      message: 'Invalid Branch name.',
      fieldErrors: [
        {
          path: 'name',
          message: 'Use 1 to 80 supported characters.',
          code: 'TOO_LONG',
          internal: 'hidden',
        },
        { path: 'invalid.path', message: 'Unsupported path' },
        { path: 'name', message: 'x'.repeat(301) },
        { path: 'name', message: 10 },
      ],
      internal: 'hidden',
    });
    expect(
      formatGraphqlError(
        {
          message: 'Invalid Branch name.',
          extensions: { requestId: 'core-test', internal: 'hidden' },
        },
        new GraphQLError(failure.message, { originalError: failure, path: ['updateBranchName'] }),
      ),
    ).toEqual({
      message: 'Invalid Branch name.',
      extensions: {
        code: 'BAD_USER_INPUT',
        requestId: 'core-test',
        fieldErrors: [
          { path: 'name', message: 'Use 1 to 80 supported characters.', code: 'TOO_LONG' },
        ],
      },
    });
  });

  it('preserves legacy entries and syntactically valid future reason codes', () => {
    expect(
      formattedFields([
        { path: 'name', message: 'Legacy message.' },
        { path: 'name', message: 'Future message.', code: 'FUTURE_REASON_2' },
        { path: 'name', message: 'Maximum code.', code: 'A'.repeat(64) },
        { path: 'name', message: 'Minimum code.', code: 'A' },
      ]),
    ).toEqual([
      { path: 'name', message: 'Legacy message.' },
      { path: 'name', message: 'Future message.', code: 'FUTURE_REASON_2' },
      { path: 'name', message: 'Maximum code.', code: 'A'.repeat(64) },
      { path: 'name', message: 'Minimum code.', code: 'A' },
    ]);
  });

  it.each([
    { code: '' },
    { code: 'A'.repeat(65) },
    { code: 'required' },
    { code: '_REQUIRED' },
    { code: '2_REQUIRED' },
    { code: 'HAS-DASH' },
    { code: ' HAS_SPACE' },
    { code: 'REQUIRED\n' },
    { code: 'REQUIRED\r' },
    { code: 'REQUIRED\u2028' },
    { code: 'NON_ASCII_Ж' },
    { code: 42 },
    { code: null },
    { code: undefined },
    { code: ['REQUIRED'] },
    { code: { code: 'REQUIRED' } },
  ])('omits invalid reason metadata $code while retaining the legacy field error', ({ code }) => {
    expect(formattedFields([{ path: 'name', message: 'Compatibility message.', code }])).toEqual([
      { path: 'name', message: 'Compatibility message.' },
    ]);
  });

  it('retains the 30-entry and 300-UTF-16-unit bounds', () => {
    const entry = { path: 'name', message: 'x'.repeat(300), code: 'REQUIRED' };
    expect(formattedFields(Array.from({ length: 31 }, () => entry))).toEqual(
      Array.from({ length: 30 }, () => entry),
    );
    expect(formattedFields([{ ...entry, message: 'x'.repeat(301) }])).toBeUndefined();
    expect(formattedFields([{ ...entry, message: '😀'.repeat(151) }])).toBeUndefined();
    expect(formattedFields('invalid')).toBeUndefined();
  });

  it('keeps unknown persistence errors private', () => {
    expect(
      formatGraphqlError(
        {
          message: 'Private adapter failure',
          extensions: { requestId: 'core-test', internal: 'hidden' },
        },
        new GraphQLError('Private adapter failure', {
          originalError: new Error('Private adapter failure'),
        }),
      ),
    ).toEqual({
      message: 'Internal server error',
      extensions: { code: 'INTERNAL_SERVER_ERROR', requestId: 'core-test' },
    });
  });
});
