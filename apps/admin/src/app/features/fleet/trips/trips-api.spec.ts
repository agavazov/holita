import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { filter, firstValueFrom } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { TripsApi } from './trips-api';
const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const id = '70000000-0000-4000-8000-000000000001';
const trip = {
  __typename: 'FleetTrip',
  id,
  branchId: branchA,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: { id: '20000000-0000-4000-8000-000000000001', licensePlate: 'CB 1001 AX' },
  driverId: null,
  driver: null,
  startedAt: '2026-10-18T05:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  startAddress: null,
  endAddress: null,
  distanceKm: null,
  maxSpeedKph: null,
  fuelUsedL: null,
  drivingScore: null,
  inProgress: false,
  drivingEvents: [
    {
      id: 'event',
      occurredAt: '2026-10-18T05:10:00.000Z',
      kind: 'HARSH_BRAKING',
      severity: 'WARNING',
      details: 'Actual event.',
    },
  ],
};
function operation(request: HttpRequest<unknown>, name: string, branchId = branchA): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branchId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
describe('TripsApi scope and real timeline reads', () => {
  let http: HttpTestingController;
  const clients: TripsApi[] = [];
  function mount(branch = branchA) {
    const api = TestBed.runInInjectionContext(() => new TripsApi());
    api.initialize(branch, 'bg');
    clients.push(api);
    return api;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    clients.splice(0).forEach((api) => {
      api.ngOnDestroy();
    });
    http.verify({ ignoreCancelled: true });
  });
  it('isolates identical trip IDs and preserves the full returned timeline', async () => {
    const a = mount();
    const b = mount(branchB);
    const first = firstValueFrom(
      a.watchTrip(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    const other = firstValueFrom(
      b.watchTrip(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    const request = http.expectOne((request) => operation(request, 'AdminTrip'));
    expect(request.request.headers.get('Accept-Language')).toBe('bg');
    request.flush({ data: { fleetTrip: trip } });
    http
      .expectOne((request) => operation(request, 'AdminTrip', branchB))
      .flush({ data: { fleetTrip: { ...trip, branchId: branchB, drivingEvents: [] } } });
    expect((await first).data?.fleetTrip?.drivingEvents).toEqual(trip.drivingEvents);
    expect((await other).data?.fleetTrip?.drivingEvents).toEqual([]);
  });
  it('always reads details from the network instead of reusing an earlier drawer record', async () => {
    const api = mount();
    const first = firstValueFrom(
      api.watchTrip(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    http
      .expectOne((request) => operation(request, 'AdminTrip'))
      .flush({ data: { fleetTrip: trip } });
    await first;
    const next = firstValueFrom(
      api.watchTrip(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    http
      .expectOne((request) => operation(request, 'AdminTrip'))
      .flush({ data: { fleetTrip: { ...trip, inProgress: true } } });
    expect((await next).data?.fleetTrip?.inProgress).toBe(true);
  });
  it('cancels retired reads and refuses further reads from that scope', () => {
    const api = mount();
    const subscription = api.watchTrip(id).valueChanges.subscribe();
    const request = http.expectOne((request) => operation(request, 'AdminTrip'));
    subscription.unsubscribe();
    api.ngOnDestroy();
    expect(request.cancelled).toBe(true);
    expect(() => api.watchTrip(id)).toThrow('active Trips');
  });
});
