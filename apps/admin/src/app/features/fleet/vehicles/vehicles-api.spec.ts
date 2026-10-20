import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import type { Subscription } from 'rxjs';
import type {
  AdminVehicleDetailsFragment,
  AdminVehiclesQuery,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { requestError } from '../../../core/graphql/request-error';
import { VehiclesApi } from './vehicles-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const vehicleId = '20000000-0000-4000-8000-000000000001';

function record(
  branchId = branchA,
  licensePlate = 'CA1234AB',
): AdminVehicleDetailsFragment & { readonly __typename: 'FleetVehicle' } {
  return {
    __typename: 'FleetVehicle',
    id: vehicleId,
    branchId,
    licensePlate,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    deviceCount: 0,
    openAlertCount: 0,
    state: {
      activity: 'NO_DEVICE',
      lastReportedAt: null,
      latitude: null,
      longitude: null,
      address: null,
      speedKph: null,
      headingDeg: null,
      ignition: null,
      fuelLevelPct: null,
      fuelStatus: 'NO_DATA',
      externalVoltage: null,
      backupBatteryVoltage: null,
      engineHours: null,
      coolantTempC: null,
      odometerKm: null,
      odometerRecordedAt: null,
      odometerSource: null,
    },
  };
}

function list(vehicle = record()) {
  return {
    data: {
      fleetVehicles: {
        __typename: 'FleetVehiclePage',
        items: [vehicle],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}

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

describe('Vehicles Apollo scope', () => {
  let http: HttpTestingController;
  const clients: VehiclesApi[] = [];
  const subscriptions: Subscription[] = [];

  function mount(branchId = branchA): VehiclesApi {
    const api = TestBed.runInInjectionContext(() => new VehiclesApi());
    api.initialize(branchId, 'en');
    clients.push(api);
    return api;
  }

  function watch(api: VehiclesApi) {
    const query = api.watch({ offset: 0, limit: 20 });
    const page = signal<AdminVehiclesQuery['fleetVehicles'] | null>(null);
    const error = signal<unknown>(null);
    subscriptions.push(
      query.valueChanges.subscribe((result) => {
        error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          page.set(result.data.fleetVehicles);
        }
      }),
    );
    return { query, page, error };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a-token',
      tenant: {
        id: '01000000-0000-4000-8000-000000000001',
        name: 'Tenant A',
      },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const subscription of subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
    for (const api of clients.splice(0)) {
      api.ngOnDestroy();
    }
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('separates identical concurrent queries, entity caches and transport headers', async () => {
    const a = watch(mount(branchA));
    const b = watch(mount(branchB));
    const readA = http.expectOne((request) => operation(request, 'AdminVehicles', branchA));
    const readB = http.expectOne((request) => operation(request, 'AdminVehicles', branchB));
    expect(readA.request.headers.get('x-request-id')).not.toBe(
      readB.request.headers.get('x-request-id'),
    );
    expect(readB.request.headers.get('Accept-Language')).toBe('en');
    readB.flush(list(record(branchB, 'PB1234AB')));
    readA.flush(list());
    await vi.waitFor(() => {
      expect(a.page()?.items[0]?.branchId).toBe(branchA);
    });
    expect(b.page()?.items[0]?.branchId).toBe(branchB);
    expect(a.page()?.items[0]?.licensePlate).toBe('CA1234AB');
    expect(b.page()?.items[0]?.licensePlate).toBe('PB1234AB');
  });

  it('cancels obsolete reads when their workspace is disposed', async () => {
    const api = mount();
    const subscription = api.watch({ offset: 0, limit: 20 }).valueChanges.subscribe();
    const read = http.expectOne((request) => operation(request, 'AdminVehicles'));
    subscription.unsubscribe();
    api.ngOnDestroy();
    await vi.waitFor(() => {
      expect(read.cancelled).toBe(true);
    });
    expect(() => api.watch({ offset: 0, limit: 20 })).toThrow('active Vehicles workspace');
  });

  it('fetches editor records from the network even when the entity is in the list cache', () => {
    const api = mount();
    watch(api);
    http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list());
    const first = api.watchVehicle(vehicleId).valueChanges.subscribe();
    const firstRead = http.expectOne((request) => operation(request, 'AdminVehicle'));
    firstRead.flush({ data: { fleetVehicle: record() } });
    first.unsubscribe();
    const second = api.watchVehicle(vehicleId).valueChanges.subscribe();
    const secondRead = http.expectOne((request) => operation(request, 'AdminVehicle'));
    expect(secondRead.request.headers.get('x-request-id')).not.toBe(
      firstRead.request.headers.get('x-request-id'),
    );
    secondRead.flush({ data: { fleetVehicle: record() } });
    second.unsubscribe();
  });

  it('keeps a captured update alive after A retires without invalidating B or a fresh A', async () => {
    const oldApi = mount();
    const a = watch(oldApi);
    http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list());
    const mutation = oldApi.update({ id: vehicleId, input: { licensePlate: 'Late A' } });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    for (const subscription of subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
    oldApi.ngOnDestroy();
    const b = watch(mount(branchB));
    http
      .expectOne((request) => operation(request, 'AdminVehicles', branchB))
      .flush(list(record(branchB, 'B')));
    const newA = watch(mount());
    http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list());
    expect(write.cancelled).toBe(false);
    write.flush({ data: { updateFleetVehicle: record(branchA, 'Late A') } });
    expect((await mutation).licensePlate).toBe('Late A');
    expect(a.page()?.items[0]?.licensePlate).toBe('CA1234AB');
    expect(b.page()?.items[0]?.licensePlate).toBe('B');
    expect(newA.page()?.items[0]?.licensePlate).toBe('CA1234AB');
    http.expectNone('/graphql');
    await expect(oldApi.update({ id: vehicleId, input: { notes: 'Obsolete' } })).rejects.toThrow(
      'active Vehicles workspace',
    );
  });

  it('releases a retired client after a failed update and keeps other scopes unchanged', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const api = mount();
    const mutation = api.update({ id: vehicleId, input: { licensePlate: '' } });
    const rejection = expect(mutation).rejects.toThrow('Invalid license plate');
    const write = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    api.ngOnDestroy();
    expect(stop).not.toHaveBeenCalled();
    const b = watch(mount(branchB));
    http
      .expectOne((request) => operation(request, 'AdminVehicles', branchB))
      .flush(list(record(branchB)));
    write.flush({
      errors: [{ message: 'Invalid license plate', extensions: { code: 'BAD_USER_INPUT' } }],
    });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(b.error()).toBeNull();
    expect(b.page()?.items[0]?.branchId).toBe(branchB);
    http.expectNone('/graphql');
  });

  it('surfaces a refresh error with its request ID and recovers through the same query', async () => {
    const current = watch(mount());
    http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list());
    const refresh = current.query.refetch();
    const rejection = expect(refresh).rejects.toThrow('Vehicles unavailable');
    const failed = http.expectOne((request) => operation(request, 'AdminVehicles'));
    failed.flush({
      errors: [{ message: 'Vehicles unavailable', extensions: { requestId: 'refresh-id' } }],
    });
    await rejection;
    expect(requestError(current.error(), 'Network failure')).toContain('refresh-id');
    const retry = current.query.refetch();
    const next = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(next.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    next.flush(list(record(branchA, 'Recovered')));
    await retry;
    expect(current.error()).toBeNull();
    expect(current.page()?.items[0]?.licensePlate).toBe('Recovered');
  });

  it('stops a retired client only after every submitted write settles', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const api = mount();
    const first = api.update({ id: vehicleId, input: { notes: 'First' } });
    const firstWrite = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    const second = api.update({ id: vehicleId, input: { notes: 'Second' } });
    const rejection = expect(second).rejects.toThrow('Second failed');
    const secondWrite = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    api.ngOnDestroy();
    expect(stop).not.toHaveBeenCalled();
    firstWrite.flush({ data: { updateFleetVehicle: record() } });
    await first;
    expect(stop).not.toHaveBeenCalled();
    secondWrite.flush({ errors: [{ message: 'Second failed' }] });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
