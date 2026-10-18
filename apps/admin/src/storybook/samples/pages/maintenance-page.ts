import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { maintenanceText } from '../../../app/features/fleet/maintenance/i18n/messages';
import {
  type MaintenanceActionId,
  type MaintenanceKpis,
  MaintenanceView,
} from '../../../app/features/fleet/maintenance/maintenance-view';
import {
  ServiceTaskDrawer,
  type ServiceTaskForm,
} from '../../../app/features/fleet/maintenance/service-task-drawer';
import type { ServiceUrgency } from '../../../app/features/fleet/maintenance/service-task';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import type { TableNotice } from '../../../app/ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { fixtureBranches } from '../../session-fixtures';
import {
  type SampleServiceTask,
  sampleNow,
  sampleServiceTasks,
  sampleVehicles,
  vehicleById,
} from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { serviceTaskRow } from '../rows';
import { injectClearDrawer, injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

const day = 86_400_000;
const today = new Date(sampleNow).toISOString().slice(0, 10);
const soon = new Date(sampleNow + 14 * day).toISOString().slice(0, 10);
const urgencyRank = { OVERDUE: 0, DUE_SOON: 1, OK: 2, DONE: 3 } as const;

/** Due by date or odometer, whichever comes first (the backend rule the samples follow). */
function urgencyOf(task: Omit<SampleServiceTask, 'urgency'>): ServiceUrgency {
  if (task.status === 'DONE') return 'DONE';
  const odometer = vehicleById(task.vehicleId)?.odometerKm ?? 0;
  const kmLeft = task.dueKm === null ? null : task.dueKm - odometer;
  if ((task.dueOn !== null && task.dueOn < today) || (kmLeft !== null && kmLeft <= 0))
    return 'OVERDUE';
  if ((task.dueOn !== null && task.dueOn <= soon) || (kmLeft !== null && kmLeft <= 1500))
    return 'DUE_SOON';
  return 'OK';
}

const definition: SampleListDefinition<SampleServiceTask> = {
  search: (task) => [task.kind, vehicleById(task.vehicleId)?.plate ?? null, task.notes],
  columns: {
    urgency: (task) => task.urgency,
    vehicle: (task) => task.vehicleId,
    task: (task) => task.kind,
    dueOn: (task) => task.dueOn,
    cost: (task) => task.costEur,
  },
  sortColumns: {
    urgency: (task) => urgencyRank[task.urgency],
    vehicle: (task) => vehicleById(task.vehicleId)?.plate ?? null,
  },
};

function kpisOf(tasks: readonly SampleServiceTask[]): MaintenanceKpis {
  return {
    overdue: tasks.filter((task) => task.urgency === 'OVERDUE').length,
    dueSoon: tasks.filter((task) => task.urgency === 'DUE_SOON').length,
    planned: tasks.filter((task) => task.status === 'PLANNED').length,
    costCents: tasks.reduce((sum, task) => sum + (task.costEur ?? 0) * 100, 0),
  };
}

function toForm(task: SampleServiceTask): ServiceTaskForm {
  return {
    kind: task.kind,
    vehicleId: task.vehicleId,
    dueOn: task.dueOn,
    dueKm: task.dueKm,
    costCents: task.costEur === null ? null : task.costEur * 100,
    notes: task.notes,
    done: task.status === 'DONE',
  };
}

/**
 * Story-only host of the Maintenance example: sample service tasks, a simulated save that
 * recomputes the urgency, and `?scenario=` / `?drawer=<id|new>` for the stories' states.
 */
@Component({
  selector: 'holita-example-maintenance-page',
  imports: [MaintenanceView, ServiceTaskDrawer],
  template: `
    <holita-maintenance-view
      [branchName]="branchName"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [vehicles]="vehicles"
      [selection]="selection()"
      [notice]="notice()"
      (stateChange)="state.set($event)"
      (create)="openEditor(null)"
      (action)="run($event)"
      (selectionChange)="selection.set($event)"
      (retry)="failed.set(false)"
      (dismissNotice)="notice.set(null)"
    />
    @if (editor(); as open) {
      <holita-service-task-drawer
        [task]="open.form"
        [vehicles]="vehicles"
        [saving]="saving()"
        [saveError]="saveError()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
  `,
})
export class MaintenancePage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => maintenanceText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly branchName = fixtureBranches[0].name;
  protected readonly vehicles = sampleVehicles.map((vehicle) => ({
    id: vehicle.id,
    name: `${vehicle.plate} · ${vehicle.make} ${vehicle.model}`,
  }));
  protected readonly tasks = linkedSignal<readonly SampleServiceTask[]>(() =>
    this.scenario() === 'empty' ? [] : sampleServiceTasks,
  );
  protected readonly state = signal<ListQuery>(
    initialQuery({ field: 'urgency', direction: 'asc' }),
  );
  protected readonly selection = signal<readonly ListRecord<MaintenanceActionId>[]>([]);
  protected readonly notice = signal<TableNotice | null>(null);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  protected readonly editor = linkedSignal<{
    id: string | null;
    form: ServiceTaskForm | null;
  } | null>(() => {
    const drawer = this.query().get('drawer');
    if (drawer === 'new') return { id: null, form: null };
    const task = drawer ? sampleServiceTasks.find((item) => item.id === drawer) : undefined;
    return task ? { id: task.id, form: toForm(task) } : null;
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly result = computed(() => runSampleList(this.tasks(), definition, this.state()));
  protected readonly rows = computed(() => this.result().items.map(serviceTaskRow));
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed() ? null : kpisOf(this.tasks()),
  );
  protected readonly view = computed(() =>
    sampleTableView(this.state(), this.rows().length, {
      loading: this.scenario() === 'loading',
      failed: this.failed(),
    }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  protected openEditor(id: string | null): void {
    const task = id ? this.tasks().find((item) => item.id === id) : undefined;
    this.saveError.set(null);
    this.editor.set({ id: task?.id ?? null, form: task ? toForm(task) : null });
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.clearDrawer();
  }

  /** Row and bulk actions alike: the view already confirmed them and left out other records. */
  protected run({ action, ids }: ListActionRequest<MaintenanceActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'edit':
        if (id) this.openEditor(id);
        return;
      case 'complete':
        this.complete(ids);
        return;
      case 'vehicle': {
        const task = this.tasks().find((item) => item.id === id);
        if (task) void this.router.navigate(['/examples/vehicles', task.vehicleId]);
        return;
      }
      case 'delete':
        this.delete(ids);
        return;
    }
  }

  protected save(form: ServiceTaskForm): void {
    const editor = this.editor();
    if (!editor || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      if (this.failNextSave()) {
        this.failNextSave.set(false);
        this.saveError.set(this.text().drawer.saveError);
        return;
      }
      const fields = {
        vehicleId: form.vehicleId,
        kind: form.kind,
        dueOn: form.dueOn,
        dueKm: form.dueKm,
        status: form.done ? ('DONE' as const) : ('PLANNED' as const),
        costEur: form.costCents === null ? null : form.costCents / 100,
        notes: form.notes,
      };
      const id = editor.id ?? `example-task-${String(this.nextId++)}`;
      const task: SampleServiceTask = { id, ...fields, urgency: urgencyOf({ id, ...fields }) };
      this.tasks.update((tasks) =>
        editor.id ? tasks.map((item) => (item.id === id ? task : item)) : [task, ...tasks],
      );
      this.closeEditor();
      const template = editor.id ? this.text().notices.saved : this.text().notices.created;
      this.notice.set({ severity: 'success', text: interpolate(template, { task: form.kind }) });
    }, saveDelayMs);
  }

  private complete(ids: readonly string[]): void {
    this.tasks.update((tasks) =>
      tasks.map((item) =>
        ids.includes(item.id) ? { ...item, status: 'DONE', urgency: 'DONE' } : item,
      ),
    );
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.notice.set({
      severity: 'success',
      text: interpolate(this.text().notices.completed, { count: ids.length }),
    });
  }

  private delete(ids: readonly string[]): void {
    this.tasks.update((tasks) => tasks.filter((item) => !ids.includes(item.id)));
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.notice.set({
      severity: 'success',
      text: interpolate(this.text().notices.deleted, { count: ids.length }),
    });
  }
}
