import { convertToParamMap } from '@angular/router';
import { listStateParams, readListState } from '../../../ui/list/list-state';
import {
  alertDefinition,
  alertQueryState,
  alertVariables,
  alertViewQuery,
  defaultAlertConditions,
} from './alert-query';

describe('Alerts URL and generated query mapping', () => {
  it('defaults to not-resolved alerts while preserving an explicitly cleared filter', () => {
    const initial = readListState(convertToParamMap({}), alertDefinition);
    expect(alertViewQuery(initial).conditions).toEqual(defaultAlertConditions);
    expect(alertVariables(initial).filter).toEqual({
      actionable: true,
      allOf: [{ excludedAlertStatuses: ['RESOLVED'] }],
    });
    const cleared = { ...initial, filter: { conditions: [] } };
    const params = listStateParams(cleared, alertDefinition);
    expect(params['conditions']).toBe('[]');
    expect(
      alertVariables(readListState(convertToParamMap(params), alertDefinition)).filter?.allOf,
    ).toEqual([]);
  });
  it('retains repeated AND conditions and maps exclusion/status workflow sorts before paging', () => {
    const state = alertQueryState({
      search: 'fuel',
      page: 3,
      pageSize: 50,
      sort: { field: 'status', direction: 'asc' },
      conditions: [
        { id: 'a', field: 'severity', operator: 'isAnyOf', values: ['WARNING', 'CRITICAL'] },
        { id: 'b', field: 'severity', operator: 'isNoneOf', values: ['WARNING'] },
        {
          id: 'c',
          field: 'vehicle',
          operator: 'isNoneOf',
          values: ['20000000-0000-4000-8000-000000000001'],
        },
      ],
    });
    expect(alertVariables(state)).toMatchObject({
      offset: 100,
      limit: 50,
      search: 'fuel',
      sort: { field: 'ALERT_STATUS', direction: 'ASC' },
      filter: {
        actionable: true,
        allOf: [
          { severities: ['CRITICAL', 'WARNING'] },
          { excludedSeverities: ['WARNING'] },
          { excludedVehicleIds: ['20000000-0000-4000-8000-000000000001'] },
        ],
      },
    });
    expect(
      readListState(convertToParamMap(listStateParams(state, alertDefinition)), alertDefinition),
    ).toEqual(state);
  });
  it('turns inclusive Sofia calendar dates into half-open instants across DST', () => {
    for (const [day, from, to] of [
      ['2026-03-29', '2026-03-28T22:00:00.000Z', '2026-03-29T21:00:00.000Z'],
      ['2026-10-25', '2026-10-24T21:00:00.000Z', '2026-10-25T22:00:00.000Z'],
    ]) {
      const state = alertQueryState({
        search: '',
        sort: null,
        page: 1,
        pageSize: 20,
        conditions: [{ id: 'day', field: 'occurredAt', operator: 'on', values: [day ?? ''] }],
      });
      expect(alertVariables(state).filter?.allOf).toEqual([{ occurredFrom: from, occurredTo: to }]);
    }
  });
  it('drops invalid, duplicate and unsupported bookmarked conditions', () => {
    const conditions = JSON.stringify([
      { id: 'a', field: 'status', operator: 'isAnyOf', values: ['OPEN'] },
      { id: 'a', field: 'status', operator: 'isAnyOf', values: ['RESOLVED'] },
      { id: 'b', field: 'vehicle', operator: 'isAnyOf', values: ['not-a-uuid'] },
      { id: 'c', field: 'occurredAt', operator: 'on', values: ['2026-02-30'] },
      { id: 'd', field: 'status', operator: 'equals', values: ['OPEN'] },
    ]);
    const state = readListState(convertToParamMap({ conditions }), alertDefinition);
    expect(state.filter.conditions).toEqual([
      { id: 'a', field: 'status', operator: 'isAnyOf', values: ['OPEN'] },
    ]);
  });

  it('uses the configured calendar zone for inclusive dates across the spring clock change', () => {
    const state = alertQueryState({
      search: '',
      sort: null,
      page: 1,
      pageSize: 20,
      conditions: [{ id: 'day', field: 'occurredAt', operator: 'on', values: ['2026-03-29'] }],
    });
    expect(alertVariables(state, 'Europe/London').filter?.allOf).toEqual([
      { occurredFrom: '2026-03-29T00:00:00.000Z', occurredTo: '2026-03-29T23:00:00.000Z' },
    ]);
  });
});
