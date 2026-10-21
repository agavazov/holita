import { fleetRecordLinks } from '../fleet-record-links';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { EMPTY, catchError, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminTripsQuery,
  AdminTripSummaryQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { uiMessages } from '../../../ui/i18n/messages';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import type { ListActionRequest } from '../../../ui/list/list-actions';
import { listQuery, type ListQuery } from '../../../ui/list/list-query';
import { normalizeSearch, sameListState, searchApplies } from '../../../ui/list/list-state';
import { UrlListState } from '../../../ui/list/url-list-state';
import { tableView } from '../../../ui/table-panel/table-view';
import { TripChoices } from './trip-choices';
import { tripKpis, tripRow } from './trip-mapping';
import { tripDefinition, tripQueryState, tripVariables, tripViewQuery } from './trip-query';
import { TripsApi } from './trips-api';
import { TripsView, type TripActionId } from './trips-view';
@Component({
  selector: 'holita-trips-page',
  providers: [TripsApi, TripChoices],
  imports: [TripsView, RouterOutlet, Message, ButtonDirective],
  template: `
    @if (summaryError()) {
      <p-message severity="warn"
        >{{ summaryFailure() }}
        <button pButton type="button" severity="secondary" (click)="refreshSummary()">
          {{ retryText() }}
        </button></p-message
      >
    }
    @if (choices.error()) {
      <p-message severity="warn"
        >{{ choicesFailure() }}
        <button pButton type="button" severity="secondary" (click)="choices.load()">
          {{ retryText() }}
        </button></p-message
      >
    }
    <holita-trips-view
      [recordLinks]="recordLinks()"
      [branchName]="branch().name"
      [rows]="rows()"
      [total]="page()?.total ?? 0"
      [view]="view()"
      [state]="state()"
      [kpis]="kpis()"
      [vehicles]="choices.vehicles()"
      [drivers]="choices.drivers()"
      [busy]="loading()"
      [searchError]="searchError()"
      [errorText]="failure()"
      (stateChange)="changeState($event)"
      (action)="run($event)"
      (retry)="refresh()"
    />
    <router-outlet />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripsPage implements OnInit {
  protected readonly recordLinks = computed(() =>
    fleetRecordLinks(this.language(), this.branch().id),
  );
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(TripsApi);
  readonly choices = inject(TripChoices);
  readonly url = new UrlListState(tripDefinition);
  private readonly units = injectFleetFormat();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private query: ReturnType<TripsApi['watch']> | undefined;
  private summaryQuery: ReturnType<TripsApi['watchSummary']> | undefined;
  readonly page = signal<AdminTripsQuery['fleetTrips'] | null>(null);
  readonly summary = signal<AdminTripSummaryQuery['fleetTripSummary'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly summaryError = signal<unknown>(null);
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly summaryFailure = computed(() =>
    requestError(this.summaryError(), messages[this.language()].networkError),
  );
  protected readonly choicesFailure = computed(() =>
    requestError(this.choices.error(), messages[this.language()].networkError),
  );
  protected readonly retryText = computed(() => uiMessages[this.language()].retry);
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).map((trip) => tripRow(trip, this.language())),
  );
  protected readonly kpis = computed(() => {
    const summary = this.summary();
    return summary ? tripKpis(summary) : null;
  });
  protected readonly state = computed(() => ({
    ...tripViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: listQuery.filtered(tripViewQuery(this.url.state())),
    }),
  );
  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.choices.load();
    this.summaryQuery = this.api.watchSummary();
    this.summaryQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.summaryError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.summary.set(result.data.fleetTripSummary);
        }
      },
      error: (error: unknown) => {
        this.summaryError.set(error);
      },
    });
    this.url.changes
      .pipe(
        switchMap((state) => {
          this.page.set(null);
          this.loading.set(true);
          this.error.set(null);
          this.query = this.api.watch(tripVariables(state, this.units.preferences().timeZone));
          return this.query.valueChanges.pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error && !result.loading) {
          this.acceptPage(result.data.fleetTrips);
        }
      });
  }
  private acceptPage(page: AdminTripsQuery['fleetTrips']): void {
    this.page.set(page);
    this.url.correctPage(Math.max(1, Math.ceil(page.total / this.url.state().pageSize)));
  }
  changeState(query: ListQuery): void {
    const applied = this.url.state();
    const next = tripQueryState(query);
    const same = sameListState(
      { ...next, search: applied.search, page: applied.page },
      applied,
      tripDefinition,
    );
    if (query.search !== this.url.searchDraft() && same) {
      this.url.editSearch(query.search);
    } else {
      const search = searchApplies(query.search) ? normalizeSearch(query.search) : applied.search;
      this.url.setState({
        ...next,
        search,
        page: query.pageSize === applied.pageSize && search === applied.search ? query.page : 1,
      });
    }
  }
  run({ action, ids }: ListActionRequest<TripActionId>): void {
    const [id] = ids;
    if (!id || this.destroyRef.destroyed) {
      return;
    }
    if (action === 'open') {
      this.url.cancelPending();
      this.url.searchDraft.set(this.url.state().search);
      void this.router.navigate([id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    } else {
      const trip = this.page()?.items.find((trip) => trip.id === id);
      if (trip) {
        void this.router.navigate([
          '/',
          this.language(),
          this.branch().id,
          'fleet',
          'vehicles',
          trip.vehicleId,
          'overview',
        ]);
      }
    }
  }
  refresh(): void {
    const query = this.query;
    if (!query) {
      return;
    }
    this.loading.set(true);
    void query
      .refetch()
      .then((result) => {
        if (this.destroyRef.destroyed || this.query !== query) {
          return;
        }
        this.loading.set(false);
        this.error.set(result.error ?? null);
        if (result.data && !result.error) {
          this.acceptPage(result.data.fleetTrips);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed && this.query === query) {
          this.loading.set(false);
          this.error.set(error);
        }
      });
    this.refreshSummary();
  }
  refreshSummary(): void {
    void this.summaryQuery
      ?.refetch()
      .then((result) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        this.summaryError.set(result.error ?? null);
        if (result.data && !result.error) {
          this.summary.set(result.data.fleetTripSummary);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.summaryError.set(error);
        }
      });
  }
}
