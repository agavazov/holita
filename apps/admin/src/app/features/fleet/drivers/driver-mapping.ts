import type {
  AdminDriverDetailsFragment,
  AdminDriverScorecardQuery,
  CreateFleetDriverInput,
} from '../../../../generated/graphql/operations';
import { fieldErrors } from '../../../ui/forms/field-errors';
import type { DriverDetails, DriverField, DriverForm } from './driver-drawer';
import { maneuverKinds, type DriverScorecard } from './driver-scorecard-view';
import type { DriverRow } from './drivers-view';

export function driverDetails(driver: AdminDriverDetailsFragment): DriverDetails {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    name: `${driver.firstName} ${driver.lastName}`,
    employeeNo: driver.employeeNumber ?? '',
    identificationKey: driver.identificationKey ?? '',
    phone: driver.phone ?? '',
    email: driver.email ?? '',
    status: driver.status,
    licenseNumber: driver.licenseNumber ?? '',
    licenseCategories: driver.licenseCategories,
    licenseExpiresOn: driver.licenseExpiresOn,
    tachographCardNumber: driver.tachographCardNumber ?? '',
    tachoCardExpiresOn: driver.tachographCardExpiresOn,
    notes: driver.notes ?? '',
    vehiclePlate: driver.vehicles.length
      ? driver.vehicles.map((vehicle) => vehicle.licensePlate).join(', ')
      : null,
    score: driver.drivingScore30d,
    trips30d: driver.tripCount30d,
    distance30dKm: driver.distance30dKm,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

export function driverRow(driver: AdminDriverDetailsFragment): DriverRow {
  return { id: driver.id, ...driverDetails(driver) };
}

/** A complete form explicitly clears optional fields while preserving real employee identifiers. */
export function driverInput(form: DriverForm): CreateFleetDriverInput {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    employeeNumber: form.employeeNo.trim() || null,
    identificationKey: form.identificationKey.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    status: form.status,
    licenseNumber: form.licenseNumber.trim() || null,
    licenseCategories: [...form.licenseCategories],
    licenseExpiresOn: form.licenseExpiresOn,
    tachographCardNumber: form.tachographCardNumber.trim() || null,
    tachographCardExpiresOn: form.tachoCardExpiresOn,
    notes: form.notes.trim() || null,
  };
}

const fieldPaths = {
  firstName: 'firstName',
  lastName: 'lastName',
  employeeNumber: 'employeeNo',
  identificationKey: 'identificationKey',
  phone: 'phone',
  email: 'email',
  status: 'status',
  licenseNumber: 'licenseNumber',
  licenseCategories: 'licenseCategories',
  licenseExpiresOn: 'licenseExpiresOn',
  tachographCardNumber: 'tachographCardNumber',
  tachographCardExpiresOn: 'tachoCardExpiresOn',
  notes: 'notes',
} satisfies Record<keyof CreateFleetDriverInput, DriverField>;

export function driverFieldErrors(error: unknown): Partial<Record<DriverField, string>> {
  const errors = fieldErrors(error, Object.keys(fieldPaths));
  const result: Partial<Record<DriverField, string>> = {};
  for (const [path, field] of Object.entries(fieldPaths)) {
    const message = errors[path];
    if (message !== undefined) {
      result[field] = message;
    }
  }
  return result;
}

export function driverScorecard(
  value: AdminDriverScorecardQuery['fleetDriverScorecard'],
): DriverScorecard {
  return {
    ...value,
    name: `${value.driver.firstName} ${value.driver.lastName}`,
    employeeNo: value.driver.employeeNumber,
    maneuvers: value.maneuvers.flatMap((row) => {
      const kind = maneuverKinds.find((kind) => kind === row.kind);
      return kind ? [{ ...row, kind }] : [];
    }),
  };
}
