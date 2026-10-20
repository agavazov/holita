import { convertToParamMap } from '@angular/router';
import { listStateParams, readListState } from '../../../ui/list/list-state';
import {
  maintenanceDefinition,
  maintenanceQueryState,
  maintenanceVariables,
} from './maintenance-query';
describe('Maintenance URL/query mapping', () => {
  it('round-trips independent AND filters and maps exact EUR cents, exclusions and table sorts', () => {
    const state = maintenanceQueryState({
      search: 'Oil Sofia',
      page: 2,
      pageSize: 50,
      sort: { field: 'cost', direction: 'desc' },
      conditions: [
        { id: 'a', field: 'cost', operator: 'gt', values: ['0.29'] },
        { id: 'b', field: 'cost', operator: 'lt', values: ['1000000'] },
        { id: 'c', field: 'status', operator: 'isNoneOf', values: ['CANCELLED'] },
        { id: 'd', field: 'vehicleStatus', operator: 'isAnyOf', values: ['IN_WORKSHOP'] },
        { id: 'e', field: 'serviceType', operator: 'isNoneOf', values: ['OTHER'] },
      ],
    });
    expect(maintenanceVariables(state, 'en')).toMatchObject({
      offset: 50,
      limit: 50,
      sort: { field: 'COST_CENTS', direction: 'DESC' },
      filter: {
        allOf: [
          { costCentsAbove: 29 },
          { costCentsBelow: 100_000_000 },
          { excludedStatuses: ['CANCELLED'] },
          { vehicleStatuses: ['IN_WORKSHOP'] },
          { excludedServiceTypes: ['OTHER'] },
        ],
      },
    });
    expect(
      readListState(
        convertToParamMap(listStateParams(state, maintenanceDefinition)),
        maintenanceDefinition,
      ),
    ).toEqual(state);
  });
  it('keeps due dates literal and strict while mapping completed dates to inclusive calendar bounds', () => {
    const state = maintenanceQueryState({
      search: '',
      page: 1,
      pageSize: 20,
      sort: null,
      conditions: [
        { id: 'a', field: 'dueOn', operator: 'before', values: ['2026-10-25'] },
        { id: 'b', field: 'dueOn', operator: 'after', values: ['2026-10-18'] },
        { id: 'c', field: 'completedOn', operator: 'before', values: ['2026-10-25'] },
        { id: 'd', field: 'completedOn', operator: 'after', values: ['2026-10-18'] },
        { id: 'e', field: 'dueOn', operator: 'isEmpty', values: [] },
        { id: 'f', field: 'cost', operator: 'isEmpty', values: [] },
      ],
    });
    expect(maintenanceVariables(state, 'en').filter?.allOf).toEqual([
      { dueOnBefore: '2026-10-25' },
      { dueOnAfter: '2026-10-18' },
      { completedTo: '2026-10-24' },
      { completedFrom: '2026-10-19' },
      { hasDueOn: false },
      { hasCost: false },
    ]);
  });
  it('searches a literal title or the active-language service type fallback for untitled records', () => {
    const state = maintenanceQueryState({
      search: '',
      page: 1,
      pageSize: 20,
      sort: null,
      conditions: [{ id: 'task', field: 'task', operator: 'contains', values: ['масло'] }],
    });
    expect(maintenanceVariables(state, 'bg').filter?.allOf).toEqual([
      { taskContains: 'масло', untitledServiceTypes: ['OIL_CHANGE'] },
    ]);
    expect(maintenanceVariables(state, 'en').filter?.allOf).toEqual([
      { taskContains: 'масло', untitledServiceTypes: [] },
    ]);
  });
  it('rejects invalid bookmarked precision, dates, IDs and unsupported enum codes before transport', () => {
    const state = readListState(
      convertToParamMap({
        conditions: JSON.stringify([
          { id: 'a', field: 'cost', operator: 'gt', values: ['0.001'] },
          { id: 'b', field: 'cost', operator: 'lt', values: ['1000000.01'] },
          { id: 'c', field: 'dueOn', operator: 'on', values: ['2026-02-30'] },
          { id: 'd', field: 'vehicle', operator: 'isAnyOf', values: ['invalid'] },
          { id: 'e', field: 'status', operator: 'isAnyOf', values: ['FUTURE'] },
        ]),
      }),
      maintenanceDefinition,
    );
    expect(maintenanceVariables(state, 'en').filter).toBeNull();
  });
});
