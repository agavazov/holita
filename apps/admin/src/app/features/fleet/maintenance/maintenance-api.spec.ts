import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import type { Subscription } from 'rxjs';
import type {
  AdminServiceTaskDetailsFragment,
  AdminServiceTasksQuery,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { MaintenanceApi } from './maintenance-api';
const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const id = '80000000-0000-4000-8000-000000000001';
function task(
  branchId = branchA,
  title = 'Oil change',
): AdminServiceTaskDetailsFragment & { readonly __typename: 'FleetServiceTask' } {
  return {
    __typename: 'FleetServiceTask',
    id,
    branchId,
    vehicleId: '20000000-0000-4000-8000-000000000001',
    vehicle: {
      id: '20000000-0000-4000-8000-000000000001',
      licensePlate: 'CB 1001 AX',
      status: 'ACTIVE',
    },
    serviceType: 'OIL_CHANGE',
    status: 'PLANNED',
    title,
    dueOn: '2026-10-18',
    dueOdometerKm: null,
    completedOn: null,
    completedOdometerKm: null,
    workshop: null,
    replacedParts: null,
    costCents: null,
    notes: null,
    urgency: 'OVERDUE',
    remainingDays: -1,
    remainingKm: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}
function operation(request: HttpRequest<unknown>, name: string, branch = branchA): boolean {
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
function list(record = task()) {
  return {
    data: {
      fleetServiceTasks: {
        __typename: 'FleetServiceTaskPage',
        items: [record],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}
describe('Maintenance captured Apollo scope', () => {
  let http: HttpTestingController;
  const clients: MaintenanceApi[] = [];
  const subscriptions: Subscription[] = [];
  function mount(branch = branchA) {
    const api = TestBed.runInInjectionContext(() => new MaintenanceApi());
    api.initialize(branch, 'bg');
    clients.push(api);
    return api;
  }
  function watch(api: MaintenanceApi) {
    const query = api.watch({ offset: 0, limit: 20 });
    const page = signal<AdminServiceTasksQuery['fleetServiceTasks'] | null>(null);
    subscriptions.push(
      query.valueChanges.subscribe((result) => {
        if (result.dataState === 'complete' && !result.error) {
          page.set(result.data.fleetServiceTasks);
        }
      }),
    );
    return { query, page };
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
    subscriptions.splice(0).forEach((subscription) => {
      subscription.unsubscribe();
    });
    clients.splice(0).forEach((api) => {
      api.ngOnDestroy();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  it('isolates identical task IDs between Branches and fetches each editor opening from the network', async () => {
    const api = mount();
    const a = watch(api);
    const b = watch(mount(branchB));
    const request = http.expectOne((request) => operation(request, 'AdminServiceTasks'));
    expect(request.request.headers.get('Accept-Language')).toBe('bg');
    request.flush(list());
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks', branchB))
      .flush(list(task(branchB, 'Branch B')));
    await vi.waitFor(() => {
      expect(a.page()?.items[0]?.title).toBe('Oil change');
    });
    expect(b.page()?.items[0]?.title).toBe('Branch B');
    for (let opening = 0; opening < 2; opening++) {
      const read = api.watchTask(id).valueChanges.subscribe();
      http
        .expectOne((request) => operation(request, 'AdminServiceTask'))
        .flush({ data: { fleetServiceTask: task() } });
      read.unsubscribe();
    }
  });
  it('keeps submitted completion alive after retirement without mutating a fresh scope', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const retired = mount();
    const completion = retired.complete({
      id,
      input: { completedOn: '2026-10-18', costCents: 29 },
    });
    const write = http.expectOne((request) => operation(request, 'AdminCompleteServiceTask'));
    retired.ngOnDestroy();
    expect(stop).not.toHaveBeenCalled();
    const current = watch(mount());
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks'))
      .flush(list(task(branchA, 'Fresh scope')));
    expect(write.cancelled).toBe(false);
    write.flush({
      data: {
        completeFleetServiceTask: {
          completed: {
            ...task(),
            status: 'DONE',
            urgency: null,
            completedOn: '2026-10-18',
            costCents: 29,
          },
          next: null,
        },
      },
    });
    expect((await completion).completed.costCents).toBe(29);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(current.page()?.items[0]?.title).toBe('Fresh scope');
    http.expectNone('/graphql');
  });
  it('retains every submitted batch until settlement and releases a failed retired client', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const api = mount();
    const cancel = api.act('cancel', [id]);
    const cancelRequest = http.expectOne((request) =>
      operation(request, 'AdminCancelServiceTasks'),
    );
    const deletion = api.act('delete', [id]);
    const rejection = expect(deletion).rejects.toThrow('Protected service');
    const deleteRequest = http.expectOne((request) =>
      operation(request, 'AdminDeleteServiceTasks'),
    );
    api.ngOnDestroy();
    cancelRequest.flush({
      data: { cancelFleetServiceTasks: { succeededIds: [id], failures: [] } },
    });
    await cancel;
    expect(stop).not.toHaveBeenCalled();
    deleteRequest.flush({
      errors: [{ message: 'Protected service', extensions: { code: 'CONFLICT' } }],
    });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
    await expect(api.act('delete', [id])).rejects.toThrow('active Maintenance');
  });
  it('cancels obsolete reads and refetches a failed list without replacing its client', async () => {
    const api = mount();
    const current = watch(api);
    http.expectOne((request) => operation(request, 'AdminServiceTasks')).flush(list());
    const refresh = current.query.refetch();
    const rejection = expect(refresh).rejects.toThrow('Unavailable');
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks'))
      .flush({ errors: [{ message: 'Unavailable' }] });
    await rejection;
    expect(current.page()?.items[0]?.id).toBe(id);
    const retry = current.query.refetch();
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks'))
      .flush(list(task(branchA, 'Recovered')));
    await retry;
    expect(current.page()?.items[0]?.title).toBe('Recovered');
    const obsolete = api.watchTask(id).valueChanges.subscribe();
    const read = http.expectOne((request) => operation(request, 'AdminServiceTask'));
    obsolete.unsubscribe();
    api.ngOnDestroy();
    expect(read.cancelled).toBe(true);
  });
});
