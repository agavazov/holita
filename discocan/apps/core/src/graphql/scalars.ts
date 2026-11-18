import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';

export const DateTimeScalar = new GraphQLScalarType<string, string>({
  name: 'DateTime',
  description: 'ISO-8601 instant with an offset; serialized in UTC with milliseconds.',
  serialize(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    throw new GraphQLError('DateTime cannot represent this value.');
  },
  parseValue(value) {
    if (typeof value !== 'string') {
      throw new GraphQLError('DateTime must be a string.');
    }
    return value;
  },
  parseLiteral(node) {
    if (node.kind !== Kind.STRING) {
      throw new GraphQLError('DateTime must be a string.');
    }
    return node.value;
  },
});
