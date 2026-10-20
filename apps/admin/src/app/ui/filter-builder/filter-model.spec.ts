import {
  describeCondition,
  type FilterCondition,
  type FilterField,
  isComplete,
  operandsOf,
} from './filter-model';

const status: FilterField = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  operators: ['isAnyOf', 'isNoneOf'],
  options: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'IN_WORKSHOP', label: 'In service' },
  ],
};
const odometer: FilterField = {
  key: 'odometer',
  label: 'Odometer',
  type: 'number',
  unit: 'km',
  operators: ['gt', 'between'],
};
const added: FilterField = { key: 'added', label: 'Added', type: 'date', operators: ['between'] };
const model: FilterField = { key: 'model', label: 'Model', type: 'text', operators: ['contains'] };
const tracker: FilterField = {
  key: 'tracker',
  label: 'Has a tracker',
  type: 'boolean',
  operators: ['isTrue', 'isFalse'],
};

function condition(field: FilterField, operator: FilterCondition['operator'], values: string[]) {
  return { id: 'x', field: field.key, operator, values } satisfies FilterCondition;
}

describe('filter model', () => {
  it('counts the values each condition takes', () => {
    expect(operandsOf('isTrue')).toBe('none');
    expect(operandsOf('contains')).toBe('one');
    expect(operandsOf('between')).toBe('range');
    expect(operandsOf('isAnyOf')).toBe('set');
  });

  it('accepts only complete, well-formed and ordered values', () => {
    expect(isComplete(model, condition(model, 'contains', ['MAN']))).toBe(true);
    expect(isComplete(model, condition(model, 'contains', ['  ']))).toBe(false);
    expect(isComplete(odometer, condition(odometer, 'gt', ['12.5']))).toBe(true);
    expect(isComplete(odometer, condition(odometer, 'gt', ['many']))).toBe(false);
    expect(isComplete(odometer, condition(odometer, 'between', ['10', '5']))).toBe(false);
    expect(isComplete(odometer, condition(odometer, 'between', ['5', '5']))).toBe(true);
    expect(isComplete(added, condition(added, 'between', ['2026-01-02', '2026-01-01']))).toBe(
      false,
    );
    expect(isComplete(added, condition(added, 'between', ['2026-01-01', '2026-01-31']))).toBe(true);
    expect(isComplete(status, condition(status, 'isAnyOf', []))).toBe(false);
    expect(isComplete(tracker, condition(tracker, 'isFalse', []))).toBe(true);
  });

  it('keeps numeric bounds inclusive, requires whole model years and retains decimal odometers', () => {
    const year: FilterField = {
      key: 'year',
      label: 'Year',
      type: 'number',
      operators: ['equals', 'between'],
      min: 1950,
      max: 2100,
      integer: true,
    };
    for (const value of ['1900', '2101', '2024.5']) {
      expect(isComplete(year, condition(year, 'equals', [value]))).toBe(false);
    }
    expect(isComplete(year, condition(year, 'between', ['1950', '2100']))).toBe(true);
    expect(isComplete(year, condition(year, 'between', ['1950', '2101']))).toBe(false);
    const bounded: FilterField = { ...odometer, min: 0, max: 10_000_000 };
    expect(isComplete(bounded, condition(bounded, 'between', ['0', '10000000']))).toBe(true);
    expect(isComplete(bounded, condition(bounded, 'gt', ['123.4']))).toBe(true);
    expect(isComplete(bounded, condition(bounded, 'gt', ['-1']))).toBe(false);
    expect(isComplete(bounded, condition(bounded, 'gt', ['10000000.1']))).toBe(false);
  });

  it('requires explicit currency precision without changing existing integer or decimal fields', () => {
    const cost: FilterField = {
      key: 'cost',
      label: 'Cost',
      type: 'number',
      operators: ['gt'],
      min: 0,
      max: 1_000_000,
      decimalPlaces: 2,
    };
    expect(isComplete(cost, condition(cost, 'gt', ['0.001']))).toBe(false);
    for (const value of ['0', '0.01', '0.29', '1000000']) {
      expect(isComplete(cost, condition(cost, 'gt', [value]))).toBe(true);
    }
    expect(isComplete(cost, condition(cost, 'gt', ['1000000.01']))).toBe(false);
    expect(isComplete({ ...cost, integer: true }, condition(cost, 'gt', ['0.01']))).toBe(false);
    expect(isComplete(odometer, condition(odometer, 'gt', ['0.001']))).toBe(true);
  });

  it('bounds trimmed text by Unicode code points and bounds every selected value set', () => {
    const make: FilterField = { ...model, maxLength: 64 };
    expect(isComplete(make, condition(make, 'contains', [` ${'😀'.repeat(64)} `]))).toBe(true);
    expect(isComplete(make, condition(make, 'contains', ['😀'.repeat(65)]))).toBe(false);
    const choices: FilterField = { ...status, maxValues: 100 };
    const values = Array.from({ length: 101 }, (_, index) => String(index));
    expect(isComplete(choices, condition(choices, 'isAnyOf', values))).toBe(false);
    expect(isComplete(choices, condition(choices, 'isAnyOf', values.slice(0, 100)))).toBe(true);
  });

  it('describes conditions as chip text with labels, units and formats', () => {
    expect(
      describeCondition(status, condition(status, 'isAnyOf', ['ACTIVE', 'IN_WORKSHOP']), 'en'),
    ).toBe('Status is any of Active, In service');
    expect(
      describeCondition(odometer, condition(odometer, 'between', ['100000', '400000']), 'en'),
    ).toBe('Odometer between 100,000 km and 400,000 km');
    expect(describeCondition(model, condition(model, 'contains', ['MAN']), 'en')).toBe(
      'Model contains “MAN”',
    );
    expect(describeCondition(tracker, condition(tracker, 'isFalse', []), 'en')).toBe(
      'Has a tracker: no',
    );
  });

  it.each([
    {
      language: 'en' as const,
      label: 'Cost',
      amounts: ['Cost greater than 0.01 EUR', 'Cost greater than 0.29 EUR'],
      range: 'Cost between 0.01 EUR and 0.29 EUR',
      zero: 'Cost greater than 0 EUR',
    },
    {
      language: 'bg' as const,
      label: 'Разход',
      amounts: ['Разход по-голямо от 0,01 EUR', 'Разход по-голямо от 0,29 EUR'],
      range: 'Разход между 0,01 EUR и 0,29 EUR',
      zero: 'Разход по-голямо от 0 EUR',
    },
  ])('describes exact currency amounts, ranges and zero in $language', (expected) => {
    const cost: FilterField = {
      key: 'cost',
      label: expected.label,
      type: 'number',
      unit: 'EUR',
      operators: ['gt', 'between'],
      min: 0,
      decimalPlaces: 2,
    };
    for (const [index, value] of ['0.01', '0.29'].entries()) {
      const filter = condition(cost, 'gt', [value]);
      expect(isComplete(cost, filter)).toBe(true);
      expect(describeCondition(cost, filter, expected.language)).toBe(expected.amounts[index]);
      expect(filter.values).toEqual([value]);
    }
    const range = condition(cost, 'between', ['0.01', '0.29']);
    expect(describeCondition(cost, range, expected.language)).toBe(expected.range);
    expect(range.values).toEqual(['0.01', '0.29']);
    expect(describeCondition(cost, condition(cost, 'gt', ['0']), expected.language)).toBe(
      expected.zero,
    );
  });

  it.each([
    {
      language: 'en' as const,
      label: 'Odometer',
      unit: 'km',
      labels: [
        'Odometer greater than 123.4 km',
        'Odometer greater than 0.001 km',
        'Odometer greater than 0.000000000000000000001 km',
      ],
    },
    {
      language: 'bg' as const,
      label: 'Километраж',
      unit: 'км',
      labels: [
        'Километраж по-голямо от 123,4 км',
        'Километраж по-голямо от 0,001 км',
        'Километраж по-голямо от 0,000000000000000000001 км',
      ],
    },
  ])('retains accepted fractional odometer values in $language chip text', (expected) => {
    const field = { ...odometer, label: expected.label, unit: expected.unit };
    for (const [index, value] of ['123.4', '0.001', '1e-21'].entries()) {
      const filter = condition(field, 'gt', [value]);
      expect(isComplete(field, filter)).toBe(true);
      expect(describeCondition(field, filter, expected.language)).toBe(expected.labels[index]);
      expect(filter.values).toEqual([value]);
    }
    const tiny = String(Number.MIN_VALUE);
    const minimum = condition(field, 'gt', [tiny]);
    expect(isComplete(field, minimum)).toBe(true);
    const separator = expected.language === 'bg' ? ',' : '.';
    expect(describeCondition(field, minimum, expected.language)).toContain(
      `0${separator}${'0'.repeat(323)}5 ${expected.unit}`,
    );
    expect(minimum.values).toEqual([tiny]);
  });
});
