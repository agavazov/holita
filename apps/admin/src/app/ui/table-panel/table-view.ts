/** What a TablePanel shows; one rule for every list (spec 3.3). */
export type TableView =
  | { readonly kind: 'loading' } // first load, no rows: skeleton rows
  | { readonly kind: 'rows' } // rows present (maybe refreshing)
  | { readonly kind: 'empty' } // no records and no search/filters
  | { readonly kind: 'no-results' } // search or filters active and zero rows
  | { readonly kind: 'error' } // first load failed: error state + Retry
  | { readonly kind: 'rows-error' }; // refresh failed: inline error + Retry above retained rows

export function tableView(input: {
  readonly loading: boolean;
  readonly error: unknown;
  /** Rows on screen, or `null` before the first answer. */
  readonly rows: number | null;
  readonly filtered: boolean;
}): TableView {
  const failed = input.error !== null && input.error !== undefined;
  if (input.rows !== null && input.rows > 0) return { kind: failed ? 'rows-error' : 'rows' };
  if (failed) return { kind: 'error' };
  if (input.loading || input.rows === null) return { kind: 'loading' };
  return { kind: input.filtered ? 'no-results' : 'empty' };
}
