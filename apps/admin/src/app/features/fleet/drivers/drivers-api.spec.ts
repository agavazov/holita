import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Subscription } from 'rxjs';
import type {
  AdminDriverDetailsFragment,
  AdminDriversQuery,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import { DriversApi } from './drivers-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const driverId = '20000000-0000-4000-8000-000000000001';
function record(
  branchId = branchA,
  firstName = 'Elena',
): AdminDriverDetailsFragment & { readonly __typename: 'FleetDriver' } {
  return {
    __typename: 'FleetDriver',
    id: driverId,
    branchId,
    firstName,
    lastName: 'Petrova',
    employeeNumber: null,
    identificationKey: null,
    phone: null,
    email: null,
    licenseNumber: null,
    licenseCategories: [],
    licenseExpiresOn: null,
    tachographCardNumber: null,
    tachographCardExpiresOn: null,
    status: 'ACTIVE',
    notes: null,
    vehicles: [],
    documentStatus: 'NOT_RECORDED',
    distance30dKm: 0,
    tripCount30d: 0,
    drivingScore30d: null,
    maneuversPer100Km30d: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function list(driver = record()) {
  return {
    data: {
      fleetDrivers: {
        __typename: 'FleetDriverPage',
        items: [driver],
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

describe('Drivers captured Apollo clients', () => {
  let http: HttpTestingController;
  const clients: DriversApi[] = [];
  const subscriptions: Subscription[] = [];
  function mount(branchId = branchA, language: Language = 'en') {
    const api = TestBed.runInInjectionContext(() => new DriversApi());
    api.initialize(branchId, language);
    clients.push(api);
    return api;
  }
  function watch(api: DriversApi) {
    const page = signal<AdminDriversQuery['fleetDrivers'] | null>(null);
    const query = api.watch({ offset: 0, limit: 20 });
    subscriptions.push(
      query.valueChanges.subscribe((result) => {
        if (result.dataState === 'complete' && !result.error) {
          page.set(result.data.fleetDrivers);
        }
      }),
    );
    return page;
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
    for (const subscription of subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
    for (const api of clients.splice(0)) {
      api.ngOnDestroy();
    }
    http.verify({ ignoreCancelled: true });
  });

  it('separates identical branch queries and captured language/session headers', async () => {
    const a = watch(mount());
    const b = watch(mount(branchB, 'bg'));
    const readA = http.expectOne((request) => operation(request, 'AdminDrivers'));
    const readB = http.expectOne((request) => operation(request, 'AdminDrivers', branchB));
    expect(readA.request.headers.get('Accept-Language')).toBe('en');
    expect(readB.request.headers.get('Accept-Language')).toBe('bg');
    expect(readA.request.headers.get('authorization')).toBe('Bearer tenant-a-token');
    expect(readA.request.headers.get('x-request-id')).not.toBe(
      readB.request.headers.get('x-request-id'),
    );
    readB.flush(list(record(branchB, 'B')));
    readA.flush(list());
    await vi.waitFor(() => {
      expect(a()?.items[0]?.firstName).toBe('Elena');
    });
    expect(b()?.items[0]?.firstName).toBe('B');
  });

  it('cancels obsolete reads and always reads drawer records from the network', async () => {
    const api = mount();
    watch(api);
    http.expectOne((request) => operation(request, 'AdminDrivers')).flush(list());
    const subscription = api.watchDriver(driverId).valueChanges.subscribe();
    const pending = http.expectOne((request) => operation(request, 'AdminDriver'));
    subscription.unsubscribe();
    api.ngOnDestroy();
    await vi.waitFor(() => {
      expect(pending.cancelled).toBe(true);
    });
    expect(() => api.watchDriver(driverId)).toThrow('active Drivers workspace');
  });

  it('settles a retired A write without changing B or the next A client', async () => {
    const old = mount();
    watch(old);
    http.expectOne((request) => operation(request, 'AdminDrivers')).flush(list());
    const writeResult = old.update({ id: driverId, input: { firstName: 'Late A' } });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateDriver'));
    for (const subscription of subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
    old.ngOnDestroy();
    const b = watch(mount(branchB));
    http
      .expectOne((request) => operation(request, 'AdminDrivers', branchB))
      .flush(list(record(branchB, 'B')));
    const nextA = watch(mount());
    http.expectOne((request) => operation(request, 'AdminDrivers')).flush(list());
    expect(write.cancelled).toBe(false);
    write.flush({ data: { updateFleetDriver: record(branchA, 'Late A') } });
    await expect(writeResult).resolves.toMatchObject({ firstName: 'Late A' });
    expect(b()?.items[0]?.firstName).toBe('B');
    expect(nextA()?.items[0]?.firstName).toBe('Elena');
    http.expectNone('/graphql');
  });
});
