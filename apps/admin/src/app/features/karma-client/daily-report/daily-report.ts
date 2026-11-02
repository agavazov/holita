import type { SourceProvenance } from '../../../ui/source-context/source-types';
import { MAP_PAGE_TYPE, type MapPageType } from '../../../ui/map-preview/map-preview';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import type { Subscription } from 'rxjs';
import type {
  AdminKarmaLocationQuery,
  KarmaDailyReportInput,
} from '../../../../generated/graphql/operations';
import { messages, type Language } from '../../../i18n/messages';
import { DayOverview } from '../../../ui/day-overview/day-overview';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { KarmaHistoryApi } from '../history/karma-history-api';
import { TripDetails } from '../history/trip-details/trip-details';
import { mapCoordinates } from '../../../ui/map-preview/location-map';
import { MapPreview } from '../../../ui/map-preview/map-preview';
import {
  dailyReportMessages,
  dailyReportPresentation,
  type DailyReportResult,
} from './daily-report-presentation';
import { ReportReview } from './report-review';

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

@Component({
  selector: 'holita-daily-report',
  imports: [
    DayOverview,
    RouteDrawer,
    FormField,
    TripDetails,
    MapPreview,
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Message,
    RouterLink,
    ReportReview,
  ],
  providers: [{ provide: MAP_PAGE_TYPE, useValue: 'daily-report' }, KarmaHistoryApi],
  templateUrl: './daily-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyReport implements OnInit {
  readonly mapPageType = input<MapPageType>('daily-report');
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly location = input<AdminKarmaLocationQuery['karmaLocation']>(null);
  readonly locationLoaded = input(false);
  readonly locationError = input(false);
  protected readonly text = computed(() => dailyReportMessages[this.language()]);
  protected readonly appText = computed(() => messages[this.language()]);
  protected readonly report = signal<DailyReportResult | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly invalidDay = signal(false);
  protected readonly baseline = signal<DailyReportResult | null>(null);
  protected readonly comparisonLoading = signal(false);
  protected readonly comparisonError = signal(false);
  protected readonly comparisonInvalid = signal(false);
  protected readonly comparisonForm = new FormGroup({
    day: new FormControl('', { nonNullable: true }),
  });
  protected readonly presentation = computed(() => {
    const report = this.report();
    return report ? dailyReportPresentation(report, this.language()) : null;
  });
  protected readonly unavailable = computed(
    () => this.failed() || this.report()?.state === 'UNAVAILABLE',
  );
  protected readonly form = new FormGroup({ day: new FormControl('', { nonNullable: true }) });
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(KarmaHistoryApi);
  private readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });
  protected readonly selected = computed(() => {
    const fragment = this.fragment();
    return this.report()?.trips.find((trip) => `trip-${trip.id}` === fragment) ?? null;
  });
  protected readonly missingTrip = computed(
    () => !!this.fragment()?.startsWith('trip-') && !!this.report() && !this.selected(),
  );
  protected readonly tripProvenance = computed<SourceProvenance | null>(() => {
    const presentation = this.presentation();
    const trip = this.selected();
    return presentation && trip
      ? { ...presentation.provenance, origin: 'OBSERVED', sourceRecordId: trip.id }
      : null;
  });
  protected readonly lastCoordinates = computed(() =>
    mapCoordinates(this.location()?.latitude, this.location()?.longitude),
  );
  protected readonly diagnosticsLink = computed(() =>
    this.router.createUrlTree([
      '/',
      this.language(),
      'karma-client',
      'cars',
      this.carId(),
      'diagnostics',
    ]),
  );
  private query: ReturnType<KarmaHistoryApi['watchDailyReport']> | undefined;
  private subscription: Subscription | undefined;
  private selection: KarmaDailyReportInput | null = null;
  private primaryKey: string | undefined;
  private comparisonKey: string | undefined;
  private comparisonQuery: ReturnType<KarmaHistoryApi['watchDailyReport']> | undefined;
  private comparisonSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.api.initialize(this.language());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const section: unknown = this.route.snapshot.data['section'];
      if (
        this.route.snapshot.paramMap.get('recordId') !== this.carId() ||
        this.route.parent?.snapshot.paramMap.get('language') !== this.language() ||
        (section && section !== 'daily-report') ||
        this.route.snapshot.data['edata'] === true
      ) {
        return;
      }
      const day = params.get('day');
      const invalid = params.getAll('day').length > 1 || (day !== null && !validDay(day));
      const key = JSON.stringify([this.carId(), day, invalid]);
      if (key !== this.primaryKey) {
        this.primaryKey = key;
        this.invalidDay.set(invalid);
        this.form.controls.day.setValue(day ?? '');
        this.subscription?.unsubscribe();
        this.query = undefined;
        this.report.set(null);
        this.failed.set(false);
        this.loading.set(false);
        this.selection = invalid ? null : { carId: this.carId(), ...(day ? { day } : {}) };
        if (this.selection) {
          this.read();
        }
      }
      this.syncComparison();
    });
    this.destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.comparisonSubscription?.unsubscribe();
    });
  }

  private read(): void {
    if (!this.selection) {
      return;
    }
    this.loading.set(true);
    const query = this.api.watchDailyReport(this.selection);
    this.query = query;
    this.subscription = query.valueChanges.subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.failed.set(!!result.error);
        if (result.error) {
          this.report.set(null);
        }
        if (result.dataState === 'complete' && !result.error) {
          this.report.set(result.data.karmaDailyReport);
          this.form.controls.day.setValue(
            result.data.karmaDailyReport.day ?? this.selection?.day ?? '',
          );
          this.syncComparison();
        }
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
        this.report.set(null);
      },
    });
  }

  protected apply(): void {
    const day = this.form.controls.day.value;
    this.invalidDay.set(!!day && !validDay(day));
    if (this.invalidDay()) {
      return;
    }
    if (day === this.route.snapshot.queryParamMap.get('day')) {
      this.refresh();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { day: day || null, compareDay: null },
    });
  }

  protected yesterday(): void {
    this.form.controls.day.setValue('');
    if (!this.route.snapshot.queryParamMap.has('day')) {
      this.refresh();
      return;
    }
    this.apply();
  }

  refresh(): void {
    this.failed.set(false);
    const query = this.query;
    void query?.refetch().catch(() => {
      if (this.query === query) {
        this.loading.set(false);
        this.failed.set(true);
        this.report.set(null);
      }
    });
  }

  private syncComparison(): void {
    const params = this.route.snapshot.queryParamMap;
    const day = params.get('compareDay');
    const primaryDay = this.report()?.day ?? this.selection?.day;
    const invalid =
      day !== null &&
      (params.getAll('compareDay').length > 1 || !validDay(day) || day === primaryDay);
    this.comparisonInvalid.set(invalid);
    const key = JSON.stringify([this.primaryKey, this.report()?.day, day, invalid]);
    if (key === this.comparisonKey) {
      return;
    }
    this.comparisonKey = key;
    this.comparisonForm.controls.day.setValue(day ?? '');
    this.comparisonSubscription?.unsubscribe();
    this.comparisonQuery = undefined;
    this.baseline.set(null);
    this.comparisonError.set(false);
    this.comparisonLoading.set(false);
    if (!day || invalid || this.invalidDay() || !this.report()?.day) {
      return;
    }
    const query = this.api.watchDailyReport({ carId: this.carId(), day });
    this.comparisonQuery = query;
    this.comparisonLoading.set(true);
    this.comparisonSubscription = query.valueChanges.subscribe({
      next: (result) => {
        this.comparisonLoading.set(result.loading);
        this.comparisonError.set(!!result.error);
        if (result.error) {
          this.baseline.set(null);
        } else if (result.dataState === 'complete') {
          this.baseline.set(result.data.karmaDailyReport);
        }
      },
      error: () => {
        this.comparisonLoading.set(false);
        this.comparisonError.set(true);
        this.baseline.set(null);
      },
    });
  }

  protected compare(): void {
    const day = this.comparisonForm.controls.day.value;
    this.comparisonInvalid.set(!validDay(day) || day === this.report()?.day);
    if (this.comparisonInvalid()) {
      return;
    }
    if (day === this.route.snapshot.queryParamMap.get('compareDay')) {
      this.retryComparison();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { compareDay: day },
      preserveFragment: true,
    });
  }

  protected retryComparison(): void {
    const query = this.comparisonQuery;
    this.comparisonError.set(false);
    void query?.refetch().catch(() => {
      this.comparisonLoading.set(false);
      this.comparisonError.set(true);
      this.baseline.set(null);
    });
  }

  protected openReportTrip(selection: { day: string; id: string }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { day: selection.day, compareDay: null },
      fragment: `trip-${selection.id}`,
    });
  }

  protected openTrip(id: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      fragment: `trip-${id}`,
    });
  }

  protected closeTrip(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }
}
