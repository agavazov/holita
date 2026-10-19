import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  type DriverScorecard,
  DriverScorecardView,
  maneuverKinds,
  type ScorecardPeriod,
  scorecardPeriods,
} from '../../../app/features/fleet/drivers/driver-scorecard-view';
import { injectPageRecord } from '../../../app/layout/page-record';
import { sampleNow, type SampleDriver } from '../fleet-samples';
import { injectQueryParams, scenarioOf } from '../scenario';
import { SampleDrivers } from '../sample-drivers';

const day = 86_400_000;

/** Synthetic scorecard values follow the API's windows and nullable aggregates. */
function sampleScorecard(
  driver: SampleDriver,
  days: ScorecardPeriod,
  scenario: string,
): DriverScorecard {
  const noData = scenario === 'no-telemetry';
  const empty = noData || scenario === 'empty';
  const lowConfidence = scenario === 'low-confidence';
  const unscored = scenario === 'unscored';
  const zeroScores = scenario === 'zero-scores';
  const scale = days === 7 ? 7 / 30 : days / 30;
  const tripCount = empty ? 0 : lowConfidence ? 3 : Math.floor(driver.trips30d * scale);
  const noScore =
    tripCount === 0 || unscored || (!lowConfidence && !zeroScores && driver.score === null);
  const scoredTripCount = noScore ? 0 : Math.max(0, tripCount - (tripCount > 5 ? 2 : 0));
  const factor = tripCount === 0 ? 0 : lowConfidence ? 1 : days === 7 ? 2 : days === 30 ? 7 : 18;
  const distanceKm = empty ? 0 : lowConfidence ? 218.4 : driver.distance30dKm * scale;
  const maneuvers = maneuverKinds.map((kind, index) => {
    const intensity1 = index % 4 === 3 ? 0 : ((index % 3) + 1) * factor;
    const intensity2 = index % 3 === 0 ? factor : 0;
    const intensity3 = index === 1 ? factor : 0;
    const intensityUnknown = index === 6 ? factor : 0;
    return {
      kind,
      intensity1,
      intensity2,
      intensity3,
      intensityUnknown,
      total: intensity1 + intensity2 + intensity3 + intensityUnknown,
    };
  });
  const maneuverCount = maneuvers.reduce((sum, row) => sum + row.total, 0);
  return {
    name: driver.name,
    employeeNo: driver.employeeNo,
    asOf: noData ? null : new Date(sampleNow).toISOString(),
    windowStart: noData ? null : new Date(sampleNow - days * day).toISOString(),
    windowEnd: noData ? null : new Date(sampleNow).toISOString(),
    distanceKm,
    tripCount,
    scoredTripCount,
    averageDrivingScore: noScore ? null : zeroScores ? 0 : lowConfidence ? 82.4 : driver.score,
    averageEcoScore: noScore
      ? null
      : zeroScores
        ? 0
        : days === 7
          ? 81.3
          : days === 30
            ? 79.8
            : 78.1,
    maneuverCount,
    maneuversPer100Km: distanceKm > 0 ? (maneuverCount / distanceKm) * 100 : null,
    lowConfidence: scoredTripCount < 5,
    maneuvers,
  };
}

/** Story-only host; each selected period replaces all scorecard aggregates together. */
@Component({
  selector: 'holita-example-driver-scorecard-page',
  imports: [DriverScorecardView],
  template: `
    <holita-driver-scorecard-view
      [state]="state()"
      [scorecard]="scorecard()"
      [period]="period()"
      [backLink]="['/examples/drivers']"
      (periodChange)="changePeriod($event)"
      (retry)="failed.set(false)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverScorecardPage {
  private readonly samples = inject(SampleDrivers);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = injectQueryParams();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), [
      'loading',
      'error',
      'empty',
      'no-telemetry',
      'low-confidence',
      'unscored',
      'zero-scores',
    ]),
  );
  private readonly driver = computed(() =>
    this.samples.rows().find((driver) => driver.id === this.params().get('id')),
  );
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  protected readonly period = computed(
    () => scorecardPeriods.find((days) => String(days) === this.query().get('days')) ?? 30,
  );
  protected readonly state = computed(() => {
    if (this.scenario() === 'loading') {
      return 'loading';
    }
    if (this.failed()) {
      return 'error';
    }
    return this.driver() ? 'ready' : 'not-found';
  });
  protected readonly scorecard = computed(() => {
    const driver = this.driver();
    return driver ? sampleScorecard(driver, this.period(), this.scenario()) : null;
  });

  constructor() {
    injectPageRecord(() => this.driver()?.name ?? null);
  }

  protected changePeriod(days: ScorecardPeriod): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { days },
      queryParamsHandling: 'merge',
    });
  }
}
