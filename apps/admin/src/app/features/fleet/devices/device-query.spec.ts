import { convertToParamMap } from '@angular/router';
import { listStateParams, readListState } from '../../../ui/list/list-state';
import {
  deviceDefinition,
  deviceQueryState,
  deviceVariables,
  deviceViewQuery,
} from './device-query';

const read = (params: Record<string, string> = {}) =>
  readListState(convertToParamMap(params), deviceDefinition);
describe('Devices URL and API mapping', () => {
  it('keeps bookmarked paging and maps every sort to an available backend field', () => {
    expect(deviceVariables(read({ page: '8', pageSize: '50' }))).toEqual({
      offset: 350,
      limit: 50,
      search: null,
      sort: { field: 'IMEI', direction: 'ASC' },
      filter: null,
    });
    expect(
      deviceDefinition.sorts.map(({ param }) => deviceVariables(read({ sort: param })).sort?.field),
    ).toEqual([
      'IMEI',
      'STATUS',
      'VEHICLE_LICENSE_PLATE',
      'LAST_REPORTED_AT',
      'INSTALLED_AT',
      'CREATED_AT',
    ]);
  });
  it('round trips independent contradictory conditions and literal firmware text', () => {
    const conditions = [
      { id: 'one', field: 'model', operator: 'isAnyOf', values: ['STARLINK_TRACKER'] },
      { id: 'two', field: 'model', operator: 'isAnyOf', values: ['STARLINK_SCOUT'] },
      { id: 'prefix', field: 'firmware', operator: 'startsWith', values: ['1_%'] },
      { id: 'stock', field: 'installed', operator: 'isFalse', values: [] },
    ];
    const state = read({
      conditions: JSON.stringify(conditions),
      sort: 'lastSeenAt',
      order: 'desc',
    });
    expect(deviceViewQuery(state).conditions).toEqual(conditions);
    expect(deviceQueryState(deviceViewQuery(state))).toEqual(state);
    expect(listStateParams(state, deviceDefinition)['conditions']).toBe(JSON.stringify(conditions));
    expect(deviceVariables(state)).toMatchObject({
      filter: {
        allOf: [
          { models: ['STARLINK_TRACKER'] },
          { models: ['STARLINK_SCOUT'] },
          { firmwareVersionStartsWith: '1_%' },
          { hasVehicle: false },
        ],
      },
    });
  });
  it('rejects unknown catalog values, invalid operators and oversized firmware conditions', () => {
    for (const condition of [
      { id: 'one', field: 'model', operator: 'isAnyOf', values: ['FMB920'] },
      { id: 'one', field: 'firmware', operator: 'equals', values: ['x'.repeat(33)] },
      { id: 'one', field: 'status', operator: 'contains', values: ['ONLINE'] },
    ]) {
      expect(deviceVariables(read({ conditions: JSON.stringify([condition]) })).filter).toBeNull();
    }
  });
});
