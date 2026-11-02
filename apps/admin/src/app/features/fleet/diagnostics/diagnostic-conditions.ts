import {
  isComplete,
  type FilterCondition,
  type FilterField,
} from '../../../ui/filter-builder/filter-model';
import { fromDateOnly } from '../../../ui/format/zoned-time';
import type { FilterCodec } from '../../../ui/list/list-state';

function conditionOf(fields: readonly FilterField[], value: unknown): FilterCondition | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('field' in value) ||
    !('operator' in value) ||
    !('values' in value) ||
    !Array.isArray(value.values)
  ) {
    return null;
  }
  const field = fields.find((field) => field.key === value.field);
  const operator = field?.operators.find((operator) => operator === value.operator);
  if (!field || !operator) {
    return null;
  }
  const values: string[] = [];
  for (const entry of value.values) {
    if (typeof entry !== 'string') {
      return null;
    }
    values.push(entry);
  }
  const condition = { id: value.id, field: field.key, operator, values };
  if (
    !isComplete(field, condition) ||
    (field.options &&
      values.some((value) => !field.options?.some((option) => option.value === value))) ||
    (field.type === 'date' && values.some((value) => !fromDateOnly(value)))
  ) {
    return null;
  }
  return condition;
}

export function diagnosticConditions(
  fields: readonly FilterField[],
): FilterCodec<readonly FilterCondition[]> {
  return {
    read(values) {
      try {
        const parsed: unknown = JSON.parse(values.join(','));
        return Array.isArray(parsed)
          ? parsed.flatMap((value: unknown) => {
              const condition = conditionOf(fields, value);
              return condition ? [condition] : [];
            })
          : undefined;
      } catch {
        return undefined;
      }
    },
    write: (value) => (value?.length ? JSON.stringify(value) : null),
    same: (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []),
  };
}
