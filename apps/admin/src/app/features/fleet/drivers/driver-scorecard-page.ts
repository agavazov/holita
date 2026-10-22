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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
} from 'rxjs';
import type { AdminBranchesQuery } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import { errorCode } from '../../../ui/forms/field-errors';
import { driverScorecard } from './driver-mapping';
import {
  DriverScorecardView,
  scorecardPeriods,
  type DriverScorecard,
  type DriverScorecardState,
  type ScorecardPeriod,
} from './driver-scorecard-view';
import { DriversApi } from './drivers-api';
import { driversText } from './i18n/messages';

function scorecardPeriod(value: string | null): ScorecardPeriod {
  return scorecardPeriods.find((days) => String(days) === value) ?? 30;
}

@Component({
  selector: 'holita-driver-scorecard-page',
  imports: [DriverScorecardView],
  providers: [DriversApi],
  template: `
    <holita-driver-scorecard-view
      [state]="state()"
      [scorecard]="scorecard()"
      [period]="period()"
      [backLink]="backLink()"
      [backQueryParams]="backQueryParams()"
      [backFragment]="backFragment()"
      [errorText]="failure()"
      (periodChange)="changePeriod($event)"
      (retry)="retry.next()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverScorecardPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(DriversApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly backFragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });
  protected readonly backLink = computed(() => [
    '/',
    this.language(),
    this.branch().id,
    'fleet',
    'drivers',
  ]);
  protected readonly backQueryParams = computed(() =>
    Object.fromEntries(
      this.params()
        .keys.filter((key) => key !== 'days')
        .map((key) => {
          const values = this.params().getAll(key);
          return [key, values.length === 1 ? (values[0] ?? '') : values];
        }),
    ),
  );
  readonly state = signal<DriverScorecardState>('loading');
  readonly scorecard = signal<DriverScorecard | null>(null);
  readonly period = signal<ScorecardPeriod>(30);
  readonly error = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  protected readonly failure = computed(() =>
    requestError(this.error(), driversText(this.language()).scorecard.errorDescription),
  );

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    const driverId = drawerParam(this.route, 'recordId');
    if (
      !driverId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(driverId)
    ) {
      this.state.set('not-found');
      return;
    }
    const periods = this.route.queryParamMap.pipe(
      map((params) => scorecardPeriod(params.get('days'))),
      distinctUntilChanged(),
    );
    combineLatest([periods, this.retry.pipe(startWith(undefined))])
      .pipe(
        switchMap(([days]) => {
          this.period.set(days);
          this.scorecard.set(null);
          this.error.set(null);
          this.state.set('loading');
          return this.api.watchScorecard({ driverId, days }).valueChanges.pipe(
            catchError((error: unknown) => {
              this.fail(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.fail(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          this.scorecard.set(driverScorecard(result.data.fleetDriverScorecard));
          this.state.set('ready');
        }
      });
  }

  changePeriod(days: ScorecardPeriod): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { days },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  private fail(error: unknown): void {
    this.error.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
}
