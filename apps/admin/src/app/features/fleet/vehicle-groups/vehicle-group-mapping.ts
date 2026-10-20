import type {
  AdminVehicleGroupDetailsFragment,
  CreateFleetVehicleGroupInput,
  FleetGroupColor,
} from '../../../../generated/graphql/operations';
import { fieldErrors } from '../../../ui/forms/field-errors';
import type { GroupField, GroupForm } from '../settings/group-drawer';
import type { GroupRow } from '../settings/groups-view';

const colors = [
  { slot: 'c1', value: 'C1' },
  { slot: 'c2', value: 'C2' },
  { slot: 'c3', value: 'C3' },
  { slot: 'c4', value: 'C4' },
  { slot: 'c5', value: 'C5' },
  { slot: 'c6', value: 'C6' },
  { slot: 'c7', value: 'C7' },
  { slot: 'c8', value: 'C8' },
] satisfies readonly { readonly slot: string; readonly value: FleetGroupColor }[];

export function vehicleGroupRow(group: AdminVehicleGroupDetailsFragment): GroupRow {
  return {
    id: group.id,
    name: group.name,
    slot: group.colorToken.toLowerCase(),
    description: group.description ?? '',
    vehicles: group.vehicleCount,
  };
}

export function vehicleGroupForm(group: AdminVehicleGroupDetailsFragment): GroupForm {
  return {
    name: group.name,
    slot: group.colorToken.toLowerCase(),
    description: group.description ?? '',
  };
}

export function vehicleGroupInput(form: GroupForm): CreateFleetVehicleGroupInput {
  const colorToken = colors.find((color) => color.slot === form.slot)?.value;
  if (!colorToken) {
    throw new Error('Invalid vehicle group colour.');
  }
  return { name: form.name.trim(), description: form.description.trim() || null, colorToken };
}

const fieldPaths = {
  name: 'name',
  description: 'description',
  colorToken: 'slot',
} satisfies Record<keyof CreateFleetVehicleGroupInput, GroupField>;

export function vehicleGroupFieldErrors(error: unknown): Partial<Record<GroupField, string>> {
  const errors = fieldErrors(error, Object.keys(fieldPaths));
  const result: Partial<Record<GroupField, string>> = {};
  for (const [path, field] of Object.entries(fieldPaths)) {
    const message = errors[path];
    if (message !== undefined) {
      result[field] = message;
    }
  }
  return result;
}
