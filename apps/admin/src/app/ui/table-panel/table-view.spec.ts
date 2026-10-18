import { tableView } from './table-view';

describe('tableView', () => {
  it.each([
    [{ loading: true, error: null, rows: null, filtered: false }, 'loading'],
    [{ loading: false, error: null, rows: null, filtered: false }, 'loading'],
    [{ loading: true, error: null, rows: 0, filtered: true }, 'loading'],
    [{ loading: false, error: null, rows: 0, filtered: false }, 'empty'],
    [{ loading: false, error: null, rows: 0, filtered: true }, 'no-results'],
    [{ loading: false, error: new Error('x'), rows: null, filtered: false }, 'error'],
    [{ loading: false, error: new Error('x'), rows: 0, filtered: true }, 'error'],
    [{ loading: true, error: null, rows: 12, filtered: false }, 'rows'],
    [{ loading: false, error: new Error('x'), rows: 12, filtered: true }, 'rows-error'],
  ] as const)('%o → %s', (input, kind) => {
    expect(tableView(input).kind).toBe(kind);
  });
});
