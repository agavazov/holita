import { DestroyRef, computed, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  EMPTY,
  Subject,
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
  timer,
  type Observable,
} from 'rxjs';
import {
  defaultSortOf,
  listStateParams,
  normalizeSearch,
  readListState,
  sameListState,
  searchApplies,
  type ListDefinition,
  type ListState,
  type SortDirection,
} from './list-state';

/** Catalog key (`uiMessages`) of the search error FilterBuilder shows. */
export type SearchErrorKey = 'searchTooManyWords';

/**
 * The URL-backed state of one list or tab. Construct it in a field initializer; it never fetches
 * data. Pages map `state()` / `changes` to their own typed query variables.
 */
export class UrlListState<F, S extends string> {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchEdits = new Subject<string | null>();
  private readonly tableSorts = new Subject<{ field: S; direction: SortDirection }>();
  private readonly pageCorrectionNavigation = {};

  /** Normalised states, distinct under the definition's codecs. */
  readonly changes: Observable<ListState<F, S>>;
  readonly state: Signal<ListState<F, S>>;
  readonly searchDraft = signal('');
  readonly searchError: Signal<SearchErrorKey | null> = computed(() =>
    searchApplies(this.searchDraft()) ? null : 'searchTooManyWords',
  );

  constructor(private readonly definition: ListDefinition<F, S>) {
    const destroyRef = inject(DestroyRef);
    this.changes = this.route.queryParamMap.pipe(
      map((params) => readListState(params, definition)),
      distinctUntilChanged((a, b) => sameListState(a, b, definition)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.state = toSignal(this.changes, { requireSync: true });
    this.searchDraft.set(this.state().search);

    // Invalid or non-normalised URLs are rewritten in place.
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      const normalized = listStateParams(readListState(params, definition), definition);
      const differs = Object.entries(normalized).some(
        ([name, value]) => params.get(name) !== (typeof value === 'string' ? value : null),
      );
      if (differs) {
        this.navigate(normalized, true);
      }
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      if (this.router.currentNavigation()?.extras.info === this.pageCorrectionNavigation) {
        return;
      }
      this.cancelPending();
      this.searchDraft.set(readListState(params, definition).search);
    });
    this.searchEdits
      .pipe(
        switchMap((value) => (value === null ? EMPTY : timer(300).pipe(map(() => value)))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((value) => {
        if (searchApplies(value)) {
          this.apply({ ...this.state(), search: normalizeSearch(value), page: 1 });
        }
      });
    // p-table can emit several sort events for one click; the last one wins.
    this.tableSorts
      .pipe(
        switchMap((sort) => timer(0).pipe(map(() => sort))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((sort) => {
        this.setSort(sort.field, sort.direction);
      });
  }

  /** Records search input; it is applied after 300 ms unless it has more than five words. */
  editSearch(value: string): void {
    this.searchDraft.set(value);
    this.searchEdits.next(value);
  }

  patchFilter(changes: Partial<F>): void {
    const state = this.state();
    this.apply({ ...state, filter: { ...state.filter, ...changes }, page: 1 });
  }

  setSort(field: S, direction: SortDirection): void {
    const state = this.state();
    if (state.sort.field === field && state.sort.direction === direction) {
      return;
    }
    this.apply({ ...state, sort: { field, direction }, page: 1 });
  }

  /** Maps a `p-table` sort event whose `field` is a sort param of the definition. */
  sortFromTable(event: unknown): void {
    if (typeof event !== 'object' || event === null) {
      return;
    }
    const param = 'field' in event ? event.field : undefined;
    const order = 'order' in event ? event.order : undefined;
    const field = this.definition.sorts.find((sort) => sort.param === param)?.field;
    if (!field || (order !== 1 && order !== -1)) {
      return;
    }
    this.tableSorts.next({ field, direction: order === 1 ? 'ASC' : 'DESC' });
  }

  resetSort(): void {
    const fallback = defaultSortOf(this.state(), this.definition);
    this.setSort(fallback.field, fallback.direction);
  }

  /** Paginator changes; a new page size starts again at page 1. */
  setPage(change: { readonly page: number; readonly pageSize: number }): void {
    const state = this.state();
    const page = change.pageSize === state.pageSize ? Math.max(1, change.page) : 1;
    this.apply({ ...state, page, pageSize: change.pageSize });
  }

  /** Clears the search and every filter; the per-view parameter keeps its value. */
  clearFilters(): void {
    this.cancelPending();
    const state = this.state();
    const view = this.definition.viewDefaultSorts?.param;
    const filter: Partial<F> = {};
    for (const key in this.definition.filters) {
      if (key === view) {
        filter[key] = state.filter[key];
      }
    }
    this.searchDraft.set('');
    this.apply({ ...state, search: '', filter, page: 1 });
  }

  /** Replaces a past-the-end page once totals arrive, preserving an unsubmitted search draft. */
  correctPage(lastPage: number): void {
    const state = this.state();
    const target = Math.max(1, lastPage);
    if (state.page > target) {
      this.navigate(listStateParams({ ...state, page: target }, this.definition), true, true);
    }
  }

  /** Drops a pending debounced search. */
  cancelPending(): void {
    this.searchEdits.next(null);
  }

  private apply(state: ListState<F, S>): void {
    if (sameListState(state, this.state(), this.definition)) {
      return;
    }
    this.navigate(listStateParams(state, this.definition), false);
  }

  /** Applies a complete query emitted by a presentation-only list in one navigation. */
  setState(state: ListState<F, S>): void {
    this.cancelPending();
    this.apply(state);
  }

  private navigate(queryParams: Params, replaceUrl: boolean, preserveSearchDraft = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl,
      ...(preserveSearchDraft ? { info: this.pageCorrectionNavigation } : {}),
    });
  }
}
