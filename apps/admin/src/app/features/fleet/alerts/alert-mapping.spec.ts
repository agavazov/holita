import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { AdminAlertDetailsFragment } from '../../../../generated/graphql/operations';
import { alertRemarkError, alertRow } from './alert-mapping';
const event: AdminAlertDetailsFragment = {
  id: '60000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
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
  remark: null,
  acknowledgedAt: null,
  resolvedAt: null,
  address: null,
  measuredValue: 0,
  thresholdValue: 12,
  measurementUnit: 'PERCENT',
  troubleCode: null,
};
describe('Alert mappings', () => {
  it('localizes the generated event kind without inventing a driver, detail or remark', () => {
    expect(alertRow(event, 'en')).toMatchObject({
      kind: 'Low fuel',
      status: 'OPEN',
      driverId: null,
      driverName: null,
      detail: '',
      remark: '',
    });
    expect(alertRow(event, 'bg')?.kind).toBe('Ниско ниво на гориво');
    expect(
      alertRow(
        {
          ...event,
          driverId: '40000000-0000-4000-8000-000000000001',
          driver: {
            id: '40000000-0000-4000-8000-000000000001',
            firstName: 'Elena',
            lastName: 'Petrova',
          },
        },
        'en',
      ),
    ).toMatchObject({
      driverId: '40000000-0000-4000-8000-000000000001',
      driverName: 'Elena Petrova',
    });
  });
  it('keeps informational events out of actionable alert views', () => {
    expect(alertRow({ ...event, alertStatus: null }, 'en')).toBeNull();
  });
  it('maps the optional remark error without treating status conflicts as field errors', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            fieldErrors: [
              { path: 'remark', message: 'Too long.' },
              { path: 'expectedStatus', message: 'Changed.' },
            ],
          },
        },
      ],
    });
    expect(alertRemarkError(error)).toBe('Too long.');
    expect(alertRemarkError(new Error('Conflict'))).toBeNull();
  });
});
