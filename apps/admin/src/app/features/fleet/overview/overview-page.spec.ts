import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AdminFleetOverviewQuery } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { OverviewPage } from './overview-page';
import { UI_LANGUAGE } from '../../../ui/ui-language';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const data: AdminFleetOverviewQuery = {
  fleetOverview: {
    dataAsOf: null,
    businessDate: '2026-10-18',
    activeVehicles: 0,
    movingVehicles: 0,
    notReportingVehicles: 0,
    distanceTodayKm: 0,
    openCriticalAlerts: 0,
    overdueService: 0,
    dailyDistance: [],
    activityByGroup: [],
  },
  critical: { items: [] },
  overdue: { items: [] },
  documents: { items: [] },
  fleetDeviceSummary: { offline: 0 },
  fleetTrips: { items: [] },
};
function operation(request: HttpRequest<unknown>, branchId = branchA): boolean {
  const body: unknown = request.body;
  return (
    request.headers.get('x-branch-id') === branchId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === 'AdminFleetOverview'
  );
}
describe('Live Fleet overview', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<OverviewPage>[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UI_LANGUAGE, useValue: () => 'en' },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'captured-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    http.verify({ ignoreCancelled: true });
  });
  async function mount(branchId = branchA) {
    const fixture = TestBed.createComponent(OverviewPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branchId, name: 'Fleet' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    return fixture;
  }
  it('shows real zero values and an absent clock without sample data', async () => {
    const fixture = await mount();
    const request = http.expectOne((request) => operation(request));
    expect(request.request.headers.get('authorization')).toBe('Bearer captured-token');
    request.flush({ data });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.failure()).toBeNull();
    expect(fixture.componentInstance.kpis()).toEqual({
      moving: 0,
      active: 0,
      distanceTodayKm: 0,
      criticalAlerts: 0,
      overdueService: 0,
      notReporting: 0,
    });
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Overview host.');
    }
    expect(element.textContent).toContain('Nothing needs attention');
    expect(element.textContent).toContain('data as of —');
    expect(fixture.componentInstance.trips()).toEqual([]);
  });
  it('maps real attention links and a bounded daily series without substituting unknown metrics', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request))
      .flush({
        data: {
          ...data,
          fleetOverview: {
            ...data.fleetOverview,
            dataAsOf: '2026-10-18T06:00:00Z',
            distanceTodayKm: 0,
            dailyDistance: [{ date: '2026-10-18', distanceKm: 0 }],
            activityByGroup: [
              {
                group: null,
                total: 1,
                moving: 0,
                idle: 0,
                parked: 0,
                notReporting: 0,
                asset: 0,
                noDevice: 1,
              },
            ],
          },
          critical: {
            items: [
              {
                id: 'alert-id',
                kind: 'CRASH_DETECTED',
                details: null,
                vehicle: { licensePlate: 'AA 001' },
              },
            ],
          },
          overdue: {
            items: [
              {
                id: 'service-id',
                title: 'Oil change',
                serviceType: 'OIL_CHANGE',
                dueOn: '2026-10-17',
                vehicle: { licensePlate: 'AA 001' },
              },
            ],
          },
          fleetDeviceSummary: { offline: 2 },
          fleetTrips: {
            items: [
              {
                id: 'trip-id',
                vehicleId: 'vehicle-id',
                vehicle: { licensePlate: 'AA 001' },
                startedAt: '2026-10-18T06:00:00Z',
                startAddress: null,
                endAddress: null,
                distanceKm: null,
              },
            ],
          },
        },
      });
    await fixture.whenStable();
    expect(fixture.componentInstance.distance()).toEqual([
      expect.objectContaining({ key: '2026-10-18', value: 0, valueText: '0 km' }),
    ]);
    expect(fixture.componentInstance.attention()).toEqual([
      expect.objectContaining({ link: ['/', 'en', branchA, 'fleet', 'alerts', 'alert-id'] }),
      expect.objectContaining({
        link: ['/', 'en', branchA, 'fleet', 'maintenance', 'service-id', 'edit'],
      }),
      expect.objectContaining({
        queryParams: {
          conditions: JSON.stringify([
            { id: 'offline-status', field: 'status', operator: 'isAnyOf', values: ['OFFLINE'] },
          ]),
        },
      }),
    ]);
    expect(fixture.componentInstance.activity()[0]?.label).toBe('Ungrouped');
    expect(fixture.componentInstance.tripLink('trip-id')).toEqual([
      '/',
      'en',
      branchA,
      'fleet',
      'trips',
      'trip-id',
    ]);
    expect(fixture.componentInstance.trips()[0]?.distanceKm).toBeNull();
  });
  it('retains a snapshot after refresh failure and recovers on retry', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request)).flush({ data });
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.data()).toEqual(data);
    expect(fixture.componentInstance.error()).not.toBeNull();
    fixture.componentInstance.refresh();
    await fixture.whenStable();
    http.expectOne((request) => operation(request)).flush({ data });
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBeNull();
  });
  it('cancels a retired read and starts a new Branch client', async () => {
    const a = await mount();
    const pending = http.expectOne((request) => operation(request));
    a.destroy();
    expect(pending.cancelled).toBe(true);
    const b = await mount(branchB);
    http.expectOne((request) => operation(request, branchB)).flush({ data });
    await b.whenStable();
    expect(b.componentInstance.data()).toEqual(data);
  });
});
