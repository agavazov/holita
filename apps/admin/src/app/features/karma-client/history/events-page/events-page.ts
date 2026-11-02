import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
  afterNextRender,
  Injector,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { KarmaDateTime } from '../../date-time/karma-date-time';
import { RouteDrawer } from '../../../../ui/drawer/route-drawer';
import { RowActions } from '../../../../ui/row-actions/row-actions';
import {
  listRecord,
  type ListAction,
  type ListActionRequest,
} from '../../../../ui/list/list-actions';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TablePanel } from '../../../../ui/table-panel/table-panel';
import { tableView } from '../../../../ui/table-panel/table-view';
import type { Subscription } from 'rxjs';
import type {
  AdminKarmaCarQuery,
  AdminKarmaEventsQuery,
  KarmaEventsInput,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { karmaRecordMessages } from '../../record-details/karma-record-messages';
import { karmaDateControl, karmaDateParameter } from '../../karma-date-time';
import { FormField } from '../../../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../../../ui/forms/focus';
import {
  karmaFilterErrors,
  karmaFilterFocusOrder,
  type KarmaFilterErrors,
} from '../../filter-validation/karma-filter-errors';
import { KarmaHistoryApi } from '../karma-history-api';
import { eventsFilters } from '../history-filters';
import { positiveId } from '../../edata/edata-page/edata-filters';
import { KarmaCarHeader } from '../../car-header/karma-car-header';
import { karmaCarNavigationContext } from '../../car-header/karma-car-context';
import { MapPreview } from '../../../../ui/map-preview/map-preview';
import { mapCoordinates } from '../../../../ui/map-preview/location-map';

type EventsPageResult = AdminKarmaEventsQuery['karmaEvents'];
type EventsRow = EventsPageResult['items'][number];

@Component({
  imports: [
    KarmaCarHeader,
    ReactiveFormsModule,
    FormField,
    ButtonDirective,
    KarmaDateTime,
    RouteDrawer,
    MapPreview,
    RowActions,
    InputTextModule,
    Message,
    SelectModule,
    TableModule,
    TablePanel,
  ],
  providers: [KarmaHistoryApi],
  selector: 'holita-events-page',
  styleUrl: './events-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-page.html',
})
export class EventsPage implements OnInit {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly detailText = computed(() => karmaRecordMessages[this.language()]);
  readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  readonly carLoaded = signal(false);
  readonly page = signal<EventsPageResult | null>(null);
  readonly selected = signal<EventsRow | null>(null);
  readonly selectedCoordinates = computed(() =>
    mapCoordinates(this.selected()?.latitude, this.selected()?.longitude),
  );
  readonly carLoading = signal(false);
  readonly pageLoading = signal(false);
  readonly loading = computed(() => this.carLoading() || this.pageLoading());
  readonly error = signal(false);
  readonly tableState = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error() ? true : null,
      rows: this.page()?.items.length ?? null,
      filtered: false,
    }),
  );
  readonly actions = computed<readonly ListAction<'view', EventsRow>[]>(() => [
    { id: 'view', label: this.text().view },
  ]);
  readonly invalidFilters = signal(false);
  readonly formError = signal(false);
  readonly fieldErrors = signal<KarmaFilterErrors>({});
  readonly previous = signal<(string | null)[]>([]);
  readonly validId = computed(() => positiveId(this.carId()));
  readonly pageSizes = [25, 50, 100];
  readonly form = new FormGroup({
    size: new FormControl(50, { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    types: new FormControl('', { nonNullable: true }),
  });
  private readonly api = inject(KarmaHistoryApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('filterForm');
  private input: KarmaEventsInput | null = null;
  private carQuery: ReturnType<KarmaHistoryApi['watchCar']> | undefined;
  private pageQuery: ReturnType<KarmaHistoryApi['watchEvents']> | undefined;
  private pageSubscription: Subscription | undefined;

  ngOnInit(): void {
    if (!this.validId()) {
      return;
    }
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.formError()) {
        this.fieldErrors.set(karmaFilterErrors('events', this.form.getRawValue(), this.language()));
      }
    });
    this.api.initialize(this.language());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (
        this.route.snapshot.paramMap.get('recordId') !== this.carId() ||
        this.route.parent?.snapshot.paramMap.get('language') !== this.language() ||
        this.route.snapshot.data['section'] !== 'events'
      ) {
        return;
      }
      this.pageSubscription?.unsubscribe();
      this.pageQuery = undefined;
      this.page.set(null);
      this.selected.set(null);
      this.pageLoading.set(false);
      this.error.set(false);
      this.formError.set(false);
      this.fieldErrors.set({});
      this.input = eventsFilters(this.carId(), params);
      this.invalidFilters.set(this.input === null);
      this.form.reset({
        size: this.input?.pageSize ?? 50,
        from: karmaDateControl(params.get('from') ?? ''),
        to: karmaDateControl(params.get('to') ?? ''),
        types: params.get('types') ?? '',
      });
      this.restorePrevious();
      if (this.car()) {
        this.readPage();
      }
    });
    this.carLoading.set(true);
    this.carQuery = this.api.watchCar(this.carId());
    this.carQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.carLoading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.car.set(result.data.karmaCar);
          this.carLoaded.set(true);
          if (this.car() && !this.pageQuery) {
            this.readPage();
          }
        }
      },
      error: () => {
        this.carLoading.set(false);
        this.error.set(true);
      },
    });
    this.destroyRef.onDestroy(() => {
      this.pageSubscription?.unsubscribe();
      this.pageQuery = undefined;
      this.carQuery = undefined;
    });
  }

  private readPage(): void {
    if (!this.input) {
      return;
    }
    const query = this.api.watchEvents(this.input);
    this.pageQuery = query;
    this.pageLoading.set(true);
    this.pageSubscription = query.valueChanges.subscribe({
      next: (result) => {
        this.pageLoading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.page.set(result.data.karmaEvents);
        }
      },
      error: () => {
        this.pageLoading.set(false);
        this.error.set(true);
      },
    });
  }

  refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    const query = this.pageQuery ?? this.carQuery;
    void query?.refetch().catch(() => {
      if (query === this.pageQuery || query === this.carQuery) {
        this.carLoading.set(false);
        this.pageLoading.set(false);
        this.error.set(true);
      }
    });
  }

  apply(): void {
    const values = this.form.getRawValue();
    const params = {
      size: String(values.size),
      from: karmaDateParameter(values.from),
      to: karmaDateParameter(values.to),
      types: values.types.trim(),
    };
    const input = eventsFilters(this.carId(), convertToParamMap(params));
    this.formError.set(input === null);
    this.fieldErrors.set(
      input ? {} : karmaFilterErrors('events', this.form.getRawValue(), this.language()),
    );
    if (!input) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(form, karmaFilterFocusOrder, 'events-');
          }
        },
        { injector: this.injector },
      );
      return;
    }
    if (JSON.stringify(input) === JSON.stringify(this.input)) {
      this.refresh();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...karmaCarNavigationContext(this.route.snapshot.queryParamMap), ...params },
    });
  }

  reset(): void {
    this.form.reset({ size: 50, from: '', to: '', types: '' });
    this.apply();
  }

  older(): void {
    const cursor = this.page()?.nextCursor;
    if (!cursor || this.loading() || this.error()) {
      return;
    }
    this.navigate(cursor, [...this.previous(), this.page()?.cursor ?? this.input?.cursor ?? null]);
  }

  newer(): void {
    const history = this.previous();
    if (!history.length || this.loading()) {
      return;
    }
    this.navigate(history.at(-1) ?? null, history.slice(0, -1));
  }

  latest(): void {
    if (this.loading()) {
      return;
    }
    if (!this.input?.cursor) {
      this.refresh();
      return;
    }
    this.navigate(null, []);
  }

  private navigate(cursor: string | null, previous: (string | null)[]): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { cursor },
      state: { eventsKey: this.historyKey(), eventsPrevious: previous },
    });
  }

  private historyKey(): string {
    return JSON.stringify({ ...this.input, cursor: null });
  }

  private restorePrevious(): void {
    const state: unknown = this.location.getState();
    if (
      typeof state === 'object' &&
      state !== null &&
      'eventsKey' in state &&
      state.eventsKey === this.historyKey() &&
      'eventsPrevious' in state &&
      Array.isArray(state.eventsPrevious) &&
      state.eventsPrevious.every(
        (value: unknown) =>
          value === null || (typeof value === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(value)),
      )
    ) {
      this.previous.set(
        state.eventsPrevious.filter(
          (value: unknown): value is string | null => value === null || typeof value === 'string',
        ),
      );
    } else {
      this.previous.set([]);
    }
  }

  record(row: EventsRow) {
    return listRecord(this.actions(), row, row.id, row.id);
  }

  runAction(request: ListActionRequest<'view'>): void {
    const row = this.page()?.items.find((item) => item.id === request.ids[0]);
    if (row) {
      this.selected.set(row);
    }
  }

  closeDetails(): void {
    this.selected.set(null);
  }

  fields(row: EventsRow) {
    return [
      { name: 'message_id', value: row.id },
      { name: 'car_id', value: row.carId },
      { name: 'device_id', value: row.deviceId },
      { name: 'eid', value: row.eventId },
      { name: 'edt', value: row.edt },
      { name: 'edt_tz', value: row.edtTz },
      { name: 'pdt', value: row.pdt },
      { name: 'latitude', value: row.latitude },
      { name: 'longitude', value: row.longitude },
      { name: 'spd', value: row.spd },
      { name: 'odo', value: row.odo },
      { name: 'extra', value: row.extra },
    ];
  }
}
