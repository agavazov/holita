import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { TripsPage } from './trips-page';
const branch = '10000000-0000-4000-8000-000000000001';
const trip = {
  __typename: 'FleetTrip',
  id: '70000000-0000-4000-8000-000000000001',
  branchId: branch,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: { id: '20000000-0000-4000-8000-000000000001', licensePlate: 'CB 1001 AX' },
  driverId: null,
  driver: null,
  startedAt: '2026-10-18T05:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  startAddress: null,
  endAddress: null,
  distanceKm: 12.5,
  maxSpeedKph: null,
  fuelUsedL: null,
  drivingScore: null,
  inProgress: false,
  drivingEvents: [],
};
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branch &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
describe('Live Trips list and independent Branch summary', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<TripsPage>[] = [];
  const params = new BehaviorSubject(convertToParamMap({}));
  const route = { queryParamMap: params, snapshot: { queryParamMap: convertToParamMap({}) } };
  const navigate = vi.fn<Router['navigate']>();
  function summary() {
    http
      .expectOne((request) => operation(request, 'AdminTripSummary'))
      .flush({
        data: {
          fleetTripSummary: {
            totalTrips: 8,
            distanceKm: 120,
            totalDurationSeconds: 90,
            averageDrivingScore: 50.25,
            totalManeuverEvents: 3,
          },
        },
      });
  }
  function list() {
    return {
      data: {
        fleetTrips: { items: [trip], total: 1, offset: 0, limit: 20, totalDistanceKm: 12.5 },
      },
    };
  }
  async function mount() {
    const fixture = TestBed.createComponent(TripsPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Fleet' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminTripVehicles'))
      .flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 100 } } });
    http
      .expectOne((request) => operation(request, 'AdminTripDrivers'))
      .flush({ data: { fleetDrivers: { items: [], total: 0, offset: 0, limit: 100 } } });
    summary();
    return fixture;
  }
  beforeEach(() => {
    params.next(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    TestBed.overrideComponent(TripsPage, { set: { template: '' } });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate.mockReset().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  it('keeps filtered list distance separate from the whole-Branch summary', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminTrips')).flush(list());
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.totalDistanceKm).toBe(12.5);
    expect(fixture.componentInstance.summary()?.distanceKm).toBe(120);
    expect(fixture.componentInstance.summary()?.averageDrivingScore).toBe(50.25);
  });
  it('loads all bounded vehicle and historical driver option pages', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Fleet' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    summary();
    http.expectOne((request) => operation(request, 'AdminTrips')).flush(list());
    const vehicles = Array.from({ length: 100 }, (_, index) => ({
      id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      licensePlate: `Plate ${String(index)}`,
    }));
    const drivers = Array.from({ length: 100 }, (_, index) => ({
      id: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      firstName: 'Driver',
      lastName: String(index),
    }));
    http
      .expectOne((request) => operation(request, 'AdminTripVehicles'))
      .flush({ data: { fleetVehicles: { items: vehicles, total: 101, offset: 0, limit: 100 } } });
    http
      .expectOne((request) => operation(request, 'AdminTripDrivers'))
      .flush({ data: { fleetDrivers: { items: drivers, total: 101, offset: 0, limit: 100 } } });
    await fixture.whenStable();
    const vehiclePage = http.expectOne((request) => operation(request, 'AdminTripVehicles'));
    expect(vehiclePage.request.body).toMatchObject({ variables: { offset: 100, limit: 100 } });
    vehiclePage.flush({
      data: {
        fleetVehicles: {
          items: [{ id: '20000000-0000-4000-8000-000000000101', licensePlate: 'Last plate' }],
          total: 101,
          offset: 100,
          limit: 100,
        },
      },
    });
    const driverPage = http.expectOne((request) => operation(request, 'AdminTripDrivers'));
    expect(driverPage.request.body).toMatchObject({ variables: { offset: 100, limit: 100 } });
    driverPage.flush({
      data: {
        fleetDrivers: {
          items: [
            { id: '40000000-0000-4000-8000-000000000101', firstName: 'Last', lastName: 'Driver' },
          ],
          total: 101,
          offset: 100,
          limit: 100,
        },
      },
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.choices.vehicles()).toHaveLength(101);
    expect(fixture.componentInstance.choices.drivers()).toHaveLength(101);
  });
  it('retains the last successful rows and filtered total on a same-query refresh error', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminTrips')).flush(list());
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    http
      .expectOne((request) => operation(request, 'AdminTrips'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    summary();
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.items).toHaveLength(1);
    expect(fixture.componentInstance.page()?.totalDistanceKm).toBe(12.5);
    expect(fixture.componentInstance.error()).not.toBeNull();
  });
  it('retires old reads when a real duration sort and range filter are applied', async () => {
    const fixture = await mount();
    const old = http.expectOne((request) => operation(request, 'AdminTrips'));
    params.next(
      convertToParamMap({
        sort: 'duration',
        order: 'desc',
        conditions: JSON.stringify([
          { id: 'range', field: 'distance', operator: 'between', values: ['0', '5000'] },
        ]),
      }),
    );
    expect(old.cancelled).toBe(true);
    const current = http.expectOne((request) => operation(request, 'AdminTrips'));
    expect(current.request.body).toMatchObject({
      variables: {
        sort: { field: 'DURATION_SECONDS', direction: 'DESC' },
        filter: { allOf: [{ distanceKmFrom: 0, distanceKmTo: 5000 }] },
      },
    });
    current.flush(list());
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.items).toHaveLength(1);
    http.expectNone('/graphql');
  });
});
