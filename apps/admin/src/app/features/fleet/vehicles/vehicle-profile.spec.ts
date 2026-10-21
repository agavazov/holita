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
import { MessageService } from 'primeng/api';
import { BehaviorSubject, type Subscription } from 'rxjs';
import type { MockInstance } from 'vitest';
import type {
  AdminVehicleProfileFragment,
  AdminVehicleProfileServiceDetailsFragment,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { VehicleOdometerPage } from './vehicle-odometer-page';
import { VehicleProfileApi } from './vehicle-profile-api';
import { odometerLatestAllowed } from './vehicle-profile-mapping';
import { VehicleProfilePage } from './vehicle-profile-page';

const branch = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const id = '50000000-0000-4000-8000-000000000001';
const at = '2026-10-18T07:00:00.000Z';
const vehicle: AdminVehicleProfileFragment & {
  readonly __typename: 'FleetVehicle';
  readonly nextService: NonNullable<AdminVehicleProfileFragment['nextService']> & {
    readonly __typename: 'FleetServiceTask';
  };
} = {
  __typename: 'FleetVehicle',
  id,
  branchId: branch,
  licensePlate: 'CB 1001 AX',
  notes: null,
  fleetNumber: null,
  vehicleType: null,
  make: null,
  model: null,
  modelYear: null,
  vin: null,
  fuelType: null,
  fuelTankCapacityL: null,
  status: 'ACTIVE',
  groupId: null,
  group: null,
  currentDriverId: null,
  currentDriver: null,
  deviceCount: 1,
  openAlertCount: 27,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: at,
  state: {
    activity: 'PARKED',
    lastReportedAt: at,
    latitude: 0,
    longitude: 0,
    address: null,
    speedKph: 0,
    headingDeg: 0,
    ignition: false,
    fuelLevelPct: 0,
    fuelStatus: 'LOW',
    externalVoltage: 0,
    backupBatteryVoltage: null,
    engineHours: null,
    coolantTempC: null,
    odometerKm: 0,
    odometerRecordedAt: '2026-10-18T06:50:00.000Z',
    odometerSource: 'MANUAL',
  },
  nextService: {
    __typename: 'FleetServiceTask',
    id: '80000000-0000-4000-8000-000000000001',
    branchId: branch,
    vehicleId: id,
    vehicle: { id, licensePlate: 'CB 1001 AX', status: 'ACTIVE' },
    serviceType: 'OIL_CHANGE',
    status: 'PLANNED',
    title: 'Exact next service',
    dueOn: '2026-10-20',
    dueOdometerKm: 100,
    completedOn: null,
    completedOdometerKm: null,
    workshop: null,
    replacedParts: null,
    costCents: null,
    notes: null,
    urgency: 'DUE_SOON',
    remainingDays: 2,
    remainingKm: 100,
    createdAt: at,
    updatedAt: at,
  },
};
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function profile(record = vehicle, asOf: string | null = at) {
  return {
    data: {
      fleetVehicle: record,
      fleetDataClock: {
        __typename: 'FleetDataClock',
        asOf,
        businessDate: '2026-10-18',
        timeZone: 'Europe/Sofia',
      },
      fleetDailyDistance: {
        __typename: 'FleetDailyDistance',
        dataAsOf: asOf,
        points:
          asOf === null
            ? []
            : [{ __typename: 'FleetDailyDistancePoint', date: '2026-10-18', distanceKm: 0 }],
      },
    },
  };
}
function field(name: string): HTMLInputElement {
  const element = document.getElementById('odometer-' + name);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error('Missing odometer input ' + name);
  }
  return element;
}
function submit(): void {
  const form = document.getElementById('odometer-form');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Missing odometer form.');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
function readingResponse() {
  return {
    data: {
      recordFleetOdometerReading: {
        __typename: 'FleetStatusSample',
        id: '81000000-0000-4000-8000-000000000001',
        vehicleId: id,
        source: 'MANUAL',
        odometerKm: 0,
        recordedAt: at,
      },
    },
  };
}

describe('Vehicle profile and odometer routed containers', () => {
  let http: HttpTestingController;
  let navigate: MockInstance<Router['navigate']>;
  const saved = vi.fn<DrawerHost['saved']>();
  const params = new BehaviorSubject(
    convertToParamMap({ recordId: id, branchId: branch, tab: 'overview' }),
  );
  const query = new BehaviorSubject(convertToParamMap({}));
  const fragment = new BehaviorSubject<string | null>(null);
  const fixtures: (ComponentFixture<VehicleProfilePage> | ComponentFixture<VehicleOdometerPage>)[] =
    [];
  const route = {
    paramMap: params.asObservable(),
    queryParamMap: query.asObservable(),
    fragment: fragment.asObservable(),
    snapshot: {
      paramMap: params.value,
      queryParamMap: query.value,
      fragment: null,
      pathFromRoot: [{ paramMap: params.value }],
    },
  };
  const closeLink = ['/', 'en', branch, 'fleet', 'vehicles', id, 'alerts'];
  beforeEach(() => {
    params.next(convertToParamMap({ recordId: id, branchId: branch, tab: 'overview' }));
    query.next(convertToParamMap({}));
    route.snapshot = {
      paramMap: params.value,
      queryParamMap: query.value,
      fragment: null,
      pathFromRoot: [{ paramMap: params.value }],
    };
    saved.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: signal({ closeLink, saved }) },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
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
  function mountProfile() {
    const fixture = TestBed.createComponent(VehicleProfilePage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Branch A' });
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    return fixture;
  }
  function relatedPages(serviceItems: readonly AdminVehicleProfileServiceDetailsFragment[] = []) {
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfileTrips'))
      .flush({
        data: {
          fleetTrips: {
            __typename: 'FleetTripPage',
            items: [],
            total: 0,
            offset: 0,
            limit: 20,
            totalDistanceKm: 0,
          },
        },
      });
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfileAlerts'))
      .flush({
        data: {
          fleetEvents: {
            __typename: 'FleetEventPage',
            items: [],
            total: 0,
            offset: 0,
            limit: 20,
          },
        },
      });
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfileService'))
      .flush({
        data: {
          fleetServiceTasks: {
            __typename: 'FleetServiceTaskPage',
            items: serviceItems,
            total: serviceItems.length,
            offset: 0,
            limit: 20,
          },
        },
      });
  }
  async function readyProfile(
    asOf: string | null = at,
    serviceItems: readonly AdminVehicleProfileServiceDetailsFragment[] = [],
  ) {
    const fixture = mountProfile();
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfile'))
      .flush(profile(vehicle, asOf));
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('ready');
    });
    relatedPages(serviceItems);
    await fixture.whenStable();
    return fixture;
  }
  async function readyOdometer(asOf: string | null = at, record: typeof vehicle = vehicle) {
    const fixture = TestBed.createComponent(VehicleOdometerPage);
    fixtures.push(fixture);
    fixture.detectChanges();
    http
      .expectOne((request) => operation(request, 'AdminVehicleOdometer'))
      .flush(profile(record, asOf));
    await fixture.whenStable();
    return fixture;
  }
  function kpi(fixture: ComponentFixture<VehicleProfilePage>, label: string): string | undefined {
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing profile.');
    }
    return [...element.querySelectorAll('holita-kpi-tile')].find(
      (tile) => tile.querySelector('.kpi-tile__label')?.textContent.trim() === label,
    )?.textContent;
  }

  it('renders exact aggregate KPIs without inferring them from empty related pages', async () => {
    const fixture = await readyProfile();
    expect(kpi(fixture, 'Open alerts')).toContain('27');
    expect(kpi(fixture, 'Next service')).toContain('Exact next service');
    expect(kpi(fixture, 'Distance, 14 days')).toMatch(/0/);
    expect(fixture.componentInstance.vehicle()?.speedKph).toBe(0);
    expect(fixture.componentInstance.vehicle()?.fuelPct).toBe(0);
  });
  it('keeps a bounded Driver return link while profile tab and editor commands remain Vehicle routes', async () => {
    const driverId = '60000000-0000-4000-8000-000000000001';
    query.next(convertToParamMap({ fromDriver: driverId, search: 'not-a-driver-filter' }));
    const fixture = await readyProfile();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing profile.');
    }
    const back = [...element.querySelectorAll('a')].find(
      (link) => link.textContent.trim() === 'Back to driver',
    );
    expect(back?.getAttribute('href')).toBe(`/en/${branch}/fleet/drivers/${driverId}`);
    fixture.componentInstance.changeTab('alerts');
    expect(navigate).toHaveBeenLastCalledWith(
      ['/', 'en', branch, 'fleet', 'vehicles', id, 'alerts'],
      expect.objectContaining({ queryParamsHandling: 'preserve' }),
    );
    query.next(convertToParamMap({ fromDriver: 'invalid' }));
    await fixture.whenStable();
    const fallback = [...element.querySelectorAll('a')].find(
      (link) => link.textContent.trim() === 'Vehicles',
    );
    expect(fallback?.getAttribute('href')).toBe(`/en/${branch}/fleet/vehicles`);
  });
  it('keeps an absent data clock and unknown distance distinct from a measured zero', async () => {
    const fixture = await readyProfile(null);
    expect(fixture.componentInstance.record()?.fleetDataClock.asOf).toBeNull();
    expect(kpi(fixture, 'Distance, 14 days')).toContain('—');
  });
  it('reads independent URL pages and refreshes only the changed table', async () => {
    const fixture = await readyProfile();
    query.next(convertToParamMap({ tripsPage: '2', tripsSize: '100', alertsPage: '1' }));
    const trip = http.expectOne((request) => operation(request, 'AdminVehicleProfileTrips'));
    expect(trip.request.body).toMatchObject({
      variables: { vehicleId: id, offset: 100, limit: 100 },
    });
    http.expectNone((request) => operation(request, 'AdminVehicleProfileAlerts'));
    http.expectNone((request) => operation(request, 'AdminVehicleProfileService'));
    trip.flush({
      data: {
        fleetTrips: {
          __typename: 'FleetTripPage',
          items: [],
          total: 205,
          offset: 100,
          limit: 100,
          totalDistanceKm: 0,
        },
      },
    });
    await fixture.whenStable();
    fixture.componentInstance.changePage('trips', { page: 3, pageSize: 50 });
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { tripsPage: null, tripsSize: 50 } }),
    );
  });
  it('preserves the current profile tab, query and fragment when opening related record drawers', async () => {
    const fixture = await readyProfile();
    params.next(convertToParamMap({ recordId: id, branchId: branch, tab: 'alerts' }));
    expect(fixture.componentInstance.drawerHost().closeLink).toEqual(closeLink);
    fixture.componentInstance.open('edit');
    expect(navigate).toHaveBeenLastCalledWith(
      ['edit'],
      expect.objectContaining({ queryParamsHandling: 'preserve' }),
    );
    fixture.componentInstance.related('trips', 'trip-id');
    expect(navigate).toHaveBeenLastCalledWith(['trips', 'trip-id'], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
    fixture.componentInstance.related('alerts', 'alert-id');
    expect(navigate).toHaveBeenLastCalledWith(['alerts', 'alert-id'], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
    fixture.componentInstance.changeTab('service');
    expect(navigate).toHaveBeenLastCalledWith(
      ['/', 'en', branch, 'fleet', 'vehicles', id, 'service'],
      expect.objectContaining({ preserveFragment: true }),
    );
  });
  it('opens planned service for editing and completed service as a receipt over the retained profile', async () => {
    const planned = vehicle.nextService;
    const receipt: AdminVehicleProfileServiceDetailsFragment = {
      ...planned,
      id: '80000000-0000-4000-8000-000000000002',
      status: 'DONE',
      urgency: null,
      completedOn: '2026-10-17',
    };
    const fixture = await readyProfile(at, [planned, receipt]);
    fixture.componentInstance.related('service', planned.id);
    expect(navigate).toHaveBeenLastCalledWith(['service', planned.id, 'edit'], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
    fixture.componentInstance.related('service', receipt.id);
    expect(navigate).toHaveBeenLastCalledWith(['service', receipt.id], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
    navigate.mockClear();
    fixture.componentInstance.related('service', 'missing-id');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('defers child drawer activation until the scoped parent record supplies a verified vehicle context', async () => {
    const fixture = mountProfile();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing profile.');
    }
    expect(element.querySelector('router-outlet')).toBeNull();
    expect(fixture.componentInstance.drawerHost().vehicleId).toBeUndefined();
    http.expectOne((request) => operation(request, 'AdminVehicleProfile')).flush(profile());
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('ready');
    });
    relatedPages();
    await fixture.whenStable();
    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.componentInstance.drawerHost().vehicleId).toBe(id);
  });
  it('does not issue business reads for malformed record IDs', () => {
    const invalid = convertToParamMap({ recordId: 'invalid', branchId: branch, tab: 'overview' });
    route.snapshot = {
      ...route.snapshot,
      paramMap: invalid,
      pathFromRoot: [{ paramMap: invalid }],
    };
    const fixture = mountProfile();
    expect(fixture.componentInstance.state()).toBe('not-found');
    http.expectNone('/graphql');
  });
  it('distinguishes a scoped missing record from a transport failure', async () => {
    const fixture = mountProfile();
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfile'))
      .flush({ errors: [{ message: 'Not found', extensions: { code: 'NOT_FOUND' } }] });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('not-found');
    });
    http.expectNone((request) => operation(request, 'AdminVehicleProfileTrips'));
  });
  it('retries the actual profile read after a transport failure before loading related records', async () => {
    const fixture = mountProfile();
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfile'))
      .flush('Offline', { status: 503, statusText: 'Unavailable' });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('error');
    });
    http.expectNone((request) => operation(request, 'AdminVehicleProfileTrips'));
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing profile error view.');
    }
    await fixture.whenStable();
    const retry = [...element.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Try again',
    );
    if (!retry) {
      throw new Error('Missing profile Retry.');
    }
    retry.click();
    http.expectOne((request) => operation(request, 'AdminVehicleProfile')).flush(profile());
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('ready');
    });
    relatedPages();
    await fixture.whenStable();
    expect(fixture.componentInstance.vehicle()?.plate).toBe('CB 1001 AX');
  });
  it.each(['inactive', 'empty-interval'] as const)(
    'blocks writes from an unavailable %s direct odometer route',
    async (reason) => {
      const fixture = await readyOdometer(
        at,
        reason === 'inactive'
          ? { ...vehicle, status: 'INACTIVE' }
          : { ...vehicle, state: { ...vehicle.state, odometerRecordedAt: at } },
      );
      expect(field('odometerKm').disabled).toBe(true);
      submit();
      await fixture.componentInstance.save({ odometerKm: 10, recordedAt: at });
      http.expectNone((request) => operation(request, 'AdminRecordOdometer'));
      expect(saved).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    },
  );

  it('records a zero odometer and returns to the hosting profile tab after success', async () => {
    const fixture = await readyOdometer();
    submit();
    const write = http.expectOne((request) => operation(request, 'AdminRecordOdometer'));
    expect(write.request.body).toMatchObject({
      variables: { input: { vehicleId: id, odometerKm: 0, recordedAt: at } },
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      true,
    );
    write.flush(readingResponse());
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(saved).toHaveBeenCalledWith({ recordId: id, message: 'Odometer reading recorded.' });
    });
    expect(navigate).toHaveBeenCalledWith(closeLink, {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  });
  it('focuses a rejected odometer field while keeping the typed draft', async () => {
    const fixture = await readyOdometer();
    const input = field('odometerKm');
    input.value = '15';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    submit();
    http
      .expectOne((request) => operation(request, 'AdminRecordOdometer'))
      .flush({
        errors: [
          {
            message: 'A newer reading exists.',
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [{ path: 'odometerKm', message: 'Use at least 20 km.' }],
            },
          },
        ],
      });
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    expect(input.value).toContain('15');
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      false,
    );
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('lets a submitted reading settle after retirement without notifying or navigating', async () => {
    const fixture = await readyOdometer();
    const completion = fixture.componentInstance.save({ odometerKm: 0, recordedAt: at });
    const write = http.expectOne((request) => operation(request, 'AdminRecordOdometer'));
    fixture.destroy();
    expect(write.cancelled).toBe(false);
    write.flush(readingResponse());
    await completion;
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('shares a single dirty confirmation without losing the reading when cancelled', async () => {
    const fixture = await readyOdometer();
    const input = field('odometerKm');
    input.value = '15';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    const first = Promise.resolve(fixture.componentInstance.canLeave());
    const second = Promise.resolve(fixture.componentInstance.canLeave());
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.p-confirmdialog')).toHaveLength(1);
    });
    const reject = document.querySelector<HTMLButtonElement>('.p-confirmdialog-reject-button');
    if (!reject) {
      throw new Error('Missing discard Cancel.');
    }
    reject.click();
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(input.value).toContain('15');
  });
});

describe('Vehicle profile captured clients', () => {
  let http: HttpTestingController;
  const clients: VehicleProfileApi[] = [];
  const subscriptions: Subscription[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    subscriptions.splice(0).forEach((subscription) => {
      subscription.unsubscribe();
    });
    clients.splice(0).forEach((client) => {
      client.ngOnDestroy();
    });
    http.verify({ ignoreCancelled: true });
  });
  function mount(scope: string, language: Language = 'en') {
    const api = TestBed.runInInjectionContext(() => new VehicleProfileApi());
    api.initialize(scope, language);
    clients.push(api);
    return api;
  }
  it('creates fresh A → B → A profile clients with captured language and session', async () => {
    for (const [scope, plate, language] of [
      [branch, 'A', 'en'],
      [branchB, 'B', 'bg'],
      [branch, 'Next A', 'en'],
    ] as const) {
      const api = mount(scope, language);
      let received: string | null = null;
      const read = api.watchVehicle(id).valueChanges.subscribe((result) => {
        if (result.dataState === 'complete') {
          received = result.data.fleetVehicle.licensePlate;
        }
      });
      subscriptions.push(read);
      const request = http.expectOne((request) => operation(request, 'AdminVehicleProfile'));
      expect(request.request.headers.get('x-branch-id')).toBe(scope);
      expect(request.request.headers.get('Accept-Language')).toBe(language);
      expect(request.request.headers.get('authorization')).toBe('Bearer tenant-a');
      request.flush(profile({ ...vehicle, branchId: scope, licensePlate: plate }));
      await vi.waitFor(() => {
        expect(received).toBe(plate);
      });
      read.unsubscribe();
      api.ngOnDestroy();
    }
  });
  it('settles a retired reading without altering the next scoped client', async () => {
    const old = mount(branch);
    const completion = old.recordOdometer({ vehicleId: id, odometerKm: 0, recordedAt: at });
    const write = http.expectOne((request) => operation(request, 'AdminRecordOdometer'));
    old.ngOnDestroy();
    const current = mount(branchB);
    let plate: string | null = null;
    subscriptions.push(
      current.watchVehicle(id).valueChanges.subscribe((result) => {
        if (result.dataState === 'complete') {
          plate = result.data.fleetVehicle.licensePlate;
        }
      }),
    );
    http
      .expectOne((request) => operation(request, 'AdminVehicleProfile'))
      .flush(profile({ ...vehicle, branchId: branchB, licensePlate: 'B' }));
    await vi.waitFor(() => {
      expect(plate).toBe('B');
    });
    expect(write.cancelled).toBe(false);
    write.flush(readingResponse());
    await expect(completion).resolves.toMatchObject({ odometerKm: 0 });
    expect(plate).toBe('B');
    http.expectNone('/graphql');
  });
});

describe('Odometer clock bounds', () => {
  it('uses now without a Branch clock and otherwise chooses the earlier real instant', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    expect(odometerLatestAllowed(null, now)).toBe('2026-10-20T12:00:00.000Z');
    expect(odometerLatestAllowed(at, now)).toBe(at);
    expect(odometerLatestAllowed('2026-10-21T12:00:00.000Z', now)).toBe('2026-10-20T12:00:00.000Z');
  });
});
