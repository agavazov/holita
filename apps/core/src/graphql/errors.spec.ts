import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { formatGraphqlError } from './errors.js';

describe('Core GraphQL error fields', () => {
  it('publishes safe field errors for invalid input while dropping other exception details', () => {
    const failure = new BadRequestException({
      message: 'Invalid Branch name.',
      fieldErrors: [
        { path: 'name', message: 'Use 1 to 80 supported characters.', internal: 'hidden' },
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
        fieldErrors: [{ path: 'name', message: 'Use 1 to 80 supported characters.' }],
      },
    });
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
