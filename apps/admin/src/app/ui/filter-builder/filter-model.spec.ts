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
});
