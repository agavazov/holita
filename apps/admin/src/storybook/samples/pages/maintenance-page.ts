import { sampleRecordLinks } from '../record-links';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
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
import {
  ServiceCompletionDrawer,
  type ServiceCompletionField,
  type ServiceCompletionForm,
  type ServiceCompletionTask,
} from '../../../app/features/fleet/maintenance/service-completion-drawer';
import type { ServiceUrgency } from '../../../app/features/fleet/maintenance/service-task';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
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
import {
  injectBranchName,
  injectClearDrawer,
  injectQueryParams,
  saveDelayMs,
  scenarioOf,
} from '../scenario';

const day = 86_400_000;
const today = new Date(sampleNow).toISOString().slice(0, 10);
const soon = new Date(sampleNow + 14 * day).toISOString().slice(0, 10);
const urgencyRank = { OVERDUE: 0, DUE_SOON: 1, UNKNOWN_ODOMETER: 2, UPCOMING: 3 } as const;

interface MaintenanceSampleTask extends SampleServiceTask {
  readonly completion?: ServiceCompletionForm;
}

/** Completion fixtures stay here; the shared sample generator has no service history. */
const initialTasks: readonly MaintenanceSampleTask[] = sampleServiceTasks.map((task) =>
  task.status === 'DONE'
    ? {
        ...task,
        completion: {
          completedOn: task.dueOn ?? new Date(sampleNow - 30 * day).toISOString().slice(0, 10),
          completedOdometerKm: null,
          costCents: task.costEur === null ? null : task.costEur * 100,
          workshop: '',
          replacedParts: '',
          notes: task.notes,
          nextDueOn: null,
          nextDueOdometerKm: null,
          nextTitle: null,
        },
      }
    : task,
);

/** Due by date or odometer, whichever comes first (the backend rule the samples follow). */
function urgencyOf(
  task: Omit<SampleServiceTask, 'urgency'>,
  odometer = vehicleById(task.vehicleId)?.odometerKm ?? null,
): ServiceUrgency | null {
  if (task.status !== 'PLANNED') {
    return null;
  }
  const kmLeft = task.dueKm === null || odometer === null ? null : task.dueKm - odometer;
  if ((task.dueOn !== null && task.dueOn < today) || (kmLeft !== null && kmLeft <= 0)) {
    return 'OVERDUE';
  }
  if ((task.dueOn !== null && task.dueOn <= soon) || (kmLeft !== null && kmLeft <= 1500)) {
    return 'DUE_SOON';
  }
  return task.dueKm !== null && odometer === null ? 'UNKNOWN_ODOMETER' : 'UPCOMING';
}

const definition: SampleListDefinition<MaintenanceSampleTask> = {
  id: (task) => task.id,
  search: (task) => [
    task.kind,
    vehicleById(task.vehicleId)?.plate ?? null,
    task.workshop,
    task.notes,
  ],
  columns: {
    urgency: (task) => task.urgency,
    vehicle: (task) => task.vehicleId,
    status: (task) => task.status,
    serviceType: (task) => task.serviceType,
    vehicleStatus: (task) => vehicleById(task.vehicleId)?.status ?? null,
    task: (task) => task.kind,
    dueOn: (task) => task.dueOn,
    completedOn: (task) => task.completion?.completedOn ?? null,
    cost: (task) => task.costEur,
  },
  sortColumns: {
    urgency: (task) => (task.urgency ? urgencyRank[task.urgency] : null),
    vehicle: (task) => vehicleById(task.vehicleId)?.plate ?? null,
    createdAt: (task) => task.createdAt,
  },
  secondarySorts: {
    urgency: [
      { value: (task) => task.dueOn, direction: 'asc' },
      {
        value: (task) => {
          const odometer = vehicleById(task.vehicleId)?.odometerKm ?? null;
          return task.status !== 'PLANNED' || task.dueKm === null || odometer === null
            ? null
            : Math.round(task.dueKm - odometer);
        },
        direction: 'asc',
      },
    ],
  },
};

function kpisOf(tasks: readonly MaintenanceSampleTask[]): MaintenanceKpis {
  const planned = tasks.filter(
    (task) => task.status === 'PLANNED' && vehicleById(task.vehicleId)?.status !== 'INACTIVE',
  );
  const costFrom = new Date(sampleNow - 29 * day).toISOString().slice(0, 10);
  return {
    overdue: planned.filter((task) => task.urgency === 'OVERDUE').length,
    dueSoon: planned.filter((task) => task.urgency === 'DUE_SOON').length,
    planned: planned.length,
    costCents: tasks.reduce(
      (sum, task) =>
        task.completion &&
        task.completion.completedOn >= costFrom &&
        task.completion.completedOn <= today
          ? sum + (task.completion.costCents ?? 0)
          : sum,
      0,
    ),
  };
}

function toForm(task: SampleServiceTask): ServiceTaskForm {
  return {
    serviceType: task.serviceType,
    title: task.title,
    vehicleId: task.vehicleId,
    dueOn: task.dueOn,
    dueKm: task.dueKm,
    workshop: task.workshop,
    notes: task.notes,
  };
}

/**
 * Story-only host of the Maintenance example: sample service tasks, a simulated save that
 * recomputes urgency, plus completion with an optional next task in one simulated save.
 */
@Component({
  selector: 'holita-example-maintenance-page',
  imports: [MaintenanceView, ServiceTaskDrawer, ServiceCompletionDrawer],
  template: `
    <holita-maintenance-view
      [recordLinks]="recordLinks"
      [branchName]="branchName()"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [vehicles]="vehicles"
      [selection]="selection()"
      (stateChange)="state.set($event)"
      (create)="openEditor(null)"
      (action)="run($event)"
      (selectionChange)="selection.set($event)"
      (retry)="failed.set(false)"
    />
    @if (editor(); as open) {
      <holita-service-task-drawer
        [recordLinks]="recordLinks"
        [task]="open.form"
        [readOnly]="open.readOnly"
        [vehicles]="open.form ? vehicles : serviceableVehicles"
        [saving]="saving()"
        [saveError]="saveError()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
    @if (completion(); as open) {
      <holita-service-completion-drawer
        [vehicleLink]="completionVehicleLink()"
        [task]="open.task"
        [completed]="open.completed"
        [allowNext]="allowNext()"
        [businessDate]="businessDate"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="completionErrors()"
        (save)="complete($event)"
        (closed)="closeEditor()"
      />
    }
  `,
})
export class MaintenancePage {
  protected readonly recordLinks = sampleRecordLinks;
  private readonly taskDrawer = viewChild(ServiceTaskDrawer);
  private readonly completionDrawer = viewChild(ServiceCompletionDrawer);
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), [
      'loading',
      'empty',
      'error',
      'save-error',
      'completion-error',
      'earlier-service',
      'no-odometer',
    ]),
  );
  private readonly text = computed(() => maintenanceText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly branchName = injectBranchName();
  protected readonly businessDate = today;
  protected readonly vehicles = sampleVehicles.map((vehicle) => ({
    id: vehicle.id,
    name: `${vehicle.plate} · ${vehicle.make} ${vehicle.model}`,
  }));
  protected readonly serviceableVehicles = this.vehicles.filter(
    (option) => vehicleById(option.id)?.status !== 'INACTIVE',
  );
  protected readonly tasks = linkedSignal<readonly MaintenanceSampleTask[]>(() => {
    if (this.scenario() === 'empty') {
      return [];
    }
    if (this.scenario() === 'no-odometer') {
      return initialTasks.map((task) => ({ ...task, urgency: urgencyOf(task, null) }));
    }
    if (this.scenario() !== 'earlier-service') {
      return initialTasks;
    }
    const task = initialTasks.find((item) => item.id === 's001');
    if (!task) {
      throw new Error('Missing earlier service fixture.');
    }
    return [
      ...initialTasks,
      {
        ...task,
        id: 'example-earlier-service',
        status: 'DONE',
        urgency: null,
        completion: {
          completedOn: '2026-10-17',
          completedOdometerKm: 130000,
          costCents: null,
          workshop: '',
          replacedParts: '',
          notes: '',
          nextDueOn: null,
          nextDueOdometerKm: null,
          nextTitle: null,
        },
      },
    ];
  });
  protected readonly state = signal<ListQuery>(
    initialQuery({ field: 'urgency', direction: 'asc' }),
  );
  protected readonly selection = signal<readonly ListRecord<MaintenanceActionId>[]>([]);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() =>
    ['save-error', 'completion-error'].includes(this.scenario()),
  );
  protected readonly editor = linkedSignal<{
    id: string | null;
    form: ServiceTaskForm | null;
    readOnly: boolean;
  } | null>(() => {
    const drawer = this.query().get('drawer');
    if (drawer === 'new') {
      return { id: null, form: null, readOnly: false };
    }
    const task = drawer ? sampleServiceTasks.find((item) => item.id === drawer) : undefined;
    return task?.status === 'PLANNED' || task?.status === 'CANCELLED'
      ? { id: task.id, form: toForm(task), readOnly: task.status === 'CANCELLED' }
      : null;
  });
  protected readonly completion = linkedSignal<{
    id: string;
    task: ServiceCompletionTask;
    completed: ServiceCompletionForm | null;
  } | null>(() => {
    const drawer = this.query().get('drawer');
    const id = drawer?.startsWith('complete-') ? drawer.slice('complete-'.length) : null;
    const task = initialTasks.find((item) => item.id === id);
    return task
      ? { id: task.id, task: this.completionTask(task), completed: task.completion ?? null }
      : null;
  });
  protected readonly completionErrors = signal<Partial<Record<ServiceCompletionField, string>>>({});
  protected readonly completionVehicleLink = computed(() => {
    const task = this.tasks().find((task) => task.id === this.completion()?.id);
    return task ? this.recordLinks.vehicle(task.vehicleId) : null;
  });
  protected readonly allowNext = computed(() => {
    const task = this.tasks().find((item) => item.id === this.completion()?.id);
    const vehicle = task ? vehicleById(task.vehicleId) : undefined;
    return vehicle !== undefined && vehicle.status !== 'INACTIVE';
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly result = computed(() => runSampleList(this.tasks(), definition, this.state()));
  protected readonly rows = computed(() =>
    this.result().items.map((task) => {
      const row = serviceTaskRow(task);
      return this.scenario() === 'no-odometer' ? { ...row, kmLeft: null } : row;
    }),
  );
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
    this.completion.set(null);
    this.editor.set({
      id: task?.id ?? null,
      form: task ? toForm(task) : null,
      readOnly: task?.status === 'CANCELLED',
    });
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.completion.set(null);
    this.clearDrawer();
  }

  /** Row and bulk actions alike: the view already confirmed them and left out other records. */
  protected run({ action, ids }: ListActionRequest<MaintenanceActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'edit':
        if (id) {
          this.openEditor(id);
        }
        return;
      case 'complete':
        if (id) {
          this.openCompletion(id);
        }
        return;
      case 'view':
        if (id) {
          const task = this.tasks().find((item) => item.id === id);
          if (task?.status === 'CANCELLED') {
            this.openEditor(id);
          } else {
            this.openCompletion(id);
          }
        }
        return;
      case 'cancel':
        this.cancel(ids);
        return;
      case 'vehicle': {
        const task = this.tasks().find((item) => item.id === id);
        if (task) {
          void this.router.navigate(['/examples/vehicles', task.vehicleId]);
        }
        return;
      }
      case 'delete':
        this.delete(ids);
        return;
    }
  }

  protected save(form: ServiceTaskForm): void {
    const editor = this.editor();
    if (!editor || editor.readOnly || this.saving()) {
      return;
    }
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
        vehicleId: editor.form?.vehicleId ?? form.vehicleId,
        serviceType: form.serviceType,
        title: form.title,
        kind: form.title ?? this.text().serviceTypes[form.serviceType],
        workshop: form.workshop,
        dueOn: form.dueOn,
        dueKm: form.dueKm,
        status: 'PLANNED' as const,
        costEur: null,
        notes: form.notes,
        createdAt: editor.id
          ? (this.tasks().find((task) => task.id === editor.id)?.createdAt ??
            new Date(sampleNow).toISOString())
          : new Date(sampleNow).toISOString(),
      };
      const id = editor.id ?? `example-task-${String(this.nextId++)}`;
      const task: SampleServiceTask = { id, ...fields, urgency: this.urgency({ id, ...fields }) };
      this.tasks.update((tasks) =>
        editor.id
          ? tasks.map((item) => (item.id === id ? { ...item, ...task } : item))
          : [task, ...tasks],
      );
      this.closeEditor();
      const template = editor.id ? this.text().notices.saved : this.text().notices.created;
      this.messages.add({
        severity: 'success',
        summary: interpolate(template, { task: task.kind }),
      });
    }, saveDelayMs);
  }

  private openCompletion(id: string): void {
    const task = this.tasks().find((item) => item.id === id);
    if (!task) {
      return;
    }
    this.editor.set(null);
    this.saveError.set(null);
    this.completionErrors.set({});
    this.completion.set({
      id,
      task: this.completionTask(task),
      completed: task.completion ?? null,
    });
  }

  protected complete(form: ServiceCompletionForm): void {
    const open = this.completion();
    if (!open || open.completed || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.completionErrors.set({});
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      if (this.failNextSave()) {
        this.failNextSave.set(false);
        this.saveError.set(this.text().completion.saveError);
        return;
      }
      const stored = this.tasks().find((task) => task.id === open.id);
      if (!stored) {
        return;
      }
      const hasNext = form.nextDueOn !== null || form.nextDueOdometerKm !== null;
      if (hasNext && vehicleById(stored.vehicleId)?.status === 'INACTIVE') {
        this.completionErrors.set({
          ...(form.nextDueOn === null ? {} : { nextDueOn: this.text().completion.inactiveNext }),
          ...(form.nextDueOdometerKm === null
            ? {}
            : { nextDueOdometerKm: this.text().completion.inactiveNext }),
        });
        this.saveError.set(this.text().completion.inactiveNext);
        return;
      }
      const earlierOdometers = this.tasks().flatMap((task) => {
        const completion = task.completion;
        return task.vehicleId === stored.vehicleId &&
          completion &&
          completion.completedOn < form.completedOn &&
          completion.completedOdometerKm !== null
          ? [completion.completedOdometerKm]
          : [];
      });
      if (
        form.completedOdometerKm !== null &&
        earlierOdometers.some(
          (km) => form.completedOdometerKm !== null && km > form.completedOdometerKm,
        )
      ) {
        this.completionErrors.set({
          completedOdometerKm: this.text().completion.earlierOdometerError,
        });
        return;
      }
      this.tasks.update((tasks) => {
        const completed = tasks.map((task): MaintenanceSampleTask =>
          task.id === open.id
            ? {
                ...task,
                status: 'DONE',
                urgency: null,
                completion: form,
                workshop: form.workshop,
                costEur: form.costCents === null ? null : form.costCents / 100,
                notes: form.notes,
              }
            : task,
        );
        if (!hasNext) {
          return completed;
        }
        const next = {
          id: `example-task-${String(this.nextId++)}`,
          vehicleId: stored.vehicleId,
          serviceType: stored.serviceType,
          title: form.nextTitle ?? stored.title,
          kind: form.nextTitle ?? stored.kind,
          dueOn: form.nextDueOn,
          dueKm: form.nextDueOdometerKm,
          status: 'PLANNED' as const,
          workshop: form.workshop,
          costEur: null,
          notes: '',
          createdAt: new Date(sampleNow).toISOString(),
        };
        return [{ ...next, urgency: this.urgency(next) }, ...completed];
      });
      this.selection.update((selection) => selection.filter((record) => record.id !== open.id));
      this.closeEditor();
      this.messages.add({
        severity: 'success',
        summary: interpolate(
          hasNext ? this.text().notices.completedAndPlanned : this.text().notices.completed,
          { task: stored.kind },
        ),
      });
    }, saveDelayMs);
  }

  private completionTask(task: MaintenanceSampleTask): ServiceCompletionTask {
    return {
      kind: task.kind,
      plate: vehicleById(task.vehicleId)?.plate ?? '—',
      workshop: task.workshop,
      notes: task.notes,
    };
  }

  private delete(ids: readonly string[]): void {
    this.tasks.update((tasks) => tasks.filter((item) => !ids.includes(item.id)));
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.messages.add({
      severity: 'success',
      summary: interpolate(this.text().notices.deleted, { count: ids.length }),
    });
  }

  private cancel(ids: readonly string[]): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        ids.includes(task.id) ? { ...task, status: 'CANCELLED', urgency: null } : task,
      ),
    );
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.messages.add({
      severity: 'success',
      summary: interpolate(this.text().notices.cancelled, { count: ids.length }),
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.saving()
      ? false
      : (this.taskDrawer()?.canLeave() ?? this.completionDrawer()?.canLeave() ?? true);
  }

  private urgency(task: Omit<SampleServiceTask, 'urgency'>): ServiceUrgency | null {
    return this.scenario() === 'no-odometer' ? urgencyOf(task, null) : urgencyOf(task);
  }
}
