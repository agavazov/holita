import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';
import type { AdminServiceTaskDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { MaintenancePage } from './maintenance-page';
const branch = '10000000-0000-4000-8000-000000000001';
const id = '80000000-0000-4000-8000-000000000001';
const secondId = '80000000-0000-4000-8000-000000000002';
const task: AdminServiceTaskDetailsFragment & { readonly __typename: 'FleetServiceTask' } = {
  __typename: 'FleetServiceTask',
  id,
  branchId: branch,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: {
    id: '20000000-0000-4000-8000-000000000001',
    licensePlate: 'CB 1001 AX',
    status: 'ACTIVE',
  },
  serviceType: 'OIL_CHANGE',
  status: 'PLANNED',
  title: 'Oil change',
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
function operation(request: HttpRequest<unknown>, name: string): boolean {
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
function list(
  items: readonly AdminServiceTaskDetailsFragment[] = [task, { ...task, id: secondId }],
) {
  return { data: { fleetServiceTasks: { items, total: items.length, offset: 0, limit: 20 } } };
}
describe('Live Maintenance list lifetime and batches', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<MaintenancePage>[] = [];
  const params = new BehaviorSubject(convertToParamMap({}));
  const route = { queryParamMap: params, snapshot: { queryParamMap: convertToParamMap({}) } };
  const notice = vi.fn<MessageService['add']>();
  const navigate = vi.fn<Router['navigate']>();
  function summary() {
    http
      .expectOne((request) => operation(request, 'AdminServiceSummary'))
      .flush({
        data: {
          fleetServiceSummary: {
            businessDate: '2026-10-19',
            overdue: 2,
            dueSoon: 0,
            unknownOdometer: 0,
            upcoming: 0,
            inWorkshopVehicles: 0,
            completedLast30Days: 0,
            costLast30DaysCents: 0,
            costWindowStart: '2026-09-20',
            costWindowEnd: '2026-10-19',
          },
        },
      });
  }
  async function mount() {
    const fixture = TestBed.createComponent(MaintenancePage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Fleet' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminServiceVehicles'))
      .flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 100 } } });
    summary();
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
    TestBed.overrideComponent(MaintenancePage, { set: { template: '' } });
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
  it('submits one real batch, retains failed selections and retries only those IDs', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminServiceTasks')).flush(list());
    await fixture.whenStable();
    fixture.componentInstance.selected.set([
      { id, label: 'First', unavailable: [] },
      { id: secondId, label: 'Second', unavailable: [] },
    ]);
    const saving = fixture.componentInstance.run({ action: 'cancel', ids: [id, secondId] });
    const batch = http.expectOne((request) => operation(request, 'AdminCancelServiceTasks'));
    expect(batch.request.body).toMatchObject({ variables: { ids: [id, secondId] } });
    batch.flush({
      data: {
        cancelFleetServiceTasks: {
          succeededIds: [id],
          failures: [{ id: secondId, code: 'CONFLICT', message: 'Completed meanwhile.' }],
        },
      },
    });
    await saving;
    expect(fixture.componentInstance.selected().map((record) => record.id)).toEqual([secondId]);
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        sticky: true,
        summary: 'Service tasks cancelled: 1. Failed: 1.',
      }),
    );
    expect(notice.mock.lastCall?.[0].detail).toContain('Completed meanwhile.');
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks'))
      .flush(
        list([
          { ...task, status: 'CANCELLED', urgency: null },
          { ...task, id: secondId },
        ]),
      );
    summary();
    await fixture.whenStable();
    const retry = fixture.componentInstance.run({
      action: 'cancel',
      ids: fixture.componentInstance.selected().map((record) => record.id),
    });
    const request = http.expectOne((request) => operation(request, 'AdminCancelServiceTasks'));
    expect(request.request.body).toMatchObject({ variables: { ids: [secondId] } });
    request.flush({
      data: { cancelFleetServiceTasks: { succeededIds: [secondId], failures: [] } },
    });
    await retry;
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks'))
      .flush(
        list([
          { ...task, status: 'CANCELLED', urgency: null },
          { ...task, id: secondId, status: 'CANCELLED', urgency: null },
        ]),
      );
    summary();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toEqual([]);
  });
  it('retains loaded rows on refresh failure and cancels a superseded query before applying exact cost filters', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminServiceTasks')).flush(list());
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    http
      .expectOne((request) => operation(request, 'AdminServiceTasks'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    summary();
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.items).toHaveLength(2);
    expect(fixture.componentInstance.error()).not.toBeNull();
    params.next(
      convertToParamMap({
        conditions: JSON.stringify([
          { id: 'cost', field: 'cost', operator: 'gt', values: ['0.29'] },
        ]),
      }),
    );
    const old = http.expectOne((request) => operation(request, 'AdminServiceTasks'));
    params.next(
      convertToParamMap({
        conditions: JSON.stringify([
          { id: 'cost', field: 'cost', operator: 'gt', values: ['0.30'] },
        ]),
      }),
    );
    expect(old.cancelled).toBe(true);
    const current = http.expectOne((request) => operation(request, 'AdminServiceTasks'));
    expect(current.request.body).toMatchObject({
      variables: { filter: { allOf: [{ costCentsAbove: 30 }] } },
    });
    current.flush(list());
    await fixture.whenStable();
  });
  it('lets a submitted delete settle after retirement without showing a stale toast or starting a refresh', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminServiceTasks')).flush(list());
    await fixture.whenStable();
    const saving = fixture.componentInstance.run({ action: 'delete', ids: [id] });
    const write = http.expectOne((request) => operation(request, 'AdminDeleteServiceTasks'));
    fixture.destroy();
    expect(write.cancelled).toBe(false);
    write.flush({ data: { deleteFleetServiceTasks: { succeededIds: [id], failures: [] } } });
    await saving;
    expect(notice).not.toHaveBeenCalled();
    http.expectNone('/graphql');
  });
});
