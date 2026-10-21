import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import {
  ActivatedRoute,
  ROUTER_OUTLET_DATA,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type { AdminServiceTaskDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { MaintenanceRecordPage } from './maintenance-record-page';
import { ServiceCompletionDrawer, type ServiceCompletionForm } from './service-completion-drawer';
import { ServiceTaskDrawer } from './service-task-drawer';
import { serviceTaskForm } from './service-task-mapping';
const branch = '10000000-0000-4000-8000-000000000001';
const id = '80000000-0000-4000-8000-000000000001';
const vehicleId = '20000000-0000-4000-8000-000000000001';
function record(
  overrides: Partial<AdminServiceTaskDetailsFragment> = {},
): AdminServiceTaskDetailsFragment & { readonly __typename: 'FleetServiceTask' } {
  return {
    __typename: 'FleetServiceTask',
    id,
    branchId: branch,
    vehicleId,
    vehicle: { id: vehicleId, licensePlate: 'CB 1001 AX', status: 'ACTIVE' },
    serviceType: 'OIL_CHANGE',
    status: 'PLANNED',
    title: null,
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
    ...overrides,
  };
}
function snapshot(
  mode: 'create' | 'edit' | 'view' = 'edit',
  recordId = id,
  action: string | null = null,
) {
  const current = {
    data: {
      drawer: true,
      mode,
      ...(mode === 'create' ? {} : { recordParam: 'recordId' }),
      ...(action ? { action } : {}),
    },
    paramMap: convertToParamMap({ recordId, branchId: branch }),
  };
  return { ...current, pathFromRoot: [current] };
}
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
function dialog(): HTMLElement {
  const element = Array.from(document.querySelectorAll<HTMLElement>('.p-drawer[role="dialog"]')).at(
    -1,
  );
  if (!element) {
    throw new Error('Missing maintenance drawer.');
  }
  return element;
}
const completion: ServiceCompletionForm = {
  completedOn: '2026-10-18',
  completedOdometerKm: 0,
  costCents: 29,
  workshop: 'Warranty',
  replacedParts: '',
  notes: '',
  nextDueOn: null,
  nextDueOdometerKm: null,
  nextTitle: null,
};
describe('Live Maintenance routed records', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<MaintenanceRecordPage>[] = [];
  const route = { snapshot: snapshot() };
  const navigate = vi.fn<Router['navigate']>();
  const hostSaved = vi.fn<DrawerHost['saved']>();
  const outletHost = signal<DrawerHost>({ saved: hostSaved });
  async function mount(
    mode: 'create' | 'edit' | 'view' = 'edit',
    item = record(),
    action: string | null = null,
    recordId = id,
  ) {
    route.snapshot = snapshot(mode, recordId, action);
    const fixture = TestBed.createComponent(MaintenanceRecordPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    if (mode !== 'create' && recordId === id) {
      http
        .expectOne((request) => operation(request, 'AdminServiceTask'))
        .flush({ data: { fleetServiceTask: item } });
    }
    if (action === 'complete' && recordId === id) {
      http
        .expectOne((request) => operation(request, 'AdminServiceSummary'))
        .flush({
          data: {
            fleetServiceSummary: {
              businessDate: '2026-10-19',
              overdue: 1,
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
    if (recordId === id || mode === 'create') {
      http
        .expectOne((request) => operation(request, 'AdminServiceVehicles'))
        .flush({
          data: {
            fleetVehicles: {
              items: [
                item.vehicle,
                {
                  id: '20000000-0000-4000-8000-000000000002',
                  licensePlate: 'Inactive choice',
                  status: 'INACTIVE',
                },
              ],
              total: 2,
              offset: 0,
              limit: 100,
            },
          },
        });
    }
    await fixture.whenStable();
    return fixture;
  }
  beforeEach(() => {
    outletHost.set({ saved: hostSaved });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: ROUTER_OUTLET_DATA, useValue: outletHost },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate.mockReset().mockResolvedValue(true);
    hostSaved.mockReset();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
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
  it('creates in one captured write, excludes inactive choices and closes preserving list query and fragment', async () => {
    const fixture = await mount('create');
    const drawer = fixture.debugElement
      .query(By.directive(ServiceTaskDrawer))
      .injector.get(ServiceTaskDrawer);
    expect(drawer.vehicles().map((vehicle) => vehicle.id)).toEqual([vehicleId]);
    const draft = { ...serviceTaskForm(record()), workshop: '  Warranty  ', dueKm: 0 };
    const saved = fixture.componentInstance.save(draft);
    await fixture.componentInstance.save(draft);
    const write = http.expectOne((request) => operation(request, 'AdminCreateServiceTask'));
    expect(write.request.body).toMatchObject({
      variables: { input: { vehicleId, dueOdometerKm: 0, workshop: 'Warranty' } },
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(dialog().querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      true,
    );
    write.flush({ data: { createFleetServiceTask: record() } });
    await saved;
    await fixture.whenStable();
    expect(hostSaved).toHaveBeenCalledWith({ recordId: id, message: 'Oil change was planned.' });
    expect(navigate).toHaveBeenCalledWith(
      ['/', 'en', branch, 'fleet', 'maintenance'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });
  it('saves over the owning vehicle profile and returns to its service tab', async () => {
    const closeLink = ['/', 'en', branch, 'fleet', 'vehicles', vehicleId, 'service'];
    outletHost.set({ saved: hostSaved, vehicleId, closeLink });
    const fixture = await mount();
    const saved = fixture.componentInstance.save(serviceTaskForm(record()));
    http
      .expectOne((request) => operation(request, 'AdminUpdateServiceTask'))
      .flush({ data: { updateFleetServiceTask: record() } });
    await saved;
    await fixture.whenStable();
    expect(hostSaved).toHaveBeenCalledWith({ recordId: id, message: 'Oil change was saved.' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      closeLink,
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });
  it('rejects another vehicle service record without hydrating a form or allowing writes', async () => {
    outletHost.set({ saved: hostSaved, vehicleId: '20000000-0000-4000-8000-000000000002' });
    const item = record({ notes: 'Unrelated vehicle service notes.' });
    const fixture = await mount('edit', item);
    expect(fixture.componentInstance.state()).toBe('not-found');
    expect(fixture.componentInstance.record()).toBeNull();
    expect(fixture.componentInstance.task()).toBeNull();
    expect(fixture.componentInstance.completionTask()).toBeNull();
    expect(dialog().textContent).not.toContain('Unrelated vehicle service notes.');
    await fixture.componentInstance.save(serviceTaskForm(item));
    await fixture.componentInstance.complete(completion);
    http.expectNone('/graphql');
    expect(hostSaved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('retains an edit draft and focuses a synchronously rejected server odometer without changing its vehicle', async () => {
    const fixture = await mount();
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    form.get('dueKm')?.setValue(0);
    form.get('dueKm')?.markAsDirty();
    const saved = fixture.componentInstance.save({ ...serviceTaskForm(record()), dueKm: 0 });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateServiceTask'));
    expect(write.request.body).not.toMatchObject({ variables: { input: { vehicleId } } });
    write.flush({
      errors: [
        {
          message: 'Invalid due odometer.',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'dueOdometerKm', message: 'Invalid due odometer.' }],
          },
        },
      ],
    });
    await saved;
    await fixture.whenStable();
    const input = dialog().querySelector('#task-dueKm');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(form.get('dueKm')?.value).toBe(0);
    expect(form.dirty).toBe(true);
    expect(hostSaved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('permits historical completion for an inactive vehicle and hides next planning', async () => {
    const item = record({
      vehicle: { id: vehicleId, licensePlate: 'CB 1001 AX', status: 'INACTIVE' },
    });
    const fixture = await mount('view', item, 'complete');
    const drawer = fixture.debugElement
      .query(By.directive(ServiceCompletionDrawer))
      .injector.get(ServiceCompletionDrawer);
    expect(drawer.allowNext()).toBe(false);
    expect(dialog().textContent).toContain('This vehicle is inactive.');
    expect(dialog().querySelector('#completion-nextDueOn')).toBeNull();
    const saved = fixture.componentInstance.complete(completion);
    const write = http.expectOne((request) => operation(request, 'AdminCompleteServiceTask'));
    expect(write.request.body).toMatchObject({
      variables: { id, input: { costCents: 29, nextDueOn: null, nextDueOdometerKm: null } },
    });
    write.flush({
      data: {
        completeFleetServiceTask: {
          completed: {
            ...item,
            status: 'DONE',
            completedOn: '2026-10-18',
            costCents: 29,
            urgency: null,
          },
          next: null,
        },
      },
    });
    await saved;
    expect(hostSaved).toHaveBeenCalledWith({ recordId: id, message: 'Oil change was completed.' });
  });
  it('shows completed and cancelled records read-only and never repeats their mutations', async () => {
    const done = await mount(
      'edit',
      record({
        status: 'DONE',
        completedOn: '2026-10-18',
        costCents: 0,
        urgency: null,
        workshop: 'Actual workshop',
        replacedParts: 'Actual filter',
      }),
    );
    expect(done.componentInstance.completed()?.costCents).toBe(0);
    expect(dialog().textContent).toContain('Actual filter');
    expect(dialog().querySelector('form')).toBeNull();
    await done.componentInstance.save(serviceTaskForm(record()));
    await done.componentInstance.complete(completion);
    done.destroy();
    const cancelled = await mount('edit', record({ status: 'CANCELLED', urgency: null }));
    expect(cancelled.componentInstance.readOnly()).toBe(true);
    expect(dialog().textContent).toContain('Cancelled Oil change');
    expect(dialog().querySelector('form')).toBeNull();
    await cancelled.componentInstance.save(serviceTaskForm(record()));
    http.expectNone('/graphql');
    expect(hostSaved).not.toHaveBeenCalled();
  });
  it('rejects malformed bookmarks before all lookups and writes', async () => {
    const fixture = await mount('edit', record(), null, 'invalid');
    expect(fixture.componentInstance.state()).toBe('invalid-id');
    await fixture.componentInstance.save(serviceTaskForm(record()));
    http.expectNone('/graphql');
    expect(hostSaved).not.toHaveBeenCalled();
  });
});
