import {
  AdminFleetPreferencesDocument,
  AdminUpdateBranchNameDocument,
  AdminUpdateFleetSettingsDocument,
  type AdminFleetSettingsFragment,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';

export const fixtureFleetSettings: WithTypename<AdminFleetSettingsFragment> = {
  __typename: 'FleetSettings',
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
};

// Reads stay immutable after writes, like the other live-container fixtures. The returned
// canonical write result exercises the form; real persistence belongs to DB/browser checks.
graphqlFixture(AdminFleetPreferencesDocument, () => ({ fleetSettings: fixtureFleetSettings }));
graphqlFixture(AdminUpdateFleetSettingsDocument, (variables) => {
  const input = variables.object('input');
  const distanceUnit = input.string('distanceUnit');
  const volumeUnit = input.string('volumeUnit');
  if (
    (distanceUnit !== 'KM' && distanceUnit !== 'MI') ||
    (volumeUnit !== 'LITRE' && volumeUnit !== 'US_GALLON')
  ) {
    throw fixtureError('BAD_USER_INPUT', 'Unsupported units.');
  }
  const saved: WithTypename<AdminFleetSettingsFragment> = {
    ...fixtureFleetSettings,
    timeZone: input.requiredString('timeZone'),
    distanceUnit,
    volumeUnit,
    lowFuelPct: input.int('lowFuelPct', fixtureFleetSettings.lowFuelPct),
    notReportingHours: input.int('notReportingHours', fixtureFleetSettings.notReportingHours),
    speedLimitKph: input.int('speedLimitKph', fixtureFleetSettings.speedLimitKph),
  };
  return { updateFleetSettings: saved };
});
graphqlFixture(AdminUpdateBranchNameDocument, (variables) => ({
  updateBranchName: {
    __typename: 'Branch',
    id: variables.requiredString('id'),
    name: variables.requiredString('name').trim(),
  },
}));
