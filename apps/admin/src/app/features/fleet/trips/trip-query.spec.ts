import { convertToParamMap } from '@angular/router';
import { listStateParams, readListState } from '../../../ui/list/list-state';
import { tripDefinition, tripQueryState, tripVariables } from './trip-query';
describe('Trips URL/query mapping', () => {
  it('maps repeated AND filters, exclusions, missing driver and duration sorting before paging', () => {
    const state = tripQueryState({
      search: 'Sofia',
      page: 2,
      pageSize: 50,
      sort: { field: 'duration', direction: 'desc' },
      conditions: [
        { id: 'a', field: 'distance', operator: 'gt', values: ['0'] },
        { id: 'b', field: 'distance', operator: 'lt', values: ['5000'] },
        { id: 'c', field: 'driver', operator: 'isEmpty', values: [] },
        { id: 'd', field: 'hasEvents', operator: 'isFalse', values: [] },
        { id: 'e', field: 'score', operator: 'gt', values: ['0'] },
      ],
    });
    expect(tripVariables(state)).toMatchObject({
      offset: 50,
      limit: 50,
      sort: { field: 'DURATION_SECONDS', direction: 'DESC' },
      filter: {
        allOf: [
          { distanceKmAbove: 0 },
          { distanceKmBelow: 5000 },
          { hasDriver: false },
          { hasEvents: false },
          { drivingScoreAbove: 0 },
        ],
      },
    });
    expect(
      readListState(convertToParamMap(listStateParams(state, tripDefinition)), tripDefinition),
    ).toEqual(state);
  });
  it('converts inclusive Sofia calendar days into half-open DST-aware instants', () => {
    const state = tripQueryState({
      search: '',
      sort: null,
      page: 1,
      pageSize: 20,
      conditions: [{ id: 'day', field: 'startedAt', operator: 'on', values: ['2026-10-25'] }],
    });
    expect(tripVariables(state).filter?.allOf).toEqual([
      { startedFrom: '2026-10-24T21:00:00.000Z', startedTo: '2026-10-25T22:00:00.000Z' },
    ]);
  });
  it('rejects bookmarked numeric values outside the real 5000-km and100-score contract', () => {
    const state = readListState(
      convertToParamMap({
        conditions: JSON.stringify([
          { id: 'a', field: 'distance', operator: 'gt', values: ['5001'] },
          { id: 'b', field: 'score', operator: 'lt', values: ['101'] },
          { id: 'c', field: 'vehicle', operator: 'isAnyOf', values: ['invalid'] },
          { id: 'd', field: 'startedAt', operator: 'on', values: ['2026-02-30'] },
        ]),
      }),
      tripDefinition,
    );
    expect(tripVariables(state).filter).toBeNull();
  });

  it('uses the configured calendar zone and its 25-hour autumn day without changing km filters', () => {
    const state = tripQueryState({
      search: '',
      sort: null,
      page: 1,
      pageSize: 20,
      conditions: [
        { id: 'day', field: 'startedAt', operator: 'on', values: ['2026-11-01'] },
        { id: 'distance', field: 'distance', operator: 'gt', values: ['100'] },
      ],
    });
    expect(tripVariables(state, 'America/New_York').filter?.allOf).toEqual([
      { startedFrom: '2026-11-01T04:00:00.000Z', startedTo: '2026-11-02T05:00:00.000Z' },
      { distanceKmAbove: 100 },
    ]);
  });
});
