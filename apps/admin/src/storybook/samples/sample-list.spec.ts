import { initialQuery, runSampleList, type SampleListDefinition } from './sample-list';

interface Row {
  readonly id: string;
  readonly value: number | null;
}
const rows: readonly Row[] = [
  { id: 'unknown', value: null },
  { id: 'zero', value: 0 },
  { id: 'one', value: 1 },
];
const definition: SampleListDefinition<Row> = {
  search: () => [],
  columns: { value: (row) => row.value },
};

interface SecondaryRow extends Row {
  readonly recent: number | null;
}
const secondaryRows: readonly SecondaryRow[] = [
  { id: 'a', value: 1, recent: 8 },
  { id: 'b', value: 1, recent: 8 },
  { id: 'c', value: 1, recent: null },
  { id: 'd', value: 1, recent: 9 },
  { id: 'e', value: 2, recent: 0 },
];

describe('sample list sort contract', () => {
  it.each(['asc', 'desc'] as const)(
    'keeps unknown values last in %s order without treating zero as missing',
    (direction) => {
      const result = runSampleList(rows, definition, initialQuery({ field: 'value', direction }));
      expect(result.items.map((row) => row.id)).toEqual(
        direction === 'asc' ? ['zero', 'one', 'unknown'] : ['one', 'zero', 'unknown'],
      );
    },
  );

  it.each(['asc', 'desc'] as const)(
    'keeps a fixed descending secondary key and final id order when primary is %s',
    (direction) => {
      const result = runSampleList(
        secondaryRows,
        {
          id: (row) => row.id,
          search: () => [],
          columns: { value: (row) => row.value },
          secondarySorts: {
            value: [{ value: (row) => row.recent, direction: 'desc' }],
          },
        },
        initialQuery({ field: 'value', direction }),
      );
      expect(result.items.map((row) => row.id)).toEqual(
        direction === 'asc' ? ['d', 'b', 'a', 'c', 'e'] : ['e', 'd', 'b', 'a', 'c'],
      );
    },
  );

  it.each(['asc', 'desc'] as const)(
    'follows the primary %s direction for an unspecified secondary direction, nulls last',
    (direction) => {
      const result = runSampleList(
        secondaryRows,
        {
          id: (row) => row.id,
          search: () => [],
          columns: { value: (row) => row.value },
          secondarySorts: { value: [{ value: (row) => row.recent }] },
        },
        initialQuery({ field: 'value', direction }),
      );
      expect(result.items.map((row) => row.id)).toEqual(
        direction === 'asc' ? ['b', 'a', 'd', 'c', 'e'] : ['e', 'd', 'b', 'a', 'c'],
      );
    },
  );
});
