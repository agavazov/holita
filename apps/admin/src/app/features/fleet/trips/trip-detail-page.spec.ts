import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  ROUTER_OUTLET_DATA,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { DemoSession } from '../../../core/auth/demo-session';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { TripDetailPage } from './trip-detail-page';
const branch = '10000000-0000-4000-8000-000000000001';
const id = '70000000-0000-4000-8000-000000000001';
const trip = {
  __typename: 'FleetTrip',
  id,
  branchId: branch,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: { id: '20000000-0000-4000-8000-000000000001', licensePlate: 'CB 1001 AX' },
  driverId: null,
  driver: null,
  startedAt: '2026-10-18T05:00:00.000Z',
  endedAt: '2026-10-18T06:00:00.000Z',
  durationSeconds: 3600,
  startAddress: 'Sofia',
  endAddress: 'Plovdiv',
  distanceKm: 150,
  maxSpeedKph: 90,
  fuelUsedL: 30,
  drivingScore: 80,
  inProgress: false,
  drivingEvents: [
    {
      id: 'event',
      occurredAt: '2026-10-18T05:10:00.000Z',
      kind: 'HARSH_BRAKING',
      severity: 'WARNING',
      details: 'Actual trip event.',
    },
  ],
};
function snapshot(recordId = id) {
  const current = {
    data: { drawer: true, mode: 'view', recordParam: 'recordId' },
    paramMap: convertToParamMap({ recordId, branchId: branch }),
  };
  return { ...current, pathFromRoot: [current] };
}
function operation(request: HttpRequest<unknown>): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branch &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === 'AdminTrip'
  );
}
function dialog(): HTMLElement {
  const element = Array.from(document.querySelectorAll<HTMLElement>('.p-drawer[role="dialog"]')).at(
    -1,
  );
  if (!element) {
    throw new Error('Missing trip drawer.');
  }
  return element;
}
describe('Live Trip detail reads', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<TripDetailPage>[] = [];
  const route = { snapshot: snapshot() };
  const navigate = vi.fn<Router['navigate']>();
  const outletHost = signal<DrawerHost>({ saved: () => undefined });
  async function mount(recordId = id) {
    route.snapshot = snapshot(recordId);
    const fixture = TestBed.createComponent(TripDetailPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    return fixture;
  }
  beforeEach(() => {
    outletHost.set({ saved: () => undefined });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: outletHost },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
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
    document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
      element.remove();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  it('shows the actual timeline and closes through the absolute parent route', async () => {
    const fixture = await mount();
    expect(fixture.componentInstance.state()).toBe('loading');
    http.expectOne(operation).flush({ data: { fleetTrip: trip } });
    await fixture.whenStable();
    expect(fixture.componentInstance.trip()?.events).toHaveLength(1);
    expect(dialog().textContent).toContain('Actual trip event.');
    expect(dialog().textContent).toContain('Harsh braking');
    const close = Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent.trim() === 'Close',
    );
    if (!close) {
      throw new Error('Missing Close action.');
    }
    close.click();
    expect(navigate).toHaveBeenCalledWith(
      ['/', 'en', branch, 'fleet', 'trips'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });
  it('returns to the owning vehicle profile tab when closing or opening its vehicle', async () => {
    const closeLink = ['/', 'en', branch, 'fleet', 'vehicles', trip.vehicleId, 'trips'];
    outletHost.set({ saved: () => undefined, vehicleId: trip.vehicleId, closeLink });
    const fixture = await mount();
    http.expectOne(operation).flush({ data: { fleetTrip: trip } });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('ready');
    fixture.componentInstance.openVehicle(trip.vehicleId);
    expect(navigate).toHaveBeenCalledWith(
      closeLink,
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    navigate.mockClear();
    const close = Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent.trim() === 'Close',
    );
    if (!close) {
      throw new Error('Missing Close action.');
    }
    close.click();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      closeLink,
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
  });
  it('does not display a trip belonging to another vehicle over the profile', async () => {
    outletHost.set({
      saved: () => undefined,
      vehicleId: '20000000-0000-4000-8000-000000000002',
    });
    const fixture = await mount();
    http.expectOne(operation).flush({ data: { fleetTrip: trip } });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('not-found');
    expect(fixture.componentInstance.record()).toBeNull();
    expect(fixture.componentInstance.trip()).toBeNull();
    expect(dialog().textContent).not.toContain('Actual trip event.');
    expect(dialog().textContent).not.toContain('CB 1001 AX');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('rejects a malformed trip ID before any request', async () => {
    const fixture = await mount('invalid');
    expect(fixture.componentInstance.state()).toBe('invalid-id');
    http.expectNone('/graphql');
  });
  it('distinguishes a missing trip from a retryable network failure', async () => {
    const fixture = await mount();
    http.expectOne(operation).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('error');
    const retry = Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent.trim() === 'Retry',
    );
    if (!retry) {
      throw new Error('Missing Retry action.');
    }
    retry.click();
    http
      .expectOne(operation)
      .flush({ errors: [{ message: 'Trip not found', extensions: { code: 'NOT_FOUND' } }] });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('not-found');
    expect(fixture.componentInstance.trip()).toBeNull();
  });
});
