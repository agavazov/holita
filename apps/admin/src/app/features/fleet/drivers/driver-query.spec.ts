import { convertToParamMap } from '@angular/router';
import { readListState, listStateParams } from '../../../ui/list/list-state';
import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import {
  driverDefinition,
  driverQueryState,
  driverVariables,
  driverViewQuery,
} from './driver-query';

const read = (params: Record<string, string> = {}) =>
  readListState(convertToParamMap(params), driverDefinition);

describe('Drivers URL and GraphQL conditions', () => {
  it('retains bookmarked pages and uses the existing last-name default sort', () => {
    expect(driverVariables(read({ page: '4', pageSize: '50' }))).toEqual({
      offset: 150,
      limit: 50,
      search: null,
      filter: null,
      sort: { field: 'LAST_NAME', direction: 'ASC' },
    });
  });

  it('round trips stable IDs and repeated AND/exclusion conditions without merging them', () => {
    const conditions: FilterCondition[] = [
      { id: 'status-1', field: 'status', operator: 'isAnyOf', values: ['ACTIVE'] },
      { id: 'status-2', field: 'status', operator: 'isNoneOf', values: ['ACTIVE'] },
      { id: 'score-1', field: 'score', operator: 'between', values: ['0', '100'] },
      { id: 'empty-1', field: 'score', operator: 'isEmpty', values: [] },
      { id: 'trip-1', field: 'trips', operator: 'gt', values: ['0'] },
      { id: 'has-1', field: 'hasVehicle', operator: 'isFalse', values: [] },
    ];
    const state = read({
      conditions: JSON.stringify(conditions),
      sort: 'score',
      order: 'desc',
      keep: 'drivers',
    });
    expect(driverViewQuery(state).conditions).toEqual(conditions);
    expect(driverVariables(state).filter?.allOf).toEqual([
      { statuses: ['ACTIVE'] },
      { excludedStatuses: ['ACTIVE'] },
      { scoreFrom: 0, scoreTo: 100 },
      { hasScore: false },
      { tripCountAbove: 0 },
      { hasVehicle: false },
    ]);
    expect(driverVariables(state).sort).toEqual({ field: 'DRIVING_SCORE_30D', direction: 'DESC' });
    expect(driverQueryState(driverViewQuery(state))).toEqual(state);
    expect(listStateParams(state, driverDefinition).conditions).toBe(JSON.stringify(conditions));
  });

  it('maps date-only boundaries and license categories directly to the generated condition', () => {
    const conditions: FilterCondition[] = [
      { id: '1', field: 'license', operator: 'before', values: ['2026-10-18'] },
      { id: '2', field: 'tachoCard', operator: 'between', values: ['2026-01-01', '2026-12-31'] },
      { id: '3', field: 'licenseCategories', operator: 'isAnyOf', values: ['CE', 'B'] },
    ];
    expect(driverVariables(read({ conditions: JSON.stringify(conditions) })).filter?.allOf).toEqual(
      [
        { licenseExpiresOnBefore: '2026-10-18' },
        { tachographCardExpiresOnFrom: '2026-01-01', tachographCardExpiresOnTo: '2026-12-31' },
        { licenseCategories: ['B', 'CE'] },
      ],
    );
  });

  it('rejects malformed URL operands and bounds that the shared FilterBuilder cannot apply', () => {
    const invalid: FilterCondition[] = [
      { id: '1', field: 'score', operator: 'gt', values: ['101'] },
      { id: '2', field: 'score', operator: 'between', values: ['80', '70'] },
      { id: '3', field: 'trips', operator: 'lt', values: ['1.5'] },
      { id: '4', field: 'license', operator: 'before', values: ['2026-02-30'] },
      { id: '5', field: 'status', operator: 'isAnyOf', values: ['UNAVAILABLE'] },
    ];
    expect(driverVariables(read({ conditions: JSON.stringify(invalid) })).filter).toBeNull();
  });
});
