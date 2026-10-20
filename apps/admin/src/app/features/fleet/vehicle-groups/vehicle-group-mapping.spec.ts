import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { AdminVehicleGroupDetailsFragment } from '../../../../generated/graphql/operations';
import {
  vehicleGroupFieldErrors,
  vehicleGroupForm,
  vehicleGroupInput,
  vehicleGroupRow,
} from './vehicle-group-mapping';

const group: AdminVehicleGroupDetailsFragment = {
  id: '30000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
  name: 'Regional',
  description: null,
  colorToken: 'C8',
  vehicleCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Vehicle group mappings', () => {
  it('preserves an empty group count and the stored categorical colour', () => {
    expect(vehicleGroupRow(group)).toEqual({
      id: group.id,
      name: 'Regional',
      description: '',
      slot: 'c8',
      vehicles: 0,
    });
    expect(vehicleGroupForm(group)).toEqual({ name: 'Regional', description: '', slot: 'c8' });
  });

  it('normalizes full submissions and explicitly clears an empty description', () => {
    expect(vehicleGroupInput({ name: ' Regional ', description: ' ', slot: 'c8' })).toEqual({
      name: 'Regional',
      description: null,
      colorToken: 'C8',
    });
    expect(
      vehicleGroupInput({ name: 'New', description: ' Two lines\nretained ', slot: 'c1' })
        .description,
    ).toBe('Two lines\nretained');
    expect(() => vehicleGroupInput({ name: 'New', description: '', slot: 'invalid' })).toThrow(
      'Invalid vehicle group colour.',
    );
  });

  it('maps only editor field errors, including the generated colour name', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            fieldErrors: [
              { path: 'name', message: 'Duplicate group.' },
              { path: 'colorToken', message: 'Choose a colour.' },
              { path: 'unknown', message: 'Ignored.' },
            ],
          },
        },
      ],
    });
    expect(vehicleGroupFieldErrors(error)).toEqual({
      name: 'Duplicate group.',
      slot: 'Choose a colour.',
    });
  });
});
