import type { Language } from '../../i18n/messages';
import { formatDateOnly, formatNumber } from '../format/format';
import { interpolate, uiMessages } from '../i18n/messages';

export type FilterFieldType = 'text' | 'enum' | 'number' | 'date' | 'boolean';

export const filterOperators = [
  'contains',
  'equals',
  'notEquals',
  'startsWith',
  'isAnyOf',
  'isNoneOf',
  'gt',
  'lt',
  'between',
  'before',
  'after',
  'on',
  'isTrue',
  'isFalse',
  'isEmpty',
  'isNotEmpty',
] as const;

export type FilterOperator = (typeof filterOperators)[number];

export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

/** A column a list can be filtered by, with the conditions its backend supports. */
export interface FilterField {
  readonly key: string;
  readonly label: string;
  readonly type: FilterFieldType;
  /** Supported conditions; the first one is preselected. */
  readonly operators: readonly FilterOperator[];
  /** Choices of an `enum` field. */
  readonly options?: readonly FilterOption[];
  /** Unit shown after `number` values, e.g. "km". */
  readonly unit?: string;
}

/**
 * One condition. Values are strings so a condition fits in the URL: numbers as decimal text,
 * dates as `YYYY-MM-DD`, enum choices as their values. All conditions apply together (AND).
 */
export interface FilterCondition {
  readonly id: string;
  readonly field: string;
  readonly operator: FilterOperator;
  readonly values: readonly string[];
}

export type FilterOperands = 'none' | 'one' | 'range' | 'set';

/** How many values a condition takes. */
export function operandsOf(operator: FilterOperator): FilterOperands {
  switch (operator) {
    case 'isTrue':
    case 'isFalse':
    case 'isEmpty':
    case 'isNotEmpty':
      return 'none';
    case 'between':
      return 'range';
    case 'isAnyOf':
    case 'isNoneOf':
      return 'set';
    default:
      return 'one';
  }
}

function isNumber(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== '' && Number.isFinite(Number(text));
}

function isDate(text: string | undefined): text is string {
  return text !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(text);
}

function isValue(type: FilterFieldType, text: string | undefined): boolean {
  if (type === 'number') return isNumber(text);
  if (type === 'date') return isDate(text);
  return text !== undefined && text.trim() !== '';
}

/** Whether the condition has every value its operator needs, in the right format and order. */
export function isComplete(field: FilterField, condition: FilterCondition): boolean {
  const [first, second] = condition.values;
  switch (operandsOf(condition.operator)) {
    case 'none':
      return true;
    case 'one':
      return isValue(field.type, first);
    case 'set':
      return condition.values.length > 0;
    case 'range': {
      if (!isValue(field.type, first) || !isValue(field.type, second)) return false;
      if (field.type === 'number') return Number(first) <= Number(second);
      return (first ?? '') <= (second ?? '');
    }
  }
}

function formatValue(field: FilterField, value: string, language: Language): string {
  if (field.type === 'number') {
    const number = formatNumber(Number(value), language);
    return field.unit ? `${number} ${field.unit}` : number;
  }
  if (field.type === 'date') return formatDateOnly(value, language);
  if (field.type === 'enum')
    return field.options?.find((option) => option.value === value)?.label ?? value;
  return value;
}

/** The chip text of a condition, e.g. "Status is any of Active, In service". */
export function describeCondition(
  field: FilterField,
  condition: FilterCondition,
  language: Language,
): string {
  const text = uiMessages[language].filters;
  const operator = text.operators[condition.operator];
  const values = condition.values.map((value) => formatValue(field, value, language));
  switch (operandsOf(condition.operator)) {
    case 'none':
      return field.type === 'boolean'
        ? `${field.label}: ${condition.operator === 'isTrue' ? text.yes : text.no}`
        : `${field.label} ${operator}`;
    case 'range':
      return `${field.label} ${interpolate(text.range, { from: values[0] ?? '', to: values[1] ?? '' })}`;
    case 'set':
      return `${field.label} ${operator} ${values.join(', ')}`;
    case 'one':
      return field.type === 'text' && condition.operator !== 'equals'
        ? `${field.label} ${operator} “${values[0] ?? ''}”`
        : `${field.label} ${operator} ${values[0] ?? ''}`;
  }
}
