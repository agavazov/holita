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
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import type { Subscription } from 'rxjs';
import type {
  AdminKarmaCarQuery,
  AdminKarmaEdataQuery,
  FleetEvidenceFragment,
  FleetScenarioCoverageFragment,
  KarmaEdataInput,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { karmaRecordMessages } from '../../record-details/karma-record-messages';
import { karmaDateControl, karmaDateParameter } from '../../karma-date-time';
import { FormField } from '../../../../ui/form-field/form-field';
import { RouteDrawer } from '../../../../ui/drawer/route-drawer';
import { TablePanel } from '../../../../ui/table-panel/table-panel';
import { tableView } from '../../../../ui/table-panel/table-view';
import { RowActions } from '../../../../ui/row-actions/row-actions';
import type {
  ListActionBase,
  ListActionRequest,
  ListRecord,
} from '../../../../ui/list/list-actions';
import { focusFirstInvalid } from '../../../../ui/forms/focus';
import {
  karmaFilterErrors,
  karmaFilterFocusOrder,
  type KarmaFilterErrors,
} from '../../filter-validation/karma-filter-errors';
import { KarmaEdataApi } from '../karma-edata-api';
import { edataFilters, positiveId } from './edata-filters';
import { KarmaCarHeader } from '../../car-header/karma-car-header';
import { karmaCarNavigationContext } from '../../car-header/karma-car-context';
import { MapPreview } from '../../../../ui/map-preview/map-preview';
import { mapCoordinates } from '../../../../ui/map-preview/location-map';
import { MeasurementWorkspace } from '../../../../ui/measurement-workspace/measurement-workspace';
import { edataChannels, edataRecords, measurementMessages } from './measurement-mapping';

type EdataPageResult = AdminKarmaEdataQuery['karmaEdata'];
type EdataMessage = EdataPageResult['items'][number];

@Component({
  imports: [
    KarmaCarHeader,
    ReactiveFormsModule,
    FormField,
    ButtonDirective,
    KarmaDateTime,
    RouteDrawer,
    MapPreview,
    MeasurementWorkspace,
    TablePanel,
    RowActions,
    InputTextModule,
    Message,
    SelectModule,
    TableModule,
  ],
  providers: [KarmaEdataApi],
  selector: 'holita-edata-page',
  styleUrl: './edata-page.css',
  templateUrl: './edata-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdataPage implements OnInit {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly detailText = computed(() => karmaRecordMessages[this.language()]);
  readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  readonly carLoaded = signal(false);
  readonly page = signal<EdataPageResult | null>(null);
  readonly selected = signal<EdataMessage | null>(null);
  readonly measurementMode = signal(false);
  readonly measurementText = computed(() => measurementMessages(this.language()));
  readonly measurementChannel = signal<string | null>(null);
  readonly measurementRecord = signal<string | null>(null);
  private readonly viewRetrievedAt = signal<string | null>(null);
  readonly measurementChannels = computed(() =>
    edataChannels(this.page()?.items ?? [], this.language()),
  );
  readonly measurementRecords = computed(() => {
    const page = this.page();
    const retrievedAt = this.viewRetrievedAt();
    return page && retrievedAt ? edataRecords(page.items, retrievedAt) : null;
  });
  readonly measurementProvenance = computed<FleetEvidenceFragment | null>(() => {
    const retrievedAt = this.viewRetrievedAt();
    return retrievedAt
      ? {
          origin: 'OBSERVED',
          source: 'KARMA_API',
          sourceRecordId: this.carId(),
          scenarioId: null,
          eventAt: null,
          receivedAt: null,
          retrievedAt,
        }
      : null;
  });
  readonly measurementCoverage = computed<FleetScenarioCoverageFragment>(() => ({
    retrieval: this.error()
      ? 'UNAVAILABLE'
      : this.page()
        ? this.page()?.hasMore
          ? 'PARTIAL'
          : 'COMPLETE'
        : 'NOT_STARTED',
    positionCoverage: 'NOT_ASSESSED',
    positionsLoaded:
      this.measurementRecords()?.filter((row) => row.coordinates !== null).length ?? 0,
    gaps: [],
  }));
  readonly measurementScope = computed(() => {
    const text = this.measurementText();
    const page = this.page();
    const input = this.input;
    const period =
      input?.fromDate && input.toDate
        ? `${text.requested}: ${input.fromDate} – ${input.toDate}.`
        : text.unbounded;
    return [
      text.subset,
      period,
      `${text.limits} ${String(input?.pageSize ?? 50)}.`,
      `${text.filter}: ${input?.parameterIds?.join(', ') || text.allParameters}.`,
      page ? (page.hasMore ? text.more : text.noMore) : '',
      text.viewClock,
      this.error() && page ? text.retained : '',
    ]
      .filter(Boolean)
      .join(' ');
  });
  readonly selectedMeasurementMessage = computed(
    () =>
      this.page()?.items.find((row) => `KARMA_API:${row.id}` === this.measurementRecord()) ?? null,
  );
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
  readonly actions = computed<readonly ListActionBase<'view'>[]>(() => [
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
    parameters: new FormControl('', { nonNullable: true }),
  });
  private readonly api = inject(KarmaEdataApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('filterForm');
  private input: KarmaEdataInput | null = null;
  private carQuery: ReturnType<KarmaEdataApi['watchCar']> | undefined;
  private pageQuery: ReturnType<KarmaEdataApi['watch']> | undefined;
  private pageSubscription: Subscription | undefined;

  ngOnInit(): void {
    if (!this.validId()) {
      return;
    }
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.formError()) {
        this.fieldErrors.set(karmaFilterErrors('edata', this.form.getRawValue(), this.language()));
      }
    });
    this.api.initialize(this.language());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (
        this.route.snapshot.paramMap.get('recordId') !== this.carId() ||
        this.route.parent?.snapshot.paramMap.get('language') !== this.language() ||
        this.route.snapshot.data['edata'] !== true
      ) {
        return;
      }
      this.pageSubscription?.unsubscribe();
      this.pageQuery = undefined;
      this.page.set(null);
      this.viewRetrievedAt.set(null);
      this.measurementChannel.set(null);
      this.measurementRecord.set(null);
      this.selected.set(null);
      this.pageLoading.set(false);
      this.error.set(false);
      this.formError.set(false);
      this.fieldErrors.set({});
      this.input = edataFilters(this.carId(), params);
      this.invalidFilters.set(this.input === null);
      this.form.reset({
        size: this.input?.pageSize ?? 50,
        from: karmaDateControl(params.get('from') ?? ''),
        to: karmaDateControl(params.get('to') ?? ''),
        parameters: params.get('parameters') ?? '',
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
    const query = this.api.watch(this.input);
    this.pageQuery = query;
    this.pageLoading.set(true);
    this.pageSubscription = query.valueChanges.subscribe({
      next: (result) => {
        this.pageLoading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.loading && !result.error) {
          this.viewRetrievedAt.set(new Date().toISOString());
          this.page.set(result.data.karmaEdata);
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
      parameters: values.parameters.trim(),
    };
    const input = edataFilters(this.carId(), convertToParamMap(params));
    this.formError.set(input === null);
    this.fieldErrors.set(
      input ? {} : karmaFilterErrors('edata', this.form.getRawValue(), this.language()),
    );
    if (!input) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(form, karmaFilterFocusOrder, 'edata-');
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
    this.form.reset({ size: 50, from: '', to: '', parameters: '' });
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
      state: { edataKey: this.historyKey(), edataPrevious: previous },
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
      'edataKey' in state &&
      state.edataKey === this.historyKey() &&
      'edataPrevious' in state &&
      Array.isArray(state.edataPrevious) &&
      state.edataPrevious.every(
        (value: unknown) =>
          value === null || (typeof value === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(value)),
      )
    ) {
      this.previous.set(
        state.edataPrevious.filter(
          (value: unknown): value is string | null => value === null || typeof value === 'string',
        ),
      );
    } else {
      this.previous.set([]);
    }
  }

  record(row: EdataMessage): ListRecord<'view'> {
    return { id: row.id, label: row.id, unavailable: [] };
  }

  viewMessage(event: ListActionRequest<'view'>): void {
    this.selected.set(this.page()?.items.find((row) => row.id === event.ids[0]) ?? null);
  }
}
