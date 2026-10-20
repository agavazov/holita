import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { firstValueFrom, filter } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { VehicleGroupsApi } from './vehicle-groups-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const groupId = '30000000-0000-4000-8000-000000000001';
const group = {
  __typename: 'FleetVehicleGroup',
  id: groupId,
  branchId: branchA,
  name: 'Regional',
  description: null,
  colorToken: 'C1',
  vehicleCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('VehicleGroupsApi captured clients', () => {
  let http: HttpTestingController;
  const clients: VehicleGroupsApi[] = [];
  function mount(branchId = branchA) {
    const api = TestBed.runInInjectionContext(() => new VehicleGroupsApi());
    api.initialize(branchId, 'bg');
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
    vi.restoreAllMocks();
  });

  it('isolates simultaneous Branch reads and performs detail reads over the network', async () => {
    const a = mount();
    const b = mount(branchB);
    const readA = firstValueFrom(
      a.watchGroup(groupId).valueChanges.pipe(filter((result) => !result.loading)),
    );
    const readB = firstValueFrom(
      b.watchGroup(groupId).valueChanges.pipe(filter((result) => !result.loading)),
    );
    const requestA = http.expectOne((request) => operation(request, 'AdminVehicleGroup'));
    const requestB = http.expectOne((request) => operation(request, 'AdminVehicleGroup', branchB));
    expect(requestA.request.headers.get('Accept-Language')).toBe('bg');
    requestA.flush({ data: { fleetVehicleGroup: group } });
    requestB.flush({
      data: { fleetVehicleGroup: { ...group, branchId: branchB, name: 'Other Branch' } },
    });
    expect((await readA).data?.fleetVehicleGroup?.name).toBe('Regional');
    expect((await readB).data?.fleetVehicleGroup?.name).toBe('Other Branch');
    const again = firstValueFrom(
      a.watchGroup(groupId).valueChanges.pipe(filter((result) => !result.loading)),
    );
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroup'))
      .flush({ data: { fleetVehicleGroup: { ...group, name: 'Refreshed' } } });
    expect((await again).data?.fleetVehicleGroup?.name).toBe('Refreshed');
  });

  it('settles every submitted write in its captured client before stopping a retired scope', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = mount();
    const create = a.create({ input: { name: 'Created', colorToken: 'C2' } });
    const update = a.update({ id: groupId, input: { name: 'Updated' } });
    const created = http.expectOne((request) => operation(request, 'AdminCreateVehicleGroup'));
    const updated = http.expectOne((request) => operation(request, 'AdminUpdateVehicleGroup'));
    a.ngOnDestroy();
    const b = mount(branchB);
    expect(() => a.watch({ offset: 0, limit: 100 })).toThrow('active Vehicle groups');
    expect(stop).not.toHaveBeenCalled();
    created.flush({ data: { createFleetVehicleGroup: group } });
    await create;
    expect(stop).not.toHaveBeenCalled();
    updated.flush({ data: { updateFleetVehicleGroup: group } });
    await update;
    expect(stop).toHaveBeenCalledTimes(1);
    const read = firstValueFrom(
      b.watch({ offset: 0, limit: 100 }).valueChanges.pipe(filter((result) => !result.loading)),
    );
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroupsList', branchB))
      .flush({
        data: {
          fleetVehicleGroups: {
            items: [],
            total: 0,
            offset: 0,
            limit: 100,
            ungroupedVehicleCount: 0,
          },
        },
      });
    expect((await read).data?.fleetVehicleGroups?.items).toEqual([]);
  });

  it('keeps a protected deletion error available and permits a later retry', async () => {
    const api = mount();
    const failed = expect(api.delete({ id: groupId })).rejects.toThrow('move them first');
    http
      .expectOne((request) => operation(request, 'AdminDeleteVehicleGroup'))
      .flush({
        errors: [
          {
            message: 'Vehicle group still contains vehicles; move them first.',
            extensions: { code: 'CONFLICT' },
          },
        ],
      });
    await failed;
    const retry = api.delete({ id: groupId });
    http
      .expectOne((request) => operation(request, 'AdminDeleteVehicleGroup'))
      .flush({ data: { deleteFleetVehicleGroup: group } });
    expect((await retry).id).toBe(groupId);
  });
});
