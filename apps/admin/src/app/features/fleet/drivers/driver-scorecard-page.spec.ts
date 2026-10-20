import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AdminDriverScorecardQuery } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DriverScorecardPage, scorecardPeriod } from './driver-scorecard-page';

const branch = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
const path = `/en/${branch}/fleet/drivers/${id}/scorecard`;
@Component({
  imports: [DriverScorecardPage],
  template: '<holita-driver-scorecard-page [branch]="branch" language="en" />',
})
class ScorecardHost {
  readonly branch = { id: branch, name: 'Test fleet' };
}
function card(score: number | null = null): AdminDriverScorecardQuery['fleetDriverScorecard'] {
  return {
    driver: { id, firstName: 'Elena', lastName: 'Petrova', employeeNumber: null },
    asOf: '2026-10-18T07:00:00.000Z',
    windowStart: '2026-09-18T07:00:00.000Z',
    windowEnd: '2026-10-18T07:00:00.000Z',
    distanceKm: 0,
    tripCount: 0,
    scoredTripCount: 0,
    averageDrivingScore: score,
    averageEcoScore: null,
    maneuverCount: 0,
    maneuversPer100Km: null,
    lowConfidence: true,
    maneuvers: [],
  };
}
function operation(request: HttpRequest<unknown>): boolean {
  const body: unknown = request.body;
  return (
    request.headers.get('x-branch-id') === branch &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === 'AdminDriverScorecard'
  );
}

describe('Driver scorecard routed adapter', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness | undefined;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'en/:branchId/fleet/drivers/:recordId/scorecard', component: ScorecardHost },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'scorecard-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    harness?.fixture.destroy();
    harness = undefined;
    http.verify({ ignoreCancelled: true });
  });

  it('requests only supported periods and retains list query context and fragment in Back', async () => {
    expect([null, '7', '30', '90', '93', 'invalid'].map(scorecardPeriod)).toEqual([
      30, 7, 30, 90, 30, 30,
    ]);
    harness = await RouterTestingHarness.create(
      `${path}?days=30&search=Elena&page=4&keep=drivers#drivers`,
    );
    const first = http.expectOne(operation);
    expect(first.request.body).toMatchObject({ variables: { driverId: id, days: 30 } });
    first.flush({ data: { fleetDriverScorecard: card(0) } });
    await harness.fixture.whenStable();
    const back =
      harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a.page-header__back');
    expect(back?.getAttribute('href')).toContain('search=Elena');
    expect(back?.getAttribute('href')).toContain('page=4');
    expect(back?.getAttribute('href')).toContain('keep=drivers');
    expect(back?.getAttribute('href')).toContain('#drivers');
    expect(back?.getAttribute('href')).not.toContain('days=');
    for (const days of [7, 90]) {
      await TestBed.inject(Router).navigate([], {
        queryParams: { days },
        queryParamsHandling: 'merge',
        preserveFragment: true,
      });
      const next = http.expectOne(operation);
      expect(next.request.body).toMatchObject({ variables: { driverId: id, days } });
      next.flush({ data: { fleetDriverScorecard: card(81.5) } });
      await harness.fixture.whenStable();
      const button = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
        (button) => button.textContent.trim() === `${String(days)} days`,
      );
      expect(button?.getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('shows missing scoped drivers and retries a failed scorecard query', async () => {
    harness = await RouterTestingHarness.create(`${path}?days=7`);
    http.expectOne(operation).flush({
      errors: [
        { message: 'Scorecard unavailable', extensions: { requestId: 'scorecard-failure' } },
      ],
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('scorecard-failure');
    const retry = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent.trim() === 'Try again',
    );
    if (!retry) {
      throw new Error('Missing scorecard retry.');
    }
    retry.click();
    await harness.fixture.whenStable();
    http
      .expectOne(operation)
      .flush({ errors: [{ message: 'Driver not found', extensions: { code: 'NOT_FOUND' } }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Driver not found');
  });
});
