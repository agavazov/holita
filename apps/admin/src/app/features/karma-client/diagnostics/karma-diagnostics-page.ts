import { Location } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  Injector,
  input,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { Subscription } from 'rxjs';
import type {
  AdminKarmaCarQuery,
  AdminKarmaDiagnosticHistoryQuery,
  KarmaDiagnosticHistoryInput,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { listRecord, type ListAction, type ListActionRequest } from '../../../ui/list/list-actions';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaCarHeader } from '../car-header/karma-car-header';
import { karmaCarNavigationContext } from '../car-header/karma-car-context';
import { positiveId } from '../edata/edata-page/edata-filters';
import { KarmaApi } from '../karma-api';
import { DiagnosticReadsPanel } from './diagnostic-reads-panel';
import { KarmaDiagnosticsApi } from './karma-diagnostics-api';
import bg from './bg.json';
import en from './en.json';

type DiagnosticHistory = AdminKarmaDiagnosticHistoryQuery['karmaDiagnosticHistory'];
type DiagnosticReport = DiagnosticHistory['items'][number];
type DiagnosticFaultRow = {
  id: string;
  report: DiagnosticReport;
  fault: DiagnosticReport['faults'][number];
};

@Component({
  selector: 'holita-karma-diagnostics-page',
  imports: [
    KarmaCarHeader,
    ReactiveFormsModule,
    ButtonDirective,
    InputTextModule,
    Message,
    TableModule,
    Tag,
    RouteDrawer,
    FormField,
    RowActions,
    TablePanel,
    DiagnosticReadsPanel,
  ],
  providers: [KarmaApi, KarmaDiagnosticsApi],
  templateUrl: './karma-diagnostics-page.html',
  styleUrl: './karma-diagnostics-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class KarmaDiagnosticsPage implements OnInit {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  protected readonly workspace = inject(AdminWorkspace);
  private readonly cars = inject(KarmaApi);
  private readonly api = inject(KarmaDiagnosticsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('filterForm');
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  protected readonly carLoaded = signal(false);
  private readonly carError = signal(false);
  private readonly historyError = signal(false);
  private readonly carLoading = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly loading = computed(() => this.carLoading() || this.historyLoading());
  protected readonly page = signal<DiagnosticHistory | null>(null);
  protected readonly selected = signal<DiagnosticFaultRow | null>(null);
  protected readonly faultRows = computed<DiagnosticFaultRow[]>(() =>
    (this.page()?.items ?? []).flatMap((report) =>
      report.faults.map((fault, index) => ({
        id: `${report.event.id}:${String(index)}`,
        report,
        fault,
      })),
    ),
  );
  protected readonly reportedFaultCount = computed(
    () => this.faultRows().filter((row) => row.fault.status !== 'REMOVED').length,
  );
  protected readonly unreadableReports = computed(
    () => this.page()?.items.some((report) => report.decoding !== 'DECODED') ?? false,
  );
  protected readonly faultReference = 'https://static.nhtsa.gov/odi/tsbs/2018/MC-10141869-9999.pdf';
  protected readonly invalidBounds = signal(false);
  protected readonly invalidFrom = signal(false);
  protected readonly invalidTo = signal(false);
  protected readonly previous = signal<(string | null)[]>([]);
  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  protected readonly validId = computed(() => positiveId(this.carId()));
  protected readonly error = computed(
    () => this.carError() || this.historyError() || this.page()?.retrieval === 'UNAVAILABLE',
  );
  protected readonly failure = computed(() =>
    this.page()?.reason === 'INCOMPATIBLE_SOURCE'
      ? this.text().incompatible
      : this.text().unavailable,
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.historyLoading(),
      error: this.error() ? true : null,
      rows: this.page() ? this.faultRows().length : null,
      filtered: false,
    }),
  );
  protected readonly branches = computed(() =>
    (this.workspace.branches.branches() ?? []).filter(
      (branch) => branch.id === this.workspace.branches.selectedId(),
    ),
  );
  protected readonly actions = computed<readonly ListAction<'view', DiagnosticFaultRow>[]>(() => [
    { id: 'view', label: this.text().view },
  ]);
  readonly form = new FormGroup({
    fromMessageId: new FormControl('', { nonNullable: true }),
    toMessageId: new FormControl('', { nonNullable: true }),
  });
  private historyInput: KarmaDiagnosticHistoryInput | null = null;
  private historyQuery: ReturnType<KarmaDiagnosticsApi['watchHistory']> | undefined;
  private carQuery: ReturnType<KarmaApi['watchCar']> | undefined;
  private historySubscription: Subscription | undefined;

  ngOnInit(): void {
    if (!this.validId()) {
      this.carLoaded.set(true);
      return;
    }
    this.cars.initialize(this.language());
    this.api.initialize(this.language());
    this.carLoading.set(true);
    this.carQuery = this.cars.watchCar(this.carId());
    this.carQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.carLoading.set(result.loading);
        this.carError.set(!!result.error);
        if (!result.error && result.dataState === 'complete') {
          this.car.set(result.data.karmaCar);
          this.carLoaded.set(true);
        }
      },
      error: () => {
        this.carLoading.set(false);
        this.carError.set(true);
      },
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (this.route.snapshot.data['section'] !== 'diagnostics') {
        return;
      }
      this.read(params);
    });
    this.destroyRef.onDestroy(() => this.historySubscription?.unsubscribe());
  }

  private read(params: ParamMap): void {
    this.historySubscription?.unsubscribe();
    this.historyQuery = undefined;
    this.historyInput = null;
    this.page.set(null);
    this.selected.set(null);
    this.historyError.set(false);
    const fromMessageId = params.get('fromMessageId') ?? '';
    const toMessageId = params.get('toMessageId') ?? '';
    const cursor = params.get('cursor');
    this.form.reset({ fromMessageId, toMessageId });
    const invalidValues = this.validateBounds(fromMessageId, toMessageId);
    const invalid =
      ['fromMessageId', 'toMessageId', 'cursor'].some((key) => params.getAll(key).length > 1) ||
      invalidValues ||
      (cursor !== null && !/^[A-Za-z0-9_-]{1,2048}$/.test(cursor));
    this.invalidBounds.set(invalid);
    if (invalid) {
      this.historyLoading.set(false);
      return;
    }
    this.historyInput = {
      carId: this.carId(),
      pageSize: 50,
      fromMessageId: fromMessageId || null,
      toMessageId: toMessageId || null,
      cursor,
    };
    this.restorePrevious();
    this.historyLoading.set(true);
    this.historyQuery = this.api.watchHistory(this.historyInput);
    this.historySubscription = this.historyQuery.valueChanges.subscribe({
      next: (result) => {
        this.historyLoading.set(result.loading);
        this.historyError.set(!!result.error);
        if (!result.error && result.dataState === 'complete') {
          this.page.set(result.data.karmaDiagnosticHistory);
        }
      },
      error: () => {
        this.historyLoading.set(false);
        this.historyError.set(true);
      },
    });
  }

  apply(): void {
    const values = this.form.getRawValue();
    const fromMessageId = values.fromMessageId.trim();
    const toMessageId = values.toMessageId.trim();
    if (this.validateBounds(fromMessageId, toMessageId)) {
      this.invalidBounds.set(true);
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(form, ['from-id', 'to-id'], 'diagnostic-');
          }
        },
        { injector: this.injector },
      );
      return;
    }
    this.invalidBounds.set(false);
    this.previous.set([]);
    if (
      this.historyInput !== null &&
      fromMessageId === (this.historyInput.fromMessageId ?? '') &&
      toMessageId === (this.historyInput.toMessageId ?? '') &&
      !this.historyInput.cursor
    ) {
      this.refresh();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...karmaCarNavigationContext(this.route.snapshot.queryParamMap),
        fromMessageId: fromMessageId || null,
        toMessageId: toMessageId || null,
      },
    });
  }

  latest(): void {
    this.form.reset({ fromMessageId: '', toMessageId: '' });
    this.apply();
  }

  older(): void {
    const cursor = this.page()?.nextCursor;
    if (!cursor || this.loading() || this.error()) {
      return;
    }
    this.navigate(cursor, [...this.previous(), this.historyInput?.cursor ?? null]);
  }

  newer(): void {
    if (!this.previous().length || this.loading()) {
      return;
    }
    const previous = this.previous();
    this.navigate(previous.at(-1) ?? null, previous.slice(0, -1));
  }

  private navigate(cursor: string | null, previous: (string | null)[]): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { cursor },
      state: { diagnosticsKey: this.historyKey(), diagnosticsPrevious: previous },
    });
  }

  private historyKey(): string {
    return JSON.stringify({ ...this.historyInput, cursor: null });
  }

  private restorePrevious(): void {
    const state: unknown = this.location.getState();
    if (
      typeof state === 'object' &&
      state !== null &&
      'diagnosticsKey' in state &&
      state.diagnosticsKey === this.historyKey() &&
      'diagnosticsPrevious' in state &&
      Array.isArray(state.diagnosticsPrevious) &&
      state.diagnosticsPrevious.every(
        (value: unknown) =>
          value === null || (typeof value === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(value)),
      )
    ) {
      this.previous.set(
        state.diagnosticsPrevious.filter(
          (value: unknown): value is string | null => value === null || typeof value === 'string',
        ),
      );
    } else {
      this.previous.set([]);
    }
  }

  private validateBounds(fromMessageId: string, toMessageId: string): boolean {
    const invalidFrom = !!fromMessageId && !positiveId(fromMessageId);
    const invalidTo =
      (!!toMessageId && !positiveId(toMessageId)) ||
      (!invalidFrom &&
        !!fromMessageId &&
        !!toMessageId &&
        Number(fromMessageId) > Number(toMessageId));
    this.invalidFrom.set(invalidFrom);
    this.invalidTo.set(invalidTo);
    return invalidFrom || invalidTo;
  }

  refresh(): void {
    if (this.loading()) {
      return;
    }
    const query = this.car() ? this.historyQuery : this.carQuery;
    void query?.refetch().catch(() => {
      if (this.car()) {
        this.historyLoading.set(false);
        this.historyError.set(true);
      } else {
        this.carLoading.set(false);
        this.carError.set(true);
      }
    });
  }

  record(row: DiagnosticFaultRow) {
    return listRecord(this.actions(), row, row.id, this.faultTitle(row));
  }

  trackFault(_index: number, row: DiagnosticFaultRow): string {
    return row.id;
  }

  open(request: ListActionRequest<'view'>): void {
    this.selected.set(this.faultRows().find((row) => row.id === request.ids[0]) ?? null);
  }

  faultTitle(row: DiagnosticFaultRow): string {
    switch (row.fault.spn) {
      case 4339:
        return this.text().scrFault;
      case 1247:
        return this.text().enginePowerFault;
      default:
        return row.fault.fmi === 15 ? this.text().aboveNormalTitle : this.text().unidentifiedFault;
    }
  }

  faultMeaning(row: DiagnosticFaultRow): string {
    switch (row.fault.fmi) {
      case 7:
        return this.text().mechanicalResponse;
      case 11:
        return this.text().unknownCause;
      case 15:
        return this.text().aboveNormal;
      default:
        return this.text().unknownMeaning;
    }
  }

  faultSeverity(row: DiagnosticFaultRow): 'danger' | 'secondary' {
    return row.fault.status === 'REMOVED' ? 'secondary' : 'danger';
  }

  time(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.timeZone, true);
  }

  number(value: number | null | undefined): string {
    return formatNumber(value, this.language());
  }

  family(value: DiagnosticReport['family']): string {
    return this.text().families[value];
  }

  faultStatus(value: DiagnosticReport['faults'][number]['status']): string {
    return this.text().faultStatuses[value];
  }

  acknowledgement(value: NonNullable<DiagnosticReport['acknowledgement']>): string {
    return this.text().acknowledgements[value];
  }

  decoding(value: DiagnosticReport['decoding']): string {
    return this.text().decodings[value];
  }
}
