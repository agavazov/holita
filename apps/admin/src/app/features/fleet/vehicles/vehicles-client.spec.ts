import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import { VehiclesApi } from './vehicles-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const firstId = '20000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000002';

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function summary(inOperation: number) {
  return {
    data: {
      fleetVehicleSummary: {
        __typename: 'FleetVehicleSummary',
        dataAsOf: null,
        inOperation,
        inWorkshop: 0,
        moving: 0,
        notReporting: 0,
        openAlerts: 0,
        lowFuel: 0,
      },
    },
  };
}

describe('Vehicles client lookups and batches', () => {
  let http: HttpTestingController;
  const clients: VehiclesApi[] = [];

  function mount(branchId: string, language: Language = 'en'): VehiclesApi {
    const api = TestBed.runInInjectionContext(() => new VehiclesApi());
    api.initialize(branchId, language);
    clients.push(api);
    return api;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const api of clients.splice(0)) {
      api.ngOnDestroy();
    }
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('loads paged and selected group/driver options through the captured workspace client', () => {
    const api = mount(branchA, 'bg');
    const groupRequest = { offset: 20, limit: 20, search: 'International', ids: [firstId] };
    const groups = api.watchGroups(groupRequest).valueChanges.subscribe();
    const drivers = api
      .watchDrivers({ offset: 0, limit: 10, search: 'Elena', ids: [secondId] })
      .valueChanges.subscribe();
    const readGroups = http.expectOne((request) => operation(request, 'AdminVehicleGroups'));
    const readDrivers = http.expectOne((request) => operation(request, 'AdminVehicleDrivers'));
    expect(readGroups.request.body).toMatchObject({ variables: groupRequest });
    expect(readDrivers.request.body).toMatchObject({
      variables: { offset: 0, limit: 10, search: 'Elena', ids: [secondId] },
    });
    for (const request of [readGroups.request, readDrivers.request]) {
      expect(request.headers.get('x-branch-id')).toBe(branchA);
      expect(request.headers.get('Accept-Language')).toBe('bg');
      expect(request.headers.get('authorization')).toBe('Bearer tenant-a-token');
    }
    readGroups.flush({
      data: {
        fleetVehicleGroups: {
          items: [{ id: firstId, name: 'International' }],
          total: 21,
          offset: 20,
          limit: 20,
        },
      },
    });
    readDrivers.flush({
      data: {
        fleetDrivers: {
          items: [{ id: secondId, firstName: 'Elena', lastName: 'Petrova', status: 'ACTIVE' }],
          total: 1,
          offset: 0,
          limit: 10,
        },
      },
    });
    groups.unsubscribe();
    drivers.unsubscribe();

    const repeated = api.watchGroups(groupRequest).valueChanges.subscribe();
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroups'))
      .flush({
        data: { fleetVehicleGroups: { items: [], total: 0, offset: 20, limit: 20 } },
      });
    repeated.unsubscribe();
  });

  it('settles captured batches after A → B → A and stops the retired client after both writes', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const session = TestBed.inject(DemoSession);
    const oldA = mount(branchA);
    const deletion = oldA.deleteMany([firstId, secondId]);
    const deactivation = oldA.deactivateMany([secondId]);
    const rejection = expect(deactivation).rejects.toThrow('Deactivation unavailable');
    const deleteRequest = http.expectOne((request) => operation(request, 'AdminDeleteVehicles'));
    const deactivateRequest = http.expectOne((request) =>
      operation(request, 'AdminDeactivateVehicles'),
    );
    expect(deleteRequest.request.body).toMatchObject({ variables: { ids: [firstId, secondId] } });
    oldA.ngOnDestroy();
    expect(stop).not.toHaveBeenCalled();
    expect(deleteRequest.cancelled).toBe(false);
    expect(deactivateRequest.cancelled).toBe(false);

    session.start({
      token: 'tenant-b-token',
      tenant: { id: '01000000-0000-4000-8000-000000000002', name: 'Tenant B' },
    });
    const b = mount(branchB);
    let bCount: number | undefined;
    const readB = b.watchSummary().valueChanges.subscribe((result) => {
      if (result.dataState === 'complete') {
        bCount = result.data.fleetVehicleSummary.inOperation;
      }
    });
    const summaryB = http.expectOne((request) => operation(request, 'AdminVehicleSummary'));
    expect(summaryB.request.headers.get('authorization')).toBe('Bearer tenant-b-token');
    summaryB.flush(summary(3));

    session.start({
      token: 'fresh-tenant-a-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    const newA = mount(branchA);
    let aCount: number | undefined;
    const readA = newA.watchSummary().valueChanges.subscribe((result) => {
      if (result.dataState === 'complete') {
        aCount = result.data.fleetVehicleSummary.inOperation;
      }
    });
    const summaryA = http.expectOne((request) => operation(request, 'AdminVehicleSummary'));
    expect(summaryA.request.headers.get('authorization')).toBe('Bearer fresh-tenant-a-token');
    summaryA.flush(summary(4));
    for (const request of [deleteRequest.request, deactivateRequest.request]) {
      expect(request.headers.get('authorization')).toBe('Bearer tenant-a-token');
      expect(request.headers.get('x-branch-id')).toBe(branchA);
    }

    const partial = {
      succeededIds: [firstId],
      failures: [{ id: secondId, code: 'CONFLICT', message: 'Assigned tracker.' }],
    };
    deleteRequest.flush({ data: { deleteFleetVehicles: partial } });
    expect(await deletion).toEqual(partial);
    expect(stop).not.toHaveBeenCalled();
    deactivateRequest.flush({ errors: [{ message: 'Deactivation unavailable' }] });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(bCount).toBe(3);
    expect(aCount).toBe(4);
    http.expectNone('/graphql');
    await expect(oldA.deactivateMany([firstId])).rejects.toThrow('active Vehicles workspace');
    readB.unsubscribe();
    readA.unsubscribe();
  });
});
