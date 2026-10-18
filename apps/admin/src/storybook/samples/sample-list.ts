import type { FilterCondition } from '../../app/ui/filter-builder/filter-model';
import { listQuery, type ListQuery } from '../../app/ui/list/list-query';
import { tableView, type TableView } from '../../app/ui/table-panel/table-view';

// Story-only list engine: quick search, filter conditions, sort and paging over sample rows, so
// example pages can be clicked through like the real lists (which do this on the backend).

export type SampleValue = string | number | boolean | null;

export interface SampleListDefinition<T> {
  /** Texts the quick search looks in; every word must appear in one of them. */
  readonly search: (row: T) => readonly (string | null)[];
  /** The value of every filterable or sortable column. */
  readonly columns: Readonly<Record<string, (row: T) => SampleValue>>;
  /** Sort keys that differ from the filtered value, e.g. the rank of a severity enum. */
  readonly sortColumns?: Readonly<Record<string, (row: T) => SampleValue>>;
}

export interface SampleListResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  /** The page actually shown (a page beyond the end moves to the last page). */
  readonly page: number;
}

/** The query a sample list opens with. */
export function initialQuery(
  sort: ListQuery['sort'],
  pageSize = 25,
  conditions: readonly FilterCondition[] = [],
): ListQuery {
  return { search: '', conditions, sort, page: 1, pageSize };
}

/** The TablePanel view of a sample list in a story scenario. */
export function sampleTableView(
  query: ListQuery,
  rows: number,
  scenario: { readonly loading: boolean; readonly failed: boolean },
): TableView {
  return tableView({
    loading: scenario.loading,
    error: scenario.failed ? 'failed' : null,
    rows: scenario.loading || scenario.failed ? null : rows,
    filtered: listQuery.filtered(query),
  });
}

function text(value: SampleValue): string {
  return value === null ? '' : String(value).toLocaleLowerCase('en');
}

function datePart(value: SampleValue): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

function matches(value: SampleValue, condition: FilterCondition): boolean {
  const [first = '', second = ''] = condition.values;
  switch (condition.operator) {
    case 'contains':
      return text(value).includes(first.toLocaleLowerCase('en'));
    case 'startsWith':
      return text(value).startsWith(first.toLocaleLowerCase('en'));
    case 'equals':
      return typeof value === 'number' ? value === Number(first) : text(value) === text(first);
    case 'notEquals':
      return typeof value === 'number' ? value !== Number(first) : text(value) !== text(first);
    case 'isAnyOf':
      return value !== null && condition.values.includes(String(value));
    case 'isNoneOf':
      return value === null || !condition.values.includes(String(value));
    case 'gt':
      return typeof value === 'number' && value > Number(first);
    case 'lt':
      return typeof value === 'number' && value < Number(first);
    case 'between':
      return typeof value === 'number'
        ? value >= Number(first) && value <= Number(second)
        : datePart(value) >= first && datePart(value) <= second;
    case 'before':
      return value !== null && datePart(value) < first;
    case 'after':
      return value !== null && datePart(value) > first;
    case 'on':
      return datePart(value) === first;
    case 'isTrue':
      return value === true;
    case 'isFalse':
      return value === false;
    case 'isEmpty':
      return value === null || value === '';
    case 'isNotEmpty':
      return value !== null && value !== '';
  }
}

function compare(left: SampleValue, right: SampleValue): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'en');
}

export function runSampleList<T>(
  rows: readonly T[],
  definition: SampleListDefinition<T>,
  query: ListQuery,
): SampleListResult<T> {
  const words = query.search
    .trim()
    .toLocaleLowerCase('en')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const matching = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const haystack = definition.search(row).map((value) => text(value));
      return words.every((word) => haystack.some((value) => value.includes(word)));
    })
    .filter(({ row }) =>
      query.conditions.every((condition) => {
        const read = definition.columns[condition.field];
        return read ? matches(read(row), condition) : true;
      }),
    );
  const sort = query.sort;
  const read = sort
    ? (definition.sortColumns?.[sort.field] ?? definition.columns[sort.field])
    : undefined;
  if (sort && read)
    matching.sort((left, right) => {
      const order = compare(read(left.row), read(right.row));
      const directed = sort.direction === 'asc' ? order : -order;
      return directed || left.index - right.index;
    });
  const total = matching.length;
  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), lastPage);
  const start = (page - 1) * query.pageSize;
  return {
    items: matching.slice(start, start + query.pageSize).map(({ row }) => row),
    total,
    page,
  };
}
