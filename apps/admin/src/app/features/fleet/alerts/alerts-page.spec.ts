import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { AlertsPage } from './alerts-page';
const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const id = '60000000-0000-4000-8000-000000000001';
const secondId = '60000000-0000-4000-8000-000000000002';
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
  remark: 'Retained',
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
describe('Live Alerts list actions and load lifetime', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<AlertsPage>[] = [];
  const params = new BehaviorSubject(convertToParamMap({}));
  const route = { queryParamMap: params, snapshot: { queryParamMap: convertToParamMap({}) } };
  const notice = vi.fn<MessageService['add']>();
  const navigate = vi.fn<Router['navigate']>();
  function list(items = [event, { ...event, id: secondId }]) {
    return { data: { fleetEvents: { items, total: items.length, offset: 0, limit: 20 } } };
  }
  function auxiliary(branchId = branchA) {
    http
      .expectOne((request) => operation(request, 'AdminAlertCounts', branchId))
      .flush({
        data: { fleetAlertCounts: { open: 2, openCritical: 0, acknowledged: 0, resolved: 0 } },
      });
    http
      .expectOne((request) => operation(request, 'AdminAlertsDataClock', branchId))
      .flush({
        data: {
          fleetDataClock: { asOf: null, businessDate: '2026-10-18', timeZone: 'Europe/Sofia' },
        },
      });
  }
  async function mount(branchId = branchA) {
    const fixture = TestBed.createComponent(AlertsPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branchId, name: 'Fleet' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminAlertVehicles', branchId))
      .flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 100 } } });
    auxiliary(branchId);
    return fixture;
  }
  beforeEach(() => {
    params.next(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    TestBed.overrideComponent(AlertsPage, { set: { template: '' } });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    notice.mockReset();
    navigate.mockReset().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(MessageService), 'add').mockImplementation(notice);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  it('submits one batch and keeps only failed selections for retry', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminAlerts')).flush(list());
    await fixture.whenStable();
    expect(fixture.componentInstance.dataAsOf()).toBeNull();
    fixture.componentInstance.selected.set([
      { id, label: 'First', unavailable: [] },
      { id: secondId, label: 'Second', unavailable: [] },
    ]);
    const saving = fixture.componentInstance.run({ action: 'acknowledge', ids: [id, secondId] });
    http
      .expectOne((request) => operation(request, 'AdminAcknowledgeAlerts'))
      .flush({
        data: {
          acknowledgeFleetAlerts: {
            succeededIds: [id],
            failures: [{ id: secondId, code: 'CONFLICT', message: 'Changed meanwhile.' }],
          },
        },
      });
    await saving;
    expect(fixture.componentInstance.selected().map((record) => record.id)).toEqual([secondId]);
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        sticky: true,
        summary: 'Alerts acknowledged: 1. Failed: 1.',
      }),
    );
    expect(notice.mock.calls.at(-1)?.[0].detail).toContain('Changed meanwhile.');
    http
      .expectOne((request) => operation(request, 'AdminAlerts'))
      .flush(
        list([
          { ...event, alertStatus: 'ACKNOWLEDGED' },
          { ...event, id: secondId },
        ]),
      );
    auxiliary();
    await fixture.whenStable();
    const retry = fixture.componentInstance.run({
      action: 'acknowledge',
      ids: fixture.componentInstance.selected().map((record) => record.id),
    });
    const request = http.expectOne((request) => operation(request, 'AdminAcknowledgeAlerts'));
    expect(request.request.body).toMatchObject({ variables: { ids: [secondId] } });
    request.flush({ data: { acknowledgeFleetAlerts: { succeededIds: [secondId], failures: [] } } });
    await retry;
    http
      .expectOne((request) => operation(request, 'AdminAlerts'))
      .flush(
        list([
          { ...event, alertStatus: 'ACKNOWLEDGED' },
          { ...event, id: secondId, alertStatus: 'ACKNOWLEDGED' },
        ]),
      );
    auxiliary();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toEqual([]);
  });
  it('retains rows after refresh failure and does not invent a data clock', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminAlerts')).flush(list());
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    http
      .expectOne((request) => operation(request, 'AdminAlerts'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    auxiliary();
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.items).toHaveLength(2);
    expect(fixture.componentInstance.error()).not.toBeNull();
    expect(fixture.componentInstance.dataAsOf()).toBeNull();
  });
  it('retires obsolete reads and sends independent exclusion conditions to the backend', async () => {
    const fixture = await mount();
    const old = http.expectOne((request) => operation(request, 'AdminAlerts'));
    params.next(
      convertToParamMap({
        conditions: JSON.stringify([
          { id: 'severity', field: 'severity', operator: 'isNoneOf', values: ['INFO'] },
        ]),
      }),
    );
    expect(old.cancelled).toBe(true);
    const current = http.expectOne((request) => operation(request, 'AdminAlerts'));
    expect(current.request.body).toMatchObject({
      variables: { filter: { actionable: true, allOf: [{ excludedSeverities: ['INFO'] }] } },
    });
    current.flush(list());
    http
      .expectOne((request) => operation(request, 'AdminAlertCounts'))
      .flush({
        data: { fleetAlertCounts: { open: 2, openCritical: 0, acknowledged: 0, resolved: 0 } },
      });
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.items).toHaveLength(2);
  });
  it('does not publish a batch result after the initiating Branch list is retired', async () => {
    const old = await mount();
    http.expectOne((request) => operation(request, 'AdminAlerts')).flush(list());
    await old.whenStable();
    const saving = old.componentInstance.run({ action: 'acknowledge', ids: [id] });
    const write = http.expectOne((request) => operation(request, 'AdminAcknowledgeAlerts'));
    old.destroy();
    const current = await mount(branchB);
    http
      .expectOne((request) => operation(request, 'AdminAlerts', branchB))
      .flush(list([{ ...event, branchId: branchB }]));
    await current.whenStable();
    expect(write.cancelled).toBe(false);
    write.flush({ data: { acknowledgeFleetAlerts: { succeededIds: [id], failures: [] } } });
    await saving;
    expect(current.componentInstance.page()?.items[0]?.alertStatus).toBe('OPEN');
    expect(notice).not.toHaveBeenCalled();
    http.expectNone('/graphql');
  });
});
