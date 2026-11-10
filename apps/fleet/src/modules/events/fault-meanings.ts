import type { FleetFaultSystem } from '../../generated/graphql/types.js';

export const FAULT_CATALOG_VERSION = '2026-11-10.1';

type FaultMeaning = {
  systemKey: FleetFaultSystem;
  descriptionKey: string | null;
};

// Generic component associations, not manufacturer-specific diagnoses or lamp severity.
// Sources and applicability are recorded in docs/discocan/development.md#internal-unit-and-command-api.
const SPNS = new Map<number, FaultMeaning>([
  [100, { systemKey: 'ENGINE', descriptionKey: 'faults.spn.oilPressure' }],
  [110, { systemKey: 'ENGINE', descriptionKey: 'faults.spn.coolantTemperature' }],
  [111, { systemKey: 'ENGINE', descriptionKey: 'faults.spn.coolantLevel' }],
  [190, { systemKey: 'ENGINE', descriptionKey: 'faults.spn.engineSpeed' }],
  [789, { systemKey: 'ABS_EBS', descriptionKey: 'faults.spn.wheelSpeedSignal1' }],
  [790, { systemKey: 'ABS_EBS', descriptionKey: 'faults.spn.wheelSpeedSignal2' }],
  [1045, { systemKey: 'BRAKES', descriptionKey: 'faults.spn.brakeSwitch1' }],
  [1049, { systemKey: 'BRAKES', descriptionKey: 'faults.spn.axle1BrakePressure' }],
  [1247, { systemKey: 'ENGINE', descriptionKey: 'faults.spn.enginePower' }],
  [1761, { systemKey: 'AFTERTREATMENT', descriptionKey: 'faults.spn.defLevel' }],
  [3251, { systemKey: 'AFTERTREATMENT', descriptionKey: 'faults.spn.dpfPressureDifference' }],
  [4339, { systemKey: 'AFTERTREATMENT', descriptionKey: 'faults.spn.scrFeedbackControl' }],
  // Observed on CB1147TP; the retained ERM material supplies no supported meaning.
  [23806, { systemKey: 'OTHER', descriptionKey: null }],
]);

export function faultMeaning(
  spn: number | null,
  kind?: string,
): FaultMeaning & { catalogVersion: string } {
  const meaning: FaultMeaning | undefined =
    kind === 'CAN_DISCONNECTED' || kind === 'CAN_ERROR'
      ? { systemKey: 'CAN_BUS', descriptionKey: null }
      : spn === null
        ? undefined
        : SPNS.get(spn);
  return {
    ...(meaning ?? { systemKey: 'OTHER', descriptionKey: null }),
    catalogVersion: FAULT_CATALOG_VERSION,
  };
}
