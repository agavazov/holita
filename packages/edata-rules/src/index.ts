/** Monitor 9.56 expression representation; it does not simulate device evaluation. */
export type RuleOperator =
  '+' | '-' | '*' | '/' | '=' | '!=' | '>' | '>=' | '<' | '<=' | '--' | 'or' | 'and' | 'mod';
export type RuleFunction = 'TimeOf' | 'Count' | 'Sum';
export type RuleExpression =
  | { readonly kind: 'parameter'; readonly parameterId: number }
  | { readonly kind: 'integer'; readonly value: number }
  | {
      readonly kind: 'operator';
      readonly operator: RuleOperator;
      readonly children: readonly RuleExpression[];
    }
  | { readonly kind: 'function'; readonly function: RuleFunction; readonly child: RuleExpression };

export interface RuleRecord {
  readonly ruleId: number;
  readonly trueEventId: number;
  readonly falseEventId: number;
  readonly debounceMilliseconds: number;
  readonly activateDashboard: boolean;
  readonly ruleDataHex: string;
}

export class RuleFormatError extends Error {
  constructor(
    readonly code:
      | 'SYNTAX'
      | 'MIXED_OPERATORS'
      | 'INTEGER_RANGE'
      | 'PARAMETER_RANGE'
      | 'EXPRESSION_SIZE'
      | 'INVALID_HEX'
      | 'UNKNOWN_OPCODE'
      | 'TRUNCATED'
      | 'TRAILING_BYTES'
      | 'INVALID_ARITY'
      | 'RECORD_FIELDS',
  ) {
    super(`Invalid eData rule: ${code}`);
    this.name = 'RuleFormatError';
  }
}

const operators: readonly RuleOperator[] = [
  '+',
  '-',
  '*',
  '/',
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  '--',
  'or',
  'and',
  'mod',
];
const functions: readonly RuleFunction[] = ['TimeOf', 'Count', 'Sum'];

function integer(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function bytes(hex: string): number[] {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new RuleFormatError('INVALID_HEX');
  }
  return Array.from({ length: hex.length / 2 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
}

function hex(values: readonly number[]): string {
  return values
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function word(value: number): number[] {
  return [Math.floor(value / 256), value % 256];
}

/** ID notation is [718]; mixed operators require explicit grouping, as in Monitor. */
export function parseRuleExpression(text: string): RuleExpression {
  const tokens: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    const rest = text.slice(offset);
    const space = /^\s+/.exec(rest)?.[0];
    if (space) {
      offset += space.length;
      continue;
    }
    const token =
      /^(\[\d+\]|\$?(?:TimeOf|Count|Sum)\b|and\b|or\b|mod\b|\d+|>=|<=|!=|--|[()+\-*/=<>])/i.exec(
        rest,
      )?.[0];
    if (!token) {
      throw new RuleFormatError('SYNTAX');
    }
    tokens.push(token);
    offset += token.length;
  }
  let position = 0;
  const atom = (depth: number): RuleExpression => {
    if (depth > 128) {
      throw new RuleFormatError('EXPRESSION_SIZE');
    }
    const token = tokens[position++];
    if (!token) {
      throw new RuleFormatError('SYNTAX');
    }
    if (token === '(') {
      const child = expression(depth + 1);
      if (tokens[position++] !== ')') {
        throw new RuleFormatError('SYNTAX');
      }
      return child;
    }
    const fn = functions.find(
      (name) => name.toLowerCase() === token.replace(/^\$/, '').toLowerCase(),
    );
    if (fn) {
      if (tokens[position++] !== '(') {
        throw new RuleFormatError('SYNTAX');
      }
      const child = expression(depth + 1);
      if (tokens[position++] !== ')') {
        throw new RuleFormatError('SYNTAX');
      }
      return { kind: 'function', function: fn, child };
    }
    if (/^\[\d+\]$/.test(token)) {
      const parameterId = Number(token.slice(1, -1));
      if (!integer(parameterId, 0, 65535)) {
        throw new RuleFormatError('PARAMETER_RANGE');
      }
      return { kind: 'parameter', parameterId };
    }
    let numberToken = token;
    if (token === '-') {
      const magnitude = tokens[position++];
      if (!magnitude || !/^\d+$/.test(magnitude)) {
        throw new RuleFormatError('SYNTAX');
      }
      numberToken = `-${magnitude}`;
    }
    if (!/^-?\d+$/.test(numberToken)) {
      throw new RuleFormatError('SYNTAX');
    }
    const value = Number(numberToken);
    if (!integer(value, -65535, 2147483647)) {
      throw new RuleFormatError('INTEGER_RANGE');
    }
    return { kind: 'integer', value };
  };
  const expression = (depth: number): RuleExpression => {
    let result = atom(depth);
    let groupOperator: RuleOperator | undefined;
    while (position < tokens.length && tokens[position] !== ')') {
      const token = tokens[position++]?.toLowerCase();
      const operator = operators.find((candidate) => candidate === token);
      if (!operator) {
        throw new RuleFormatError('SYNTAX');
      }
      if (groupOperator && groupOperator !== operator) {
        throw new RuleFormatError('MIXED_OPERATORS');
      }
      groupOperator = operator;
      result = { kind: 'operator', operator, children: [result, atom(depth)] };
    }
    return result;
  };
  const result = expression(0);
  if (position !== tokens.length) {
    throw new RuleFormatError('SYNTAX');
  }
  encodeRuleData(result);
  return result;
}

export function renderRuleExpression(expression: RuleExpression): string {
  switch (expression.kind) {
    case 'parameter':
      return `[${String(expression.parameterId)}]`;
    case 'integer':
      return String(expression.value);
    case 'operator':
      return `(${expression.children.map(renderRuleExpression).join(` ${expression.operator} `)})`;
    case 'function':
      return `$${expression.function}(${renderRuleExpression(expression.child)})`;
  }
}

export function referencedParameterIds(expression: RuleExpression): number[] {
  const ids = new Set<number>();
  const visit = (node: RuleExpression): void => {
    switch (node.kind) {
      case 'parameter':
        ids.add(node.parameterId);
        break;
      case 'operator':
        node.children.forEach(visit);
        break;
      case 'function':
        visit(node.child);
        break;
      case 'integer':
        break;
    }
  };
  visit(expression);
  return [...ids].sort((a, b) => a - b);
}

/** Imported n-ary nodes stay inspectable without silently becoming binary trees. */
export function editableRuleExpression(expression: RuleExpression): boolean {
  if (expression.kind === 'operator') {
    return expression.children.length === 2 && expression.children.every(editableRuleExpression);
  }
  return expression.kind !== 'function' || editableRuleExpression(expression.child);
}

export function encodeRuleData(expression: RuleExpression): string {
  const result: number[] = [];
  const emit = (node: RuleExpression, depth: number): void => {
    if (depth > 128 || result.length > 128) {
      throw new RuleFormatError('EXPRESSION_SIZE');
    }
    switch (node.kind) {
      case 'parameter':
        if (!integer(node.parameterId, 0, 65535)) {
          throw new RuleFormatError('PARAMETER_RANGE');
        }
        result.push(0x15, ...word(node.parameterId));
        break;
      case 'integer': {
        if (!integer(node.value, -65535, 2147483647)) {
          throw new RuleFormatError('INTEGER_RANGE');
        }
        const magnitude = Math.abs(node.value);
        if (magnitude <= 255) {
          result.push(node.value < 0 ? 0x12 : 0x0f, magnitude);
        } else if (magnitude <= 65535) {
          result.push(node.value < 0 ? 0x13 : 0x10, ...word(magnitude));
        } else {
          result.push(0x11, ...word(Math.floor(magnitude / 65536)), ...word(magnitude % 65536));
        }
        break;
      }
      case 'operator': {
        const code = operators.indexOf(node.operator) + 1;
        if (!code) {
          throw new RuleFormatError('UNKNOWN_OPCODE');
        }
        if (
          !integer(node.children.length, 2, 255) ||
          ((node.operator === 'mod' || node.operator === '--') && node.children.length !== 2)
        ) {
          throw new RuleFormatError('INVALID_ARITY');
        }
        result.push(code, node.children.length);
        node.children.forEach((child) => {
          emit(child, depth + 1);
        });
        break;
      }
      case 'function': {
        const index = functions.indexOf(node.function);
        if (index < 0) {
          throw new RuleFormatError('UNKNOWN_OPCODE');
        }
        result.push(0x16 + index);
        emit(node.child, depth + 1);
        break;
      }
    }
  };
  emit(expression, 0);
  if (result.length > 128) {
    throw new RuleFormatError('EXPRESSION_SIZE');
  }
  return hex(result);
}

export function decodeRuleData(value: string): RuleExpression {
  const data = bytes(value);
  if (data.length > 128) {
    throw new RuleFormatError('EXPRESSION_SIZE');
  }
  let position = 0;
  const next = (): number => {
    const value = data[position++];
    if (value === undefined) {
      throw new RuleFormatError('TRUNCATED');
    }
    return value;
  };
  const unsigned = (size: number): number => {
    let value = 0;
    for (let index = 0; index < size; index++) {
      value = value * 256 + next();
    }
    return value;
  };
  const node = (): RuleExpression => {
    const opcode = next();
    const operator = operators[opcode - 1];
    if (operator) {
      const count = next();
      if (count < 2 || ((operator === 'mod' || operator === '--') && count !== 2)) {
        throw new RuleFormatError('INVALID_ARITY');
      }
      return { kind: 'operator', operator, children: Array.from({ length: count }, node) };
    }
    if (opcode >= 0x0f && opcode <= 0x13) {
      const sizes = [1, 2, 4, 1, 2];
      const size = sizes[opcode - 0x0f];
      if (size === undefined) {
        throw new RuleFormatError('UNKNOWN_OPCODE');
      }
      const value = unsigned(size) * (opcode >= 0x12 ? -1 : 1);
      if (!integer(value, -65535, 2147483647)) {
        throw new RuleFormatError('INTEGER_RANGE');
      }
      return { kind: 'integer', value };
    }
    if (opcode === 0x15) {
      return { kind: 'parameter', parameterId: unsigned(2) };
    }
    const fn = functions[opcode - 0x16];
    if (fn) {
      return { kind: 'function', function: fn, child: node() };
    }
    throw new RuleFormatError('UNKNOWN_OPCODE');
  };
  const result = node();
  if (position !== data.length) {
    throw new RuleFormatError('TRAILING_BYTES');
  }
  return result;
}

export function encodeRuleRecord(record: RuleRecord): string {
  if (
    ![record.ruleId, record.trueEventId, record.falseEventId].every((value) =>
      integer(value, 0, 65535),
    ) ||
    !integer(record.debounceMilliseconds, 1, 32767)
  ) {
    throw new RuleFormatError('RECORD_FIELDS');
  }
  const data = bytes(record.ruleDataHex);
  if (data.length > 128) {
    throw new RuleFormatError('EXPRESSION_SIZE');
  }
  return hex([
    ...word(record.ruleId),
    ...word(record.trueEventId),
    ...word(record.falseEventId),
    ...word(record.debounceMilliseconds + (record.activateDashboard ? 32768 : 0)),
    data.length,
    ...data,
  ]);
}

/** Frame decoding retains unknown expressions for byte-for-byte snapshot comparison. */
export function decodeRuleRecord(value: string): RuleRecord {
  const data = bytes(value);
  const size = data[8];
  if (size === undefined || size < 1 || size > 128 || data.length !== size + 9) {
    throw new RuleFormatError('RECORD_FIELDS');
  }
  const valueAt = (position: number): number =>
    (data[position] ?? 0) * 256 + (data[position + 1] ?? 0);
  const flags = valueAt(6);
  const debounceMilliseconds = flags & 0x7fff;
  if (!debounceMilliseconds) {
    throw new RuleFormatError('RECORD_FIELDS');
  }
  return {
    ruleId: valueAt(0),
    trueEventId: valueAt(2),
    falseEventId: valueAt(4),
    debounceMilliseconds,
    activateDashboard: !!(flags & 0x8000),
    ruleDataHex: hex(data.slice(9)),
  };
}
