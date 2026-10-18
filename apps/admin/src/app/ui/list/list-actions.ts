/** The question asked before an action runs. */
export interface ActionConfirm {
  /** The question for one record; may use {name}, e.g. "Delete CB 1001 AX?". */
  readonly one: string;
  /** The question for several records; may use {count}, e.g. "Delete {count} vehicles?". */
  readonly many: string;
  /** What follows from it, e.g. "Their trips stay in reports." */
  readonly detail?: string;
  /** The label of the confirming button. */
  readonly accept: string;
}

/** What TablePanel and the row menu need to know about an action. */
export interface ListActionBase<A extends string> {
  readonly id: A;
  readonly label: string;
  /**
   * Also offered in the bulk bar of selected rows. Only quick changes are bulk; opening or
   * editing one record is never bulk.
   */
  readonly bulk?: true;
  /** Destructive: last in the row menu after a separator, danger tone in the bar and dialog. */
  readonly danger?: true;
  readonly confirm?: ActionConfirm;
}

/**
 * One action of a list, defined once for the row menu and the bulk bar. `appliesTo` is the one
 * rule for which rows it applies to: the row menu shows it disabled elsewhere, and a bulk run
 * leaves those rows out, so hosts never check again.
 */
export interface ListAction<A extends string, R> extends ListActionBase<A> {
  readonly appliesTo?: (row: R) => boolean;
}

/** A row as its actions see it: the ID, how people recognise it, and what does not apply. */
export interface ListRecord<A extends string> {
  readonly id: string;
  readonly label: string;
  readonly unavailable: readonly A[];
}

/** What a list asks its host to do; row and bulk actions arrive the same way. */
export interface ListActionRequest<A extends string> {
  readonly action: A;
  readonly ids: readonly string[];
}

/** The record of a row, evaluating each action's rule once. */
export function listRecord<A extends string, R>(
  actions: readonly ListAction<A, R>[],
  row: R,
  id: string,
  label: string,
): ListRecord<A> {
  return {
    id,
    label,
    unavailable: actions
      .filter((action) => action.appliesTo && !action.appliesTo(row))
      .map((action) => action.id),
  };
}

/** `p-table [rowTrackBy]`: rows keep their DOM (and the focused "⋮" button) across refreshes. */
export function trackById(_index: number, row: { readonly id: string }): string {
  return row.id;
}
