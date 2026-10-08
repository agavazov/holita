import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, convertToParamMap } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Checkbox } from 'primeng/checkbox';
import { Eye } from '@primeicons/angular/eye';
import { Trash } from '@primeicons/angular/trash';
import { Replay } from '@primeicons/angular/replay';
import { Accordion, AccordionPanel, AccordionHeader, AccordionContent } from 'primeng/accordion';
import type {
  AdminEventListItemFragment,
  AdminEventsQuery,
  AdminStoresQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { RelationPicker, type RelationLoader } from '../relation-picker';
import { EventsApi, type EventAction, type EventActionTarget } from './events-api';
import { EventActionDialog } from './event-action-dialog/event-action-dialog';
import { eventStatuses, eventFormats } from './event-form';
import { formatEventTime, validCalendarDate } from './event-time';
import {
  readEventListQuery,
  eventListQueryParams,
  eventListVariables,
  eventPageSizes,
  eventSortFields,
  sameEventListQuery,
  validCapacity,
  eventColumns,
  defaultEventColumns,
  readEventColumns,
  type EventColumn,
  type EventListQuery,
} from './event-list-query';

@Component({
  selector: 'holita-events-page',
  providers: [EventsApi],
  imports: [
    FormsModule,
    RouterLink,
    ButtonDirective,
    InputText,
    Select,
    TableModule,
    Message,
    Paginator,
    Checkbox,
    RelationPicker,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    EventActionDialog,
    Eye,
    Trash,
    Replay,
  ],
  templateUrl: './events-page.html',
  styleUrls: ['../reference-list.scss', './events-page.scss'],
})
export class EventsPage implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(EventsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly listQuery = computed(() => readEventListQuery(this.params()));
  readonly search = linkedSignal(() => this.listQuery().search);
  readonly from = linkedSignal(() => this.listQuery().from);
  readonly to = linkedSignal(() => this.listQuery().to);
  readonly min = linkedSignal(() => this.listQuery().capacityMin);
  readonly max = linkedSignal(() => this.listQuery().capacityMax);
  readonly rangeError = signal(false);
  readonly columns = signal<EventColumn[]>([...defaultEventColumns]);
  readonly columnOptions = eventColumns;
  readonly columnError = signal(false);
  readonly columnPicker = signal(false);
  readonly advancedFilters = signal<string[]>([]);
  changeAdvancedFilters(value: unknown): void {
    if (Array.isArray(value))
      this.advancedFilters.set(
        value.filter((item: unknown): item is string => typeof item === 'string'),
      );
  }
  readonly pageSizes = eventPageSizes;
  readonly statusOptions = computed(() =>
    eventStatuses.map((value) => ({ value, label: this.statusLabel(value) })),
  );
  readonly formatOptions = computed(() =>
    eventFormats.map((value) => ({ value, label: this.formatLabel(value) })),
  );
  readonly featuredOptions = computed(() => [
    { value: null, label: this.text().eventAnyFeatured },
    { value: true, label: this.text().yes },
    { value: false, label: this.text().no },
  ]);
  readonly sortOptions = computed(() =>
    eventSortFields.map((value) => ({ value, label: this.columnLabel(value.toLowerCase()) })),
  );
  readonly sortField = computed(() =>
    this.listQuery().sort === 'STARTS_AT'
      ? 'startsAt'
      : this.listQuery().sort === 'CREATED_AT'
        ? 'createdAt'
        : this.listQuery().sort.toLowerCase(),
  );
  readonly sortOrder = computed(() => (this.listQuery().order === 'ASC' ? 1 : -1));
  readonly loading = signal(true);
  readonly page = signal<AdminEventsQuery['referenceEvents'] | null>(null);
  readonly selected = signal<string[]>([]);
  readonly actionTarget = signal<EventActionTarget | null>(null);
  readonly actionComplete = signal(false);
  readonly allSelected = computed(() => {
    const rows = this.page()?.items ?? [];
    return rows.length > 0 && rows.every((row) => this.selected().includes(row.id));
  });
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  private readonly edits = new Subject<void>();
  private readonly cancelEdits = new Subject<void>();
  private readonly sorts = new Subject<Pick<EventListQuery, 'sort' | 'order'>>();
  private query: ReturnType<EventsApi['watch']> | undefined;
  readonly trackEvent = (_index: number, event: AdminEventListItemFragment) => event.id;
  readonly venueLoader: RelationLoader = (request) =>
    this.api
      .watchVenues({
        ...request,
        limit: request.ids ? 100 : 20,
        sort: { field: 'NAME', direction: 'ASC' },
      })
      .valueChanges.pipe(
        filter((result) => !result.loading),
        map((result) => {
          if (result.error)
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          if (result.dataState !== 'complete') throw new Error('Missing Venues result.');
          return result.data.referenceVenues;
        }),
      );
  readonly tagLoader: RelationLoader = (request) =>
    this.api
      .watchTags({
        ...request,
        limit: request.ids ? 100 : 20,
        sort: { field: 'NAME', direction: 'ASC' },
      })
      .valueChanges.pipe(
        filter((result) => !result.loading),
        map((result) => {
          if (result.error)
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          if (result.dataState !== 'complete') throw new Error('Missing Tags result.');
          return result.data.referenceTags;
        }),
      );
  private get columnKey(): string {
    return `holita.events.columns.v1.${this.store().id}`;
  }
  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    try {
      this.columns.set(readEventColumns(localStorage.getItem(this.columnKey)));
    } catch {
      this.columnError.set(true);
    }
    this.edits
      .pipe(
        switchMap(() => timer(300).pipe(takeUntil(this.cancelEdits))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.apply({}, true);
      });
    this.sorts
      .pipe(
        switchMap((sort) =>
          timer(0).pipe(
            takeUntil(this.cancelEdits),
            map(() => sort),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((sort) => {
        if (sort.sort !== this.listQuery().sort || sort.order !== this.listQuery().order)
          this.apply(sort);
      });
    this.route.queryParamMap
      .pipe(
        tap(() => {
          this.cancelEdits.next();
          this.rangeError.set(false);
        }),
        map(readEventListQuery),
        distinctUntilChanged(sameEventListQuery),
        switchMap((query) => {
          this.selected.set([]);
          this.actionTarget.set(null);
          this.actionComplete.set(false);
          this.page.set(null);
          this.loading.set(true);
          this.error.set(null);
          const watched = this.api.watch(eventListVariables(query));
          this.query = watched;
          return watched.valueChanges.pipe(
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
        if (result.dataState === 'complete' && !result.error) {
          const page = result.data.referenceEvents,
            current = this.listQuery();
          const last = Math.max(1, Math.ceil(page.total / current.pageSize));
          if (current.page > last) {
            if (!result.loading) this.navigate({ ...current, page: last }, true);
          } else {
            this.page.set(page);
            this.selected.update((ids) =>
              ids.filter((id) => page.items.some((row) => row.id === id)),
            );
          }
        }
      });
  }
  statusLabel(value: string): string {
    return value === 'PUBLISHED'
      ? this.text().eventPublished
      : value === 'ARCHIVED'
        ? this.text().eventArchived
        : this.text().eventDraft;
  }
  formatLabel(value: string): string {
    return value === 'ONLINE'
      ? this.text().eventOnline
      : value === 'HYBRID'
        ? this.text().eventHybrid
        : this.text().eventInPerson;
  }
  columnLabel(value: string): string {
    switch (value) {
      case 'title':
        return this.text().eventTitle;
      case 'code':
        return this.text().eventCode;
      case 'status':
        return this.text().status;
      case 'format':
        return this.text().eventFormat;
      case 'startsAt':
      case 'starts_at':
        return this.text().eventStartsAt;
      case 'capacity':
        return this.text().capacity;
      case 'budget':
        return this.text().eventBudget;
      default:
        return this.text().eventCreatedAt;
    }
  }
  cell(row: AdminEventListItemFragment, column: EventColumn): string {
    switch (column) {
      case 'status':
        return this.statusLabel(row.status);
      case 'format':
        return this.formatLabel(row.format);
      case 'startsAt':
        return formatEventTime(row.startsAt, this.language());
      case 'createdAt':
        return formatEventTime(row.createdAt, this.language());
      case 'budget':
        return row.budget === null ? '—' : `${row.budget} EUR`;
      default:
        return row[column] === null ? '—' : String(row[column]);
    }
  }
  refresh(): void {
    const query = this.query;
    void query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed && this.query === query) this.error.set(error);
    });
  }
  selectRow(id: string, value: unknown): void {
    if (this.actionTarget() || this.loading() || typeof value !== 'boolean') return;
    if (!this.page()?.items.some((row) => row.id === id)) return;
    this.selected.update((ids) =>
      value ? [...new Set([...ids, id])] : ids.filter((selected) => selected !== id),
    );
  }
  selectPage(value: unknown): void {
    if (this.actionTarget() || this.loading() || typeof value !== 'boolean') return;
    this.selected.set(value ? (this.page()?.items.map((row) => row.id) ?? []) : []);
  }
  requestAction(action: EventAction, ids = this.selected()): void {
    if (this.actionTarget() || this.loading() || !ids.length) return;
    const pageIds = new Set(this.page()?.items.map((row) => row.id));
    if (ids.length > 100 || ids.some((id) => !pageIds.has(id))) return;
    this.actionComplete.set(false);
    this.actionTarget.set({ action, ids: [...ids] });
  }
  actionFinished(): void {
    this.actionTarget.set(null);
    this.selected.set([]);
    this.actionComplete.set(true);
    this.heading().nativeElement.focus();
    this.refresh();
  }
  changeView(trashed: boolean): void {
    this.cancelEdits.next();
    this.navigate({ ...this.listQuery(), trashed, page: 1 });
  }
  editSearch(value: unknown): void {
    if (typeof value === 'string') {
      this.search.set(value);
      this.edits.next();
    }
  }
  editRange(field: 'from' | 'to' | 'min' | 'max', value: unknown): void {
    if (typeof value === 'string') {
      this[field].set(value);
      this.apply();
    }
  }
  changeStatuses(value: unknown): void {
    if (Array.isArray(value))
      this.apply({ statuses: eventStatuses.filter((status) => value.includes(status)) });
  }
  changeFormats(value: unknown): void {
    if (Array.isArray(value))
      this.apply({ formats: eventFormats.filter((format) => value.includes(format)) });
  }
  changeFeatured(value: unknown): void {
    if (value === null || typeof value === 'boolean') this.apply({ featured: value });
  }
  changeSort(value: unknown): void {
    const sort = eventSortFields.find((field) => field === value);
    if (sort) this.apply({ sort });
  }
  changeOrder(): void {
    this.apply({ order: this.listQuery().order === 'ASC' ? 'DESC' : 'ASC' });
  }
  changeVenues(value: string[]): void {
    this.apply({ venueIds: value });
  }
  changeTags(value: string[]): void {
    this.apply({ tagIds: value });
  }
  changeColumns(column: EventColumn, value: unknown): void {
    if (typeof value !== 'boolean') return;
    this.columns.set(
      eventColumns.filter((option) =>
        option === column ? value : this.columns().includes(option),
      ),
    );
    this.persistColumns();
  }
  private persistColumns(): void {
    try {
      localStorage.setItem(this.columnKey, JSON.stringify(this.columns()));
      this.columnError.set(false);
    } catch {
      this.columnError.set(true);
    }
  }
  reset(): void {
    this.cancelEdits.next();
    this.columns.set([...defaultEventColumns]);
    this.persistColumns();
    this.rangeError.set(false);
    this.navigate({
      ...readEventListQuery(convertToParamMap({})),
      trashed: this.listQuery().trashed,
    });
  }
  sortChanged(value: unknown): void {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('field' in value) ||
      !('order' in value) ||
      (value.order !== 1 && value.order !== -1)
    )
      return;
    const name =
      value.field === 'startsAt'
        ? 'STARTS_AT'
        : value.field === 'createdAt'
          ? 'CREATED_AT'
          : typeof value.field === 'string'
            ? value.field.toUpperCase()
            : '';
    const sort = eventSortFields.find((field) => field === name);
    if (sort) this.sorts.next({ sort, order: value.order === 1 ? 'ASC' : 'DESC' });
  }
  changePage(value: PaginatorState): void {
    const current = this.listQuery(),
      size = value.rows ?? current.pageSize;
    if (eventPageSizes.includes(size))
      this.navigate({
        ...current,
        pageSize: size,
        page: size === current.pageSize ? (value.page ?? 0) + 1 : 1,
      });
  }
  private apply(changes: Partial<EventListQuery> = {}, replaceUrl = false): void {
    this.cancelEdits.next();
    const from = this.from(),
      to = this.to(),
      min = this.min(),
      max = this.max();
    if (
      (from && !validCalendarDate(from)) ||
      (to && !validCalendarDate(to)) ||
      (from && to && from > to) ||
      !validCapacity(min) ||
      !validCapacity(max) ||
      (min && max && Number(min) > Number(max))
    ) {
      this.rangeError.set(true);
      return;
    }
    this.rangeError.set(false);
    this.navigate(
      {
        ...this.listQuery(),
        page: 1,
        search: this.search(),
        from,
        to,
        capacityMin: min,
        capacityMax: max,
        ...changes,
      },
      replaceUrl,
    );
  }
  private navigate(query: EventListQuery, replaceUrl = false): void {
    const normalized = readEventListQuery(convertToParamMap(eventListQueryParams(query)));
    this.search.set(normalized.search);
    this.from.set(normalized.from);
    this.to.set(normalized.to);
    this.min.set(normalized.capacityMin);
    this.max.set(normalized.capacityMax);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: eventListQueryParams(normalized),
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl,
    });
  }
}
