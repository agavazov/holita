import { GraphQLError, GraphQLScalarType, Kind, type ValueNode } from 'graphql';

// Router cannot validate custom scalars, so inputs are accepted leniently as strings and the
// services validate their format (`dateTime`, `dateOnly` in validation.ts) and answer with
// BAD_USER_INPUT fieldErrors instead of a subgraph variable-coercion failure.

function stringInput(name: string, value: unknown): string {
  if (typeof value !== 'string') throw new GraphQLError(`${name} must be a string.`);
  return value;
}

function stringLiteral(name: string, node: ValueNode): string {
  if (node.kind !== Kind.STRING) throw new GraphQLError(`${name} must be a string.`);
  return node.value;
}

/** `YYYY-MM-DD` that names a real calendar day (checked by a UTC round trip). */
export function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);
  return !Number.isNaN(date.getTime()) && dateToDateOnly(date) === value;
}

/** Converts a validated `YYYY-MM-DD` to the UTC-midnight instant Prisma uses for `@db.Date`. */
export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Reads a `@db.Date` value (UTC midnight) as `YYYY-MM-DD`. */
export function dateToDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const DateTimeScalar = new GraphQLScalarType<string, string>({
  name: 'DateTime',
  description: 'ISO-8601 instant with an offset; serialized in UTC with milliseconds.',
  serialize(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    throw new GraphQLError('DateTime cannot represent this value.');
  },
  parseValue: (value) => stringInput('DateTime', value),
  parseLiteral: (node) => stringLiteral('DateTime', node),
});

export const DateScalar = new GraphQLScalarType<string, string>({
  name: 'Date',
  description: 'Calendar date YYYY-MM-DD without a time zone.',
  serialize(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const text = dateToDateOnly(value);
      if (dateOnlyToDate(text).getTime() === value.getTime()) return text;
    } else if (typeof value === 'string' && isDateOnly(value)) return value;
    throw new GraphQLError('Date cannot represent this value.');
  },
  parseValue: (value) => stringInput('Date', value),
  parseLiteral: (node) => stringLiteral('Date', node),
});
