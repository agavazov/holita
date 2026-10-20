import type {
  AdminServiceTaskDetailsFragment,
  AdminServiceSummaryQuery,
  CompleteFleetServiceTaskInput,
  CreateFleetServiceTaskInput,
  UpdateFleetServiceTaskInput,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { fieldErrors } from '../../../ui/forms/field-errors';
import { maintenanceText } from './i18n/messages';
import type { MaintenanceKpis } from './maintenance-view';
import type {
  ServiceCompletionField,
  ServiceCompletionForm,
  ServiceCompletionTask,
} from './service-completion-drawer';
import type { ServiceTaskRow } from './service-task';
import type { ServiceTaskField, ServiceTaskForm } from './service-task-drawer';
export function serviceTaskRow(
  task: AdminServiceTaskDetailsFragment,
  language: Language,
): ServiceTaskRow {
  return {
    id: task.id,
    vehicleId: task.vehicleId,
    plate: task.vehicle.licensePlate,
    kind: task.title ?? maintenanceText(language).serviceTypes[task.serviceType],
    serviceType: task.serviceType,
    status: task.status,
    dueOn: task.dueOn,
    dueKm: task.dueOdometerKm,
    kmLeft: task.remainingKm,
    urgency: task.urgency,
    costCents: task.costCents,
    notes: task.notes ?? '',
  };
}
export function serviceTaskForm(task: AdminServiceTaskDetailsFragment): ServiceTaskForm {
  return {
    serviceType: task.serviceType,
    title: task.title,
    vehicleId: task.vehicleId,
    dueOn: task.dueOn,
    dueKm: task.dueOdometerKm,
    workshop: task.workshop ?? '',
    notes: task.notes ?? '',
  };
}
export function serviceTaskInput(form: ServiceTaskForm): CreateFleetServiceTaskInput {
  return {
    vehicleId: form.vehicleId,
    serviceType: form.serviceType,
    title: form.title?.trim() || null,
    dueOn: form.dueOn,
    dueOdometerKm: form.dueKm,
    workshop: form.workshop.trim() || null,
    notes: form.notes.trim() || null,
  };
}
export function serviceTaskUpdateInput(form: ServiceTaskForm): UpdateFleetServiceTaskInput {
  return {
    serviceType: form.serviceType,
    title: form.title?.trim() || null,
    dueOn: form.dueOn,
    dueOdometerKm: form.dueKm,
    workshop: form.workshop.trim() || null,
    notes: form.notes.trim() || null,
  };
}
export function serviceCompletionTask(
  task: AdminServiceTaskDetailsFragment,
  language: Language,
): ServiceCompletionTask {
  return {
    kind: task.title ?? maintenanceText(language).serviceTypes[task.serviceType],
    plate: task.vehicle.licensePlate,
    workshop: task.workshop ?? '',
    notes: task.notes ?? '',
  };
}
export function serviceCompletedForm(
  task: AdminServiceTaskDetailsFragment,
): ServiceCompletionForm | null {
  if (task.status !== 'DONE' || task.completedOn === null) {
    return null;
  }
  return {
    completedOn: task.completedOn,
    completedOdometerKm: task.completedOdometerKm,
    costCents: task.costCents,
    workshop: task.workshop ?? '',
    replacedParts: task.replacedParts ?? '',
    notes: task.notes ?? '',
    nextDueOn: null,
    nextDueOdometerKm: null,
    nextTitle: null,
  };
}
export function serviceCompletionInput(form: ServiceCompletionForm): CompleteFleetServiceTaskInput {
  const hasNext = form.nextDueOn !== null || form.nextDueOdometerKm !== null;
  return {
    completedOn: form.completedOn,
    completedOdometerKm: form.completedOdometerKm,
    costCents: form.costCents,
    workshop: form.workshop.trim() || null,
    replacedParts: form.replacedParts.trim() || null,
    notes: form.notes.trim() || null,
    nextDueOn: form.nextDueOn,
    nextDueOdometerKm: form.nextDueOdometerKm,
    nextTitle: hasNext ? form.nextTitle?.trim() || null : null,
  };
}
export function maintenanceKpis(
  summary: AdminServiceSummaryQuery['fleetServiceSummary'],
): MaintenanceKpis {
  return {
    overdue: summary.overdue,
    dueSoon: summary.dueSoon,
    planned: summary.overdue + summary.dueSoon + summary.unknownOdometer + summary.upcoming,
    costCents: summary.costLast30DaysCents,
  };
}
const taskPaths = {
  serviceType: 'serviceType',
  title: 'title',
  vehicleId: 'vehicleId',
  dueOn: 'dueOn',
  dueOdometerKm: 'dueKm',
  workshop: 'workshop',
  notes: 'notes',
} satisfies Record<keyof CreateFleetServiceTaskInput, ServiceTaskField>;
export function serviceTaskFieldErrors(error: unknown): Partial<Record<ServiceTaskField, string>> {
  const errors = fieldErrors(error, Object.keys(taskPaths));
  const result: Partial<Record<ServiceTaskField, string>> = {};
  for (const [path, name] of Object.entries(taskPaths)) {
    const message = errors[path];
    if (message !== undefined) {
      result[name] = message;
    }
  }
  return result;
}
const completionFields: readonly ServiceCompletionField[] = [
  'completedOn',
  'completedOdometerKm',
  'costCents',
  'workshop',
  'replacedParts',
  'notes',
  'nextDueOn',
  'nextDueOdometerKm',
  'nextTitle',
];
export function serviceCompletionFieldErrors(
  error: unknown,
): Partial<Record<ServiceCompletionField, string>> {
  return fieldErrors(error, completionFields);
}
