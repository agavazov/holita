import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import { DevicesApi } from './devices-api';
import { DeviceChoices } from './device-choices';

const branchA = '10000000-0000-4000-8000-000000000001',
  branchB = '10000000-0000-4000-8000-000000000002';
const id = '60000000-0000-4000-8000-000000000001';
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function summary(online: number) {
  return {
    data: {
      fleetDeviceSummary: {
        __typename: 'FleetDeviceSummary',
        dataAsOf: null,
        online,
        offline: 0,
        inStock: 0,
      },
    },
  };
}
describe('Devices captured clients and complete Vehicle choices', () => {
  let http: HttpTestingController;
  const clients: DevicesApi[] = [];
  function mount(branchId: string, language: Language = 'en') {
    const api = TestBed.runInInjectionContext(() => new DevicesApi());
    api.initialize(branchId, language);
    clients.push(api);
    return api;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DevicesApi, DeviceChoices],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    clients.splice(0).forEach((client) => {
      client.ngOnDestroy();
    });
    http.verify({ ignoreCancelled: true });
  });
  it('creates fresh A → B → A clients and reads the whole-Branch summary in each captured scope', async () => {
    const received: number[] = [];
    for (const [branchId, online, language] of [
      [branchA, 2, 'en'],
      [branchB, 8, 'bg'],
      [branchA, 3, 'en'],
    ] as const) {
      const api = mount(branchId, language);
      const read = api.watchSummary().valueChanges.subscribe((result) => {
        if (result.dataState === 'complete') {
          received.push(result.data.fleetDeviceSummary.online);
        }
      });
      const request = http.expectOne((request) => operation(request, 'AdminDeviceSummary'));
      expect(request.request.headers.get('x-branch-id')).toBe(branchId);
      expect(request.request.headers.get('authorization')).toBe('Bearer tenant-a');
      expect(request.request.headers.get('Accept-Language')).toBe(language);
      request.flush(summary(online));
      await vi.waitFor(() => {
        expect(received.at(-1)).toBe(online);
      });
      read.unsubscribe();
      api.ngOnDestroy();
    }
    expect(received).toEqual([2, 8, 3]);
  });
  it('settles one submitted batch after retirement without cancelling it or changing the new client', async () => {
    const a = mount(branchA);
    const completion = a.deleteMany([id]);
    const write = http.expectOne((request) => operation(request, 'AdminDeleteDevices'));
    expect(write.request.body).toMatchObject({ variables: { ids: [id] } });
    a.ngOnDestroy();
    expect(write.cancelled).toBe(false);
    const b = mount(branchB);
    let current = -1;
    const read = b.watchSummary().valueChanges.subscribe((result) => {
      if (result.dataState === 'complete') {
        current = result.data.fleetDeviceSummary.online;
      }
    });
    http.expectOne((request) => operation(request, 'AdminDeviceSummary')).flush(summary(7));
    write.flush({
      data: {
        deleteFleetDevices: {
          __typename: 'FleetDeviceActionResult',
          succeededIds: [id],
          failures: [],
        },
      },
    });
    await expect(completion).resolves.toMatchObject({ succeededIds: [id] });
    expect(write.request.headers.get('x-branch-id')).toBe(branchA);
    expect(current).toBe(7);
    http.expectNone((request) => operation(request, 'AdminDeviceSummary'));
    read.unsubscribe();
  });
  it('loads all Vehicle pages rather than silently limiting choices to 100', async () => {
    const api = TestBed.inject(DevicesApi);
    api.initialize(branchA, 'en');
    const choices = TestBed.inject(DeviceChoices);
    choices.load();
    const first = http.expectOne((request) => operation(request, 'AdminDeviceVehicles'));
    expect(first.request.body).toMatchObject({ variables: { offset: 0, limit: 100 } });
    first.flush({
      data: {
        fleetVehicles: {
          __typename: 'FleetVehiclePage',
          items: Array.from({ length: 100 }, (_, index) => ({
            __typename: 'FleetVehicle',
            id: '20000000-0000-4000-8000-' + String(index).padStart(12, '0'),
            licensePlate: 'TRUCK ' + String(index),
          })),
          total: 101,
          offset: 0,
          limit: 100,
        },
      },
    });
    const second = await vi.waitFor(() =>
      http.expectOne((request) => operation(request, 'AdminDeviceVehicles')),
    );
    expect(second.request.body).toMatchObject({ variables: { offset: 100, limit: 100 } });
    second.flush({
      data: {
        fleetVehicles: {
          __typename: 'FleetVehiclePage',
          items: [{ __typename: 'FleetVehicle', id, licensePlate: 'LAST TRUCK' }],
          total: 101,
          offset: 100,
          limit: 100,
        },
      },
    });
    await vi.waitFor(() => {
      expect(choices.vehicles()).toHaveLength(101);
    });
    expect(choices.vehicles().at(-1)).toEqual({ id, name: 'LAST TRUCK' });
    expect(choices.loading()).toBe(false);
  });
});
