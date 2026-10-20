import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  ROUTER_OUTLET_DATA,
  Router,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { maintenanceText } from '../../../app/features/fleet/maintenance/i18n/messages';
import { MaintenanceView } from '../../../app/features/fleet/maintenance/maintenance-view';
import {
  ServiceCompletionDrawer,
  type ServiceCompletionForm,
} from '../../../app/features/fleet/maintenance/service-completion-drawer';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import type { FilterCondition } from '../../../app/ui/filter-builder/filter-model';
import { sampleNow, sampleServiceTasks, vehicleById } from '../fleet-samples';
import { saveDelayMs } from '../scenario';
import { MaintenancePage } from './maintenance-page';

const task = sampleServiceTasks.find(
  (item) => item.status === 'PLANNED' && vehicleById(item.vehicleId)?.status === 'INACTIVE',
);
if (!task) {
  throw new Error('Missing planned service for an inactive vehicle.');
}

describe('Maintenance sample completion', () => {
  let fixture: ComponentFixture<MaintenancePage> | undefined;

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('rejects stale next planning atomically, then permits inactive vehicle history without a new task', async () => {
    const query = convertToParamMap({ drawer: `complete-${task.id}` });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: ROUTER_OUTLET_DATA, useValue: signal('Example Branch') },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: query }, queryParamMap: of(query) },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const notice = vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(MaintenancePage);
    fixture.detectChanges();
    await fixture.whenStable();
    const view = fixture.debugElement
      .query(By.directive(MaintenanceView))
      .injector.get(MaintenanceView);
    const drawer = fixture.debugElement
      .query(By.directive(ServiceCompletionDrawer))
      .injector.get(ServiceCompletionDrawer);
    const initialTotal = view.total();
    const plate = vehicleById(task.vehicleId)?.plate;
    if (!plate) {
      throw new Error('Missing inactive vehicle plate.');
    }
    view.stateChange.emit({ ...view.state(), search: plate });
    fixture.detectChanges();
    expect(view.rows()).toHaveLength(1);
    expect(drawer.allowNext()).toBe(false);
    expect(document.querySelector('#completion-nextDueOdometerKm')).toBeNull();

    const completion: ServiceCompletionForm = {
      completedOn: new Date(sampleNow).toISOString().slice(0, 10),
      completedOdometerKm: null,
      costCents: 0,
      workshop: 'Historical workshop',
      replacedParts: '',
      notes: '',
      nextDueOn: '2026-12-01',
      nextDueOdometerKm: 150000,
      nextTitle: 'Stale next service',
    };
    vi.useFakeTimers();
    drawer.save.emit(completion);
    await vi.advanceTimersByTimeAsync(saveDelayMs);
    vi.useRealTimers();
    fixture.detectChanges();
    await fixture.whenStable();
    const inactive = maintenanceText('en').completion.inactiveNext;
    expect(drawer.fieldErrors()).toEqual({ nextDueOn: inactive, nextDueOdometerKm: inactive });
    expect(drawer.saveError()).toBe(inactive);
    expect(view.rows()[0]).toMatchObject({ id: task.id, status: 'PLANNED', costCents: null });
    expect(notice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    vi.useFakeTimers();
    drawer.save.emit({ ...completion, nextDueOn: null, nextDueOdometerKm: null, nextTitle: null });
    await vi.advanceTimersByTimeAsync(saveDelayMs);
    vi.useRealTimers();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(view.rows()).toHaveLength(1);
    expect(view.rows()[0]).toMatchObject({ id: task.id, status: 'DONE', costCents: 0 });
    expect(fixture.debugElement.query(By.directive(ServiceCompletionDrawer))).toBeNull();
    expect(notice).toHaveBeenCalledExactlyOnceWith({
      severity: 'success',
      summary: `${task.kind} was completed.`,
    });
    view.stateChange.emit({ ...view.state(), search: '' });
    fixture.detectChanges();
    expect(view.total()).toBe(initialTotal);
  });
});

describe('Maintenance sample filters', () => {
  let fixture: ComponentFixture<MaintenancePage>;
  let view: MaintenanceView;

  beforeEach(async () => {
    const query = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: ROUTER_OUTLET_DATA, useValue: signal('Example Branch') },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: query }, queryParamMap: of(query) },
        },
      ],
    });
    fixture = TestBed.createComponent(MaintenancePage);
    await fixture.whenStable();
    view = fixture.debugElement.query(By.directive(MaintenanceView)).injector.get(MaintenanceView);
  });

  afterEach(() => {
    fixture.destroy();
  });

  const completedOn = (dueOn: string | null) =>
    dueOn ?? new Date(sampleNow - 30 * 86_400_000).toISOString().slice(0, 10);
  const completed = sampleServiceTasks.find((item) => item.status === 'DONE');
  if (!completed) {
    throw new Error('Missing completed service fixture.');
  }
  const cases = [
    {
      field: 'status',
      operator: 'isAnyOf',
      values: ['DONE'],
      expected: sampleServiceTasks.filter((item) => item.status === 'DONE'),
    },
    {
      field: 'serviceType',
      operator: 'isAnyOf',
      values: [completed.serviceType],
      expected: sampleServiceTasks.filter((item) => item.serviceType === completed.serviceType),
    },
    {
      field: 'vehicleStatus',
      operator: 'isAnyOf',
      values: ['INACTIVE'],
      expected: sampleServiceTasks.filter(
        (item) => vehicleById(item.vehicleId)?.status === 'INACTIVE',
      ),
    },
    {
      field: 'completedOn',
      operator: 'on',
      values: [completedOn(completed.dueOn)],
      expected: sampleServiceTasks.filter(
        (item) =>
          item.status === 'DONE' && completedOn(item.dueOn) === completedOn(completed.dueOn),
      ),
    },
  ] satisfies readonly (Omit<FilterCondition, 'id'> & {
    readonly expected: typeof sampleServiceTasks;
  })[];

  it.each(cases)('applies the shared $field filter to the sample tasks', async (testCase) => {
    expect(testCase.expected.length).toBeGreaterThan(0);
    expect(testCase.expected.length).toBeLessThan(sampleServiceTasks.length);
    view.stateChange.emit({
      ...view.state(),
      pageSize: 100,
      conditions: [
        {
          id: testCase.field,
          field: testCase.field,
          operator: testCase.operator,
          values: testCase.values,
        },
      ],
    });
    await fixture.whenStable();
    expect(view.total()).toBe(testCase.expected.length);
    expect(
      view
        .rows()
        .map((item) => item.id)
        .sort(),
    ).toEqual(testCase.expected.map((item) => item.id).sort());
  });
});
