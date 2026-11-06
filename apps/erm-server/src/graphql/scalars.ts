import { Scalar, type CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, type ValueNode } from 'graphql';

@Scalar('DateTime')
export class DateTimeScalar implements CustomScalar<string, string> {
  readonly description = 'ISO-8601 instant with an offset; serialized in UTC with milliseconds.';

  serialize(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    throw new GraphQLError('DateTime cannot represent this value.');
  }

  // Services validate input formats so Router receives BAD_USER_INPUT fieldErrors.
  parseValue(value: unknown): string {
    if (typeof value !== 'string') {
      throw new GraphQLError('DateTime must be a string.');
    }
    return value;
  }

  parseLiteral(node: ValueNode): string {
    if (node.kind !== Kind.STRING) {
      throw new GraphQLError('DateTime must be a string.');
    }
    return node.value;
  }
}
