import { convertToParamMap } from '@angular/router';
import {
  activeFilterCount,
  codecs,
  listStateParams,
  normalizeSearch,
  readListState,
  sameListState,
  searchApplies,
  searchTokens,
  type ListDefinition,
} from './list-state';

type Status = 'ACTIVE' | 'IN_WORKSHOP' | 'INACTIVE';
type Sort = 'LICENSE_PLATE' | 'CREATED_AT' | 'COMPLETED_ON';
interface Filter {
  statuses?: readonly Status[];
  groupIds?: readonly string[];
  hasGroup?: boolean;
  from?: string;
  view?: 'planned' | 'completed';
  within?: number;
  scoreBelow?: number;
}

const groupA = '50000000-0000-4000-8000-000000001001';
const groupB = '50000000-0000-4000-8000-000000001002';

const definition: ListDefinition<Filter, Sort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'licensePlate', field: 'LICENSE_PLATE' },
    { param: 'createdAt', field: 'CREATED_AT' },
    { param: 'completedOn', field: 'COMPLETED_ON' },
  ],
  defaultSort: { field: 'CREATED_AT', direction: 'DESC' },
  viewDefaultSorts: {
    param: 'view',
    sorts: { completed: { field: 'COMPLETED_ON', direction: 'DESC' } },
  },
  filters: {
    statuses: codecs.enumList<Status>(['ACTIVE', 'IN_WORKSHOP', 'INACTIVE']),
    groupIds: codecs.idList(5),
    hasGroup: codecs.boolean(),
    from: codecs.dateOnly(),
    view: codecs.choice(['planned', 'completed'], 'planned'),
    within: codecs.integer(0, 365),
    scoreBelow: codecs.number(0, 100, 1),
  },
  // Selected groups win over "without a group".
  normalizeFilter: (filter) => {
    if (!filter.groupIds?.length || filter.hasGroup !== false) return filter;
    const { hasGroup: _dropped, ...rest } = filter;
    return rest;
  },
};

function read(params: Record<string, string>) {
  return readListState(convertToParamMap(params), definition);
}

describe('list state', () => {
  it('applies defaults and omits them from the URL', () => {
    const state = read({});
    expect(state).toEqual({
      page: 1,
      pageSize: 20,
      search: '',
      sort: { field: 'CREATED_AT', direction: 'DESC' },
      filter: { view: 'planned' },
    });
    expect(listStateParams(state, definition)).toEqual({
      search: null,
      sort: null,
      order: null,
      page: null,
      pageSize: null,
      statuses: null,
      groupIds: null,
      hasGroup: null,
      from: null,
      view: null,
      within: null,
      scoreBelow: null,
    });
    expect(activeFilterCount(state, definition)).toBe(0);
  });

  it('decodes valid values, drops invalid ones and round-trips', () => {
    const state = read({
      search: '  CA 12\u0000 ',
      sort: 'licensePlate',
      page: '3',
      pageSize: '50',
      statuses: 'ACTIVE,UNKNOWN,ACTIVE,INACTIVE',
      groupIds: `${groupA.toUpperCase()},not-a-uuid`,
      hasGroup: 'maybe',
      from: '2026-02-30',
      within: '30',
      scoreBelow: '84.6',
    });
    expect(state).toEqual({
      page: 3,
      pageSize: 50,
      search: 'CA 12',
      sort: { field: 'LICENSE_PLATE', direction: 'ASC' },
      filter: {
        statuses: ['ACTIVE', 'INACTIVE'],
        groupIds: [groupA],
        view: 'planned',
        within: 30,
        scoreBelow: 85,
      },
    });
    const params = listStateParams(state, definition);
    expect(params).toMatchObject({
      search: 'CA 12',
      sort: 'licensePlate',
      order: null,
      page: '3',
      pageSize: '50',
      statuses: 'ACTIVE,INACTIVE',
      groupIds: groupA,
      within: '30',
      scoreBelow: '85',
    });
    expect(activeFilterCount(state, definition)).toBe(4);
    const strings = Object.fromEntries(
      Object.entries(params).flatMap(([key, value]) =>
        typeof value === 'string' ? [[key, value]] : [],
      ),
    );
    expect(sameListState(read(strings), state, definition)).toBe(true);
  });

  it('clamps pages, rejects unknown sizes and drops out-of-range numbers', () => {
    expect(read({ page: '0', pageSize: '7' })).toMatchObject({ page: 1, pageSize: 20 });
    expect(read({ page: '-2' }).page).toBe(1);
    expect(read({ page: '999999999999', pageSize: '100' }).page).toBe(21_474_837);
    expect(read({ within: '366', scoreBelow: '101' }).filter).toEqual({ view: 'planned' });
    expect(read({ within: '1.5' }).filter.within).toBeUndefined();
  });

  it('uses the per-view default sort and writes the order only when it differs', () => {
    const completed = read({ view: 'completed' });
    expect(completed.sort).toEqual({ field: 'COMPLETED_ON', direction: 'DESC' });
    expect(listStateParams(completed, definition)).toMatchObject({
      view: 'completed',
      sort: null,
      order: null,
    });
    const ascending = { ...completed, sort: { field: 'COMPLETED_ON', direction: 'ASC' } } as const;
    expect(listStateParams(ascending, definition)).toMatchObject({ sort: null, order: 'asc' });
    const plate = read({ sort: 'licensePlate', order: 'desc' });
    expect(plate.sort).toEqual({ field: 'LICENSE_PLATE', direction: 'DESC' });
    expect(listStateParams(plate, definition)).toMatchObject({
      sort: 'licensePlate',
      order: 'desc',
    });
    expect(read({ sort: 'unknown' }).sort).toEqual({ field: 'CREATED_AT', direction: 'DESC' });
    expect(activeFilterCount(completed, definition)).toBe(0);
  });

  it('applies the cross-field normalisation before reading and writing', () => {
    const state = read({ groupIds: `${groupA},${groupB}`, hasGroup: 'false' });
    expect(state.filter.hasGroup).toBeUndefined();
    expect(
      listStateParams({ ...state, filter: { ...state.filter, hasGroup: false } }, definition),
    ).toMatchObject({ hasGroup: null, groupIds: `${groupA},${groupB}` });
    expect(read({ hasGroup: 'false' }).filter.hasGroup).toBe(false);
  });

  it('compares states with the codecs (list order does not matter)', () => {
    const a = read({ statuses: 'ACTIVE,INACTIVE' });
    const b = read({ statuses: 'INACTIVE,ACTIVE' });
    expect(sameListState(a, b, definition)).toBe(true);
    expect(sameListState(a, { ...b, page: 2 }, definition)).toBe(false);
    expect(sameListState(a, read({ statuses: 'ACTIVE' }), definition)).toBe(false);
  });

  it('normalises search text and applies at most five words', () => {
    expect(searchTokens('  a b\tc  ')).toEqual(['a', 'b', 'c']);
    expect(searchApplies('one two three four five')).toBe(true);
    expect(searchApplies('one two three four five six')).toBe(false);
    expect(normalizeSearch('x'.repeat(250))).toHaveLength(200);
    expect(normalizeSearch('😀'.repeat(201))).toBe('😀'.repeat(200));
    expect(normalizeSearch(null)).toBe('');
  });
});
