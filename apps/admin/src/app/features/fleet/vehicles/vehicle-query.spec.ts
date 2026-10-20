import { convertToParamMap } from '@angular/router';
import { readListState, listStateParams } from '../../../ui/list/list-state';
import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import {
  vehicleDefinition,
  vehicleVariables,
  vehicleViewQuery,
  vehicleQueryState,
} from './vehicle-query';

const id = '20000000-0000-4000-8000-000000000001';
const read = (params: Record<string, string> = {}) =>
  readListState(convertToParamMap(params), vehicleDefinition);

describe('Vehicles URL and GraphQL mapping', () => {
  it('defaults to the Storybook plate sort without resetting bookmarked pages', () => {
    const state = read({ page: '8', pageSize: '50' });
    expect(vehicleVariables(state)).toEqual({
      offset: 350,
      limit: 50,
      search: null,
      sort: { field: 'LICENSE_PLATE', direction: 'ASC' },
      filter: null,
    });
    expect(listStateParams(state, vehicleDefinition)).toMatchObject({
      page: '8',
      pageSize: '50',
      sort: null,
      order: null,
    });
  });
  it('round trips repeated AND conditions, commas and stable chip IDs', () => {
    const conditions: FilterCondition[] = [
      { id: 'make-1', field: 'make', operator: 'contains', values: ['MAN, Volvo'] },
      { id: 'make-2', field: 'make', operator: 'equals', values: ['Volvo'] },
      { id: 'without-group', field: 'group', operator: 'isNoneOf', values: [id] },
    ];
    const state = read({ conditions: JSON.stringify(conditions), sort: 'odometer', order: 'desc' });
    expect(vehicleViewQuery(state).conditions).toEqual(conditions);
    expect(vehicleQueryState(vehicleViewQuery(state))).toEqual(state);
    expect(vehicleVariables(state)).toMatchObject({
      sort: { field: 'ODOMETER_KM', direction: 'DESC' },
      filter: {
        allOf: [
          { makeContains: 'MAN, Volvo' },
          { makeEquals: 'Volvo' },
          { excludedGroupIds: [id] },
        ],
      },
    });
    expect(listStateParams(state, vehicleDefinition)['conditions']).toBe(
      JSON.stringify(conditions),
    );
  });
  it('retains valid filter sets beyond 25 kB and accepts the exact backend odometer bound', () => {
    const ids = Array.from(
      { length: 100 },
      (_, index) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const conditions: FilterCondition[] = Array.from({ length: 7 }, (_, index) => ({
      id: `group-${String(index)}`,
      field: 'group',
      operator: 'isAnyOf',
      values: ids,
    }));
    conditions.push({ id: 'odometer', field: 'odometer', operator: 'lt', values: ['10000000'] });
    const encoded = JSON.stringify(conditions);
    expect(encoded.length).toBeGreaterThan(25_000);
    const state = read({ conditions: encoded });
    expect(vehicleViewQuery(state).conditions).toEqual(conditions);
    expect(vehicleVariables(state).filter?.allOf).toHaveLength(8);
    expect(vehicleVariables(state).filter?.allOf?.at(-1)).toEqual({ odometerKmBelow: 10_000_000 });
  });

  it('maps every exposed sort to its generated API field', () => {
    expect(
      vehicleDefinition.sorts.map(
        ({ param }) => vehicleVariables(read({ sort: param })).sort?.field,
      ),
    ).toEqual([
      'LICENSE_PLATE',
      'FLEET_NUMBER',
      'STATUS',
      'LAST_REPORTED_AT',
      'ODOMETER_KM',
      'CREATED_AT',
      'UPDATED_AT',
    ]);
  });
  it('drops malformed URLs, unsupported operators, invalid dates and duplicate chip IDs', () => {
    expect(read({ conditions: '{invalid' }).filter.conditions).toBeUndefined();
    expect(
      read({
        conditions: JSON.stringify([
          { id: 'unknown', field: 'unknown', operator: 'equals', values: ['x'] },
          { id: 'invalid', field: 'createdAt', operator: 'after', values: ['2026-02-30'] },
          { id: 'wrong', field: 'status', operator: 'contains', values: ['ACTIVE'] },
          { id: 'good', field: 'hasDevice', operator: 'isFalse', values: [] },
          { id: 'good', field: 'hasDevice', operator: 'isTrue', values: [] },
        ]),
      }).filter.conditions,
    ).toEqual([{ id: 'good', field: 'hasDevice', operator: 'isFalse', values: [] }]);
  });
  it('maps bounds, exclusions and null relations without losing zero', () => {
    const conditions: FilterCondition[] = [
      { id: '0', field: 'odometer', operator: 'between', values: ['0', '500'] },
      { id: '1', field: 'year', operator: 'gt', values: ['2000'] },
      { id: '2', field: 'createdAt', operator: 'between', values: ['2026-01-01', '2026-01-31'] },
      { id: '3', field: 'activity', operator: 'isNoneOf', values: ['NO_DEVICE'] },
      { id: '4', field: 'group', operator: 'isEmpty', values: [] },
      { id: '5', field: 'fuelType', operator: 'isAnyOf', values: ['CNG', 'ELECTRIC'] },
    ];
    expect(
      vehicleVariables(read({ conditions: JSON.stringify(conditions) })).filter?.allOf,
    ).toEqual([
      { odometerKmFrom: 0, odometerKmTo: 500 },
      { modelYearAbove: 2000 },
      { createdOnFrom: '2026-01-01', createdOnTo: '2026-01-31' },
      { excludedActivities: ['NO_DEVICE'] },
      { hasGroup: false },
      { fuelTypes: ['ELECTRIC', 'CNG'] },
    ]);
  });
});
