import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { AdminServiceTaskDetailsFragment } from '../../../../generated/graphql/operations';
import { serviceEuroCents } from './service-money';
import {
  serviceCompletedForm,
  serviceCompletionFieldErrors,
  serviceCompletionInput,
  serviceTaskFieldErrors,
  serviceTaskForm,
  serviceTaskInput,
  serviceTaskRow,
  serviceTaskUpdateInput,
} from './service-task-mapping';
const task: AdminServiceTaskDetailsFragment = {
  id: '80000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: {
    id: '20000000-0000-4000-8000-000000000001',
    licensePlate: 'CB 1001 AX',
    status: 'ACTIVE',
  },
  serviceType: 'OIL_CHANGE',
  status: 'PLANNED',
  title: null,
  dueOn: null,
  dueOdometerKm: 0,
  completedOn: null,
  completedOdometerKm: null,
  workshop: null,
  replacedParts: null,
  costCents: null,
  notes: null,
  urgency: 'UNKNOWN_ODOMETER',
  remainingDays: null,
  remainingKm: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
describe('Maintenance contract mapping', () => {
  it('keeps real urgency and unknown values while localizing only untitled task labels', () => {
    expect(serviceTaskRow(task, 'bg')).toMatchObject({
      kind: 'Смяна на масло',
      dueKm: 0,
      kmLeft: null,
      urgency: 'UNKNOWN_ODOMETER',
      costCents: null,
    });
    expect(serviceTaskRow({ ...task, title: 'Warranty', costCents: 0 }, 'bg')).toMatchObject({
      kind: 'Warranty',
      costCents: 0,
    });
  });
  it('explicitly clears optional fields and never submits an immutable vehicle on update', () => {
    const form = { ...serviceTaskForm(task), workshop: '  ', notes: '\n', title: ' ' };
    expect(serviceTaskInput(form)).toEqual({
      vehicleId: task.vehicleId,
      serviceType: 'OIL_CHANGE',
      title: null,
      dueOn: null,
      dueOdometerKm: 0,
      workshop: null,
      notes: null,
    });
    expect(serviceTaskUpdateInput(form)).not.toHaveProperty('vehicleId');
  });
  it('converts decimal EUR strings into exact cents without rounding fractional cents', () => {
    expect(['0', '0.01', '0.29', '999999.19', '1000000'].map(serviceEuroCents)).toEqual([
      0, 1, 29, 99_999_919, 100_000_000,
    ]);
    for (const value of ['0.001', '-1', '1000000.01', 'NaN', '1e3']) {
      expect(serviceEuroCents(value)).toBeNull();
    }
  });
  it('maps actual completed receipts and does not fabricate a next-task schedule', () => {
    expect(serviceCompletedForm(task)).toBeNull();
    const receipt = serviceCompletedForm({
      ...task,
      status: 'DONE',
      completedOn: '2026-10-18',
      completedOdometerKm: 0,
      costCents: 0,
      workshop: 'Workshop',
      replacedParts: 'Filter',
      notes: 'Warranty',
    });
    expect(receipt).toEqual({
      completedOn: '2026-10-18',
      completedOdometerKm: 0,
      costCents: 0,
      workshop: 'Workshop',
      replacedParts: 'Filter',
      notes: 'Warranty',
      nextDueOn: null,
      nextDueOdometerKm: null,
      nextTitle: null,
    });
    if (!receipt) {
      throw new Error('Missing completed receipt.');
    }
    expect(
      serviceCompletionInput({ ...receipt, workshop: '  ', notes: '', nextTitle: 'Unused' }),
    ).toMatchObject({ costCents: 0, workshop: null, notes: null, nextTitle: null });
  });
  it('maps odometer and atomic next-task errors to their actual controls', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid service.',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [
              { path: 'dueOdometerKm', message: 'Invalid due odometer.' },
              { path: 'nextDueOn', message: 'Inactive vehicle.' },
              { path: 'nextDueOdometerKm', message: 'Inactive vehicle.' },
              { path: 'unknown', message: 'Ignore.' },
            ],
          },
        },
      ],
    });
    expect(serviceTaskFieldErrors(error)).toEqual({ dueKm: 'The value is not valid.' });
    expect(serviceCompletionFieldErrors(error)).toEqual({
      nextDueOn: 'The value is not valid.',
      nextDueOdometerKm: 'The value is not valid.',
    });
  });
});
