import {
  AdminCancelServiceTasksDocument,
  AdminCompleteServiceTaskDocument,
  AdminCreateServiceTaskDocument,
  AdminDeleteServiceTasksDocument,
  AdminServiceSummaryDocument,
  AdminServiceTaskDocument,
  AdminServiceTasksDocument,
  AdminServiceVehiclesDocument,
  AdminUpdateServiceTaskDocument,
  type AdminServiceTaskDetailsFragment,
  type AdminCompleteServiceTaskMutation,
} from '../generated/graphql/operations';
import { serviceTypes } from '../app/features/fleet/maintenance/service-task';
import {
  fixtureError,
  graphqlFixture,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';
export const fixtureServiceTask: WithTypename<AdminServiceTaskDetailsFragment> = {
  __typename: 'FleetServiceTask',
  id: '80000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  vehicleId: '50000000-0000-4000-8000-000000000001',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: '50000000-0000-4000-8000-000000000001',
    licensePlate: 'CB 1001 AX',
    status: 'ACTIVE',
  },
  serviceType: 'OIL_CHANGE',
  status: 'PLANNED',
  title: 'Oil change',
  dueOn: '2026-10-18',
  dueOdometerKm: 120000,
  completedOn: null,
  completedOdometerKm: null,
  workshop: 'Sofia workshop',
  replacedParts: null,
  costCents: null,
  notes: 'Use the approved oil.',
  urgency: 'OVERDUE',
  remainingDays: -1,
  remainingKm: -300,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
export const fixtureServiceReceipt: WithTypename<AdminServiceTaskDetailsFragment> = {
  ...fixtureServiceTask,
  id: '80000000-0000-4000-8000-000000000002',
  title: 'Warranty inspection',
  status: 'DONE',
  urgency: null,
  remainingDays: null,
  remainingKm: null,
  completedOn: '2026-10-17',
  completedOdometerKm: 119000,
  costCents: 0,
  workshop: 'Warranty workshop',
  replacedParts: 'Oil filter',
  notes: 'Covered by warranty.',
};
export const fixtureCancelledService: WithTypename<AdminServiceTaskDetailsFragment> = {
  ...fixtureServiceTask,
  id: '80000000-0000-4000-8000-000000000003',
  title: 'Cancelled inspection',
  status: 'CANCELLED',
  urgency: null,
  remainingDays: null,
  remainingKm: null,
};
export const fixtureInactiveService: WithTypename<AdminServiceTaskDetailsFragment> = {
  ...fixtureServiceTask,
  id: '80000000-0000-4000-8000-000000000004',
  title: 'Historical service',
  vehicleId: '50000000-0000-4000-8000-000000000002',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: '50000000-0000-4000-8000-000000000002',
    licensePlate: 'PB 2002 BT',
    status: 'INACTIVE',
  },
};
const tasks = [
  fixtureServiceTask,
  fixtureServiceReceipt,
  fixtureCancelledService,
  fixtureInactiveService,
];
function findTask(variables: FixtureVariables): WithTypename<AdminServiceTaskDetailsFragment> {
  const task = tasks.find((task) => task.id === variables.requiredString('id'));
  if (!task) {
    throw fixtureError('NOT_FOUND', 'The service task was not found.');
  }
  return task;
}
// Immutable read snapshots exercise real routes, transport and receipts. Refetch returns these
// records after writes; database/browser checks cover persistence, filtering and urgency rules.
graphqlFixture(AdminServiceTasksDocument, (variables) => ({
  fleetServiceTasks: {
    __typename: 'FleetServiceTaskPage',
    items: tasks,
    total: tasks.length,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));
graphqlFixture(AdminServiceTaskDocument, (variables) => ({
  fleetServiceTask: findTask(variables),
}));
graphqlFixture(AdminServiceSummaryDocument, () => ({
  fleetServiceSummary: {
    __typename: 'FleetServiceSummary',
    businessDate: '2026-10-19',
    overdue: 1,
    dueSoon: 0,
    unknownOdometer: 0,
    upcoming: 0,
    inWorkshopVehicles: 0,
    completedLast30Days: 1,
    costLast30DaysCents: 0,
    costWindowStart: '2026-09-20',
    costWindowEnd: '2026-10-19',
  },
}));
graphqlFixture(AdminServiceVehiclesDocument, (variables) => ({
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    items: [fixtureServiceTask.vehicle, fixtureInactiveService.vehicle].map((vehicle) => ({
      ...vehicle,
      __typename: 'FleetVehicle',
    })),
    total: 2,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));
function savedTask(variables: FixtureVariables): WithTypename<AdminServiceTaskDetailsFragment> {
  const base = variables.has('id')
    ? findTask(variables)
    : { ...fixtureServiceTask, id: '80000000-0000-4000-8000-000000000005' };
  if (base.status !== 'PLANNED') {
    throw fixtureError('CONFLICT', 'Only planned service tasks can be edited.');
  }
  const input = variables.object('input');
  const serviceType =
    serviceTypes.find((type) => type === input.string('serviceType')) ?? base.serviceType;
  return {
    ...base,
    title: input.string('title'),
    serviceType,
    dueOn: input.string('dueOn'),
    dueOdometerKm: input.integer('dueOdometerKm'),
    workshop: input.string('workshop'),
    notes: input.string('notes'),
  };
}
graphqlFixture(AdminCreateServiceTaskDocument, (variables) => ({
  createFleetServiceTask: savedTask(variables),
}));
graphqlFixture(AdminUpdateServiceTaskDocument, (variables) => ({
  updateFleetServiceTask: savedTask(variables),
}));
graphqlFixture(
  AdminCompleteServiceTaskDocument,
  (variables): WithTypename<AdminCompleteServiceTaskMutation> => {
    const task = findTask(variables);
    if (task.status !== 'PLANNED') {
      throw fixtureError('CONFLICT', 'The task is no longer planned.');
    }
    const input = variables.object('input');
    const nextDueOn = input.string('nextDueOn');
    const nextDueOdometerKm = input.integer('nextDueOdometerKm');
    const hasNext = nextDueOn !== null || nextDueOdometerKm !== null;
    if (hasNext && task.vehicle.status === 'INACTIVE') {
      throw fixtureError(
        'BAD_USER_INPUT',
        'Next service cannot be planned for an inactive vehicle.',
        [
          ...(nextDueOn ? [{ path: 'nextDueOn', message: 'The vehicle is inactive.' }] : []),
          ...(nextDueOdometerKm !== null
            ? [{ path: 'nextDueOdometerKm', message: 'The vehicle is inactive.' }]
            : []),
        ],
      );
    }
    const completed: WithTypename<AdminServiceTaskDetailsFragment> = {
      ...task,
      status: 'DONE',
      completedOn: input.requiredString('completedOn'),
      completedOdometerKm: input.integer('completedOdometerKm'),
      costCents: input.integer('costCents'),
      workshop: input.string('workshop'),
      replacedParts: input.string('replacedParts'),
      notes: input.string('notes'),
      urgency: null,
      remainingDays: null,
      remainingKm: null,
    };
    return {
      completeFleetServiceTask: {
        __typename: 'FleetServiceTaskCompletion',
        completed,
        next: hasNext
          ? {
              ...fixtureServiceTask,
              id: '80000000-0000-4000-8000-000000000006',
              title: input.string('nextTitle') ?? task.title,
              serviceType: task.serviceType,
              vehicleId: task.vehicleId,
              vehicle: task.vehicle,
              dueOn: nextDueOn,
              dueOdometerKm: nextDueOdometerKm,
              urgency: 'UPCOMING',
              remainingDays: null,
              remainingKm: null,
            }
          : null,
      },
    };
  },
);
function batch(variables: FixtureVariables, action: 'cancel' | 'delete') {
  const succeededIds: string[] = [];
  const failures: { id: string; code: string; message: string }[] = [];
  for (const id of variables.strings('ids') ?? []) {
    const task = tasks.find((task) => task.id === id);
    if (!task) {
      failures.push({ id, code: 'NOT_FOUND', message: 'The service task was not found.' });
    } else if (
      (action === 'cancel' && task.status !== 'PLANNED') ||
      (action === 'delete' && task.status === 'DONE')
    ) {
      failures.push({
        id,
        code: 'CONFLICT',
        message:
          action === 'cancel'
            ? 'Only planned service tasks can be cancelled.'
            : 'Completed service history cannot be deleted.',
      });
    } else {
      succeededIds.push(id);
    }
  }
  return { __typename: 'FleetServiceTaskActionResult', succeededIds, failures };
}
graphqlFixture(AdminCancelServiceTasksDocument, (variables) => ({
  cancelFleetServiceTasks: batch(variables, 'cancel'),
}));
graphqlFixture(AdminDeleteServiceTasksDocument, (variables) => ({
  deleteFleetServiceTasks: batch(variables, 'delete'),
}));
