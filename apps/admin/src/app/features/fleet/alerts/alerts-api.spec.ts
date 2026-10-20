import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { filter, firstValueFrom } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { AlertsApi } from './alerts-api';
const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const id = '60000000-0000-4000-8000-000000000001';
const event = {
  __typename: 'FleetEvent',
  id,
  branchId: branchA,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: { id: '20000000-0000-4000-8000-000000000001', licensePlate: 'CB 1001 AX' },
  driverId: null,
  driver: null,
  tripId: null,
  occurredAt: '2026-10-18T06:00:00.000Z',
  kind: 'LOW_FUEL',
  severity: 'WARNING',
  alertStatus: 'OPEN',
  details: null,
  remark: 'Existing',
  acknowledgedAt: null,
  resolvedAt: null,
  address: null,
  measuredValue: 8,
  thresholdValue: 12,
  measurementUnit: 'PERCENT',
  troubleCode: null,
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
describe('AlertsApi captured scopes and optimistic workflow', () => {
  let http: HttpTestingController;
  const clients: AlertsApi[] = [];
  function mount(branch = branchA) {
    const api = TestBed.runInInjectionContext(() => new AlertsApi());
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
    vi.restoreAllMocks();
  });
  it('keeps identical detail IDs isolated by Branch and fetches a fresh detail each time', async () => {
    const a = mount();
    const b = mount(branchB);
    const first = firstValueFrom(
      a.watchAlert(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    const other = firstValueFrom(
      b.watchAlert(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    const request = http.expectOne((request) => operation(request, 'AdminAlert'));
    expect(request.request.headers.get('Accept-Language')).toBe('bg');
    request.flush({ data: { fleetEvent: event } });
    http
      .expectOne((request) => operation(request, 'AdminAlert', branchB))
      .flush({ data: { fleetEvent: { ...event, branchId: branchB, remark: 'Other Branch' } } });
    expect((await first).data?.fleetEvent?.remark).toBe('Existing');
    expect((await other).data?.fleetEvent?.remark).toBe('Other Branch');
    const fresh = firstValueFrom(
      a.watchAlert(id).valueChanges.pipe(filter((result) => !result.loading)),
    );
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: { ...event, remark: 'Fresh' } } });
    expect((await fresh).data?.fleetEvent?.remark).toBe('Fresh');
  });
  it('sends one optimistic batch without clearing any stored remarks and preserves per-record failures', async () => {
    const api = mount();
    const write = api.acknowledgeMany([id]);
    const request = http.expectOne((request) => operation(request, 'AdminAcknowledgeAlerts'));
    const body: unknown = request.request.body;
    expect(body).toMatchObject({
      variables: { ids: [id], input: { expectedStatus: 'OPEN' } },
    });
    if (typeof body !== 'object' || body === null || !('variables' in body)) {
      throw new Error('Missing mutation variables.');
    }
    const variables = body.variables;
    if (typeof variables !== 'object' || variables === null || !('input' in variables)) {
      throw new Error('Missing acknowledge input.');
    }
    expect(variables.input).not.toHaveProperty('remark');
    request.flush({
      data: {
        acknowledgeFleetAlerts: {
          succeededIds: [],
          failures: [{ id, code: 'CONFLICT', message: 'Changed meanwhile.' }],
        },
      },
    });
    expect((await write).failures).toEqual([
      { id, code: 'CONFLICT', message: 'Changed meanwhile.' },
    ]);
  });
  it('preserves the captured client until batch and single writes have both settled', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const api = mount();
    const batch = api.acknowledgeMany([id]);
    const single = api.transition('resolve', {
      id,
      input: { expectedStatus: 'ACKNOWLEDGED', remark: null },
    });
    const batchRequest = http.expectOne((request) => operation(request, 'AdminAcknowledgeAlerts'));
    const singleRequest = http.expectOne((request) => operation(request, 'AdminResolveAlert'));
    api.ngOnDestroy();
    mount(branchB);
    expect(stop).not.toHaveBeenCalled();
    batchRequest.flush({ data: { acknowledgeFleetAlerts: { succeededIds: [id], failures: [] } } });
    await batch;
    expect(stop).not.toHaveBeenCalled();
    singleRequest.flush({
      data: { resolveFleetAlert: { ...event, alertStatus: 'RESOLVED', remark: null } },
    });
    expect((await single).alertStatus).toBe('RESOLVED');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(() => api.watchAlert(id)).toThrow('active Alerts');
  });
  it('propagates a stale transition conflict without reporting success', async () => {
    const api = mount();
    const failed = expect(
      api.transition('reopen', {
        id,
        input: { expectedStatus: 'RESOLVED', remark: 'Investigate' },
      }),
    ).rejects.toThrow('Changed meanwhile.');
    http
      .expectOne((request) => operation(request, 'AdminReopenAlert'))
      .flush({ errors: [{ message: 'Changed meanwhile.', extensions: { code: 'CONFLICT' } }] });
    await failed;
  });
});
