import {
  AdminFleetScenarioDocument,
  type AdminFleetScenarioQuery,
  type FleetEvidenceFragment,
  type FleetScenarioMetricFragment,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';

type Scenario = WithTypename<AdminFleetScenarioQuery>['fleetScenario'];
const scenarioId = 'operational-day-v1';
const vehicleId = 'example-truck-01';

// Independent Storybook snapshots; the application never imports these examples.
function evidence(
  sourceRecordId: string,
  eventAt: string | null = null,
  origin: FleetEvidenceFragment['origin'] = 'ILLUSTRATIVE',
): WithTypename<FleetEvidenceFragment> {
  return {
    __typename: 'FleetEvidenceProvenance',
    origin,
    source: 'HOLITA_SCENARIO',
    scenarioId,
    sourceRecordId,
    eventAt,
    receivedAt: null,
    retrievedAt: '2026-10-21T06:05:00.000Z',
  };
}

function metric(
  sourceRecordId: string,
  value: number,
  unit: FleetScenarioMetricFragment['unit'],
): WithTypename<FleetScenarioMetricFragment> {
  return {
    __typename: 'FleetScenarioMetric',
    value,
    unit,
    availability: 'COMPLETE',
    availableInputs: 1,
    requiredInputs: 1,
    provenance: evidence(sourceRecordId),
  };
}

function position(
  id: string,
  tripId: string,
  eventAt: string,
  latitude: number,
  longitude: number,
): Scenario['positionSamples'][number] {
  return {
    __typename: 'FleetScenarioPositionSample',
    id,
    vehicleId,
    tripId,
    latitude,
    longitude,
    provenance: evidence(id, eventAt),
  };
}

const positionSamples: Scenario['positionSamples'] = [
  position('example-position-01', 'example-trip-01', '2026-10-20T06:00:00.000Z', 42.6907, 23.3383),
  position('example-position-02', 'example-trip-01', '2026-10-20T06:10:00.000Z', 42.6706, 23.37),
  position('example-position-03', 'example-trip-01', '2026-10-20T06:20:00.000Z', 42.6489, 23.3955),
  position('example-position-04', 'example-trip-01', '2026-10-20T06:40:00.000Z', 42.6006, 23.5943),
  position('example-position-05', 'example-trip-01', '2026-10-20T07:00:00.000Z', 42.556, 23.6973),
  position('example-position-06', 'example-trip-02', '2026-10-20T12:00:00.000Z', 42.556, 23.6973),
  position('example-position-07', 'example-trip-02', '2026-10-20T12:30:00.000Z', 42.6006, 23.5943),
  position('example-position-08', 'example-trip-02', '2026-10-20T13:00:00.000Z', 42.6907, 23.3383),
];

function signal(
  point: Scenario['positionSamples'][number],
  kind: Scenario['signalSamples'][number]['signal'],
  value: number | null,
  unit: Scenario['signalSamples'][number]['unit'],
): Scenario['signalSamples'][number] {
  const id = `${point.id}-${kind.toLowerCase()}`;
  return {
    __typename: 'FleetScenarioSignalSample',
    id,
    vehicleId,
    tripId: point.tripId,
    positionSampleId: point.id,
    signal: kind,
    value,
    unit,
    availability: value === null ? 'UNAVAILABLE' : 'COMPLETE',
    provenance: evidence(
      id,
      point.provenance.eventAt,
      value === null ? 'UNAVAILABLE' : 'ILLUSTRATIVE',
    ),
  };
}

const speeds = [0, 52, 70, 64, 0, 0, 60, 0];
const temperatures = [82, 88, 93, 98, 101, 86, 90, 87];
const voltages = [27.8, 27.7, 27.6, null, 27.5, 27.8, 27.6, 27.7];
const fuelUsed = [4200, 4201.6, 4204, 2.1, 4.8, 4.8, 9.2, 16];
const distances = [125000, 125006, 125014, 125032, 125042.5, 125042.5, 125058.3, 125083.5];
const engineHours = [6200, 6200.166667, 6200.333333, 6200.666667, 6201, 6201, 6201.5, 6202];

export const fixtureScenario: Scenario = {
  __typename: 'FleetScenario',
  id: scenarioId,
  branchId: defaultBranchId,
  exampleClock: '2026-10-21T06:00:00.000Z',
  period: {
    __typename: 'FleetEvidencePeriod',
    from: '2026-10-19T21:00:00.000Z',
    toExclusive: '2026-10-20T21:00:00.000Z',
    timeZone: 'Europe/Sofia',
  },
  provenance: evidence(scenarioId),
  coverage: {
    __typename: 'FleetScenarioCoverage',
    retrieval: 'COMPLETE',
    positionCoverage: 'PARTIAL',
    positionsLoaded: positionSamples.length,
    gaps: [
      {
        __typename: 'FleetScenarioGap',
        from: '2026-10-20T06:20:00.000Z',
        toExclusive: '2026-10-20T06:40:00.000Z',
      },
    ],
  },
  vehicles: [
    {
      __typename: 'FleetScenarioVehicle',
      id: vehicleId,
      label: 'EXAMPLE TRUCK 01',
      provenance: evidence(vehicleId),
    },
  ],
  trips: [
    {
      __typename: 'FleetScenarioTrip',
      id: 'example-trip-01',
      vehicleId,
      startedAt: '2026-10-20T06:00:00.000Z',
      stoppedAt: '2026-10-20T07:00:00.000Z',
      startPositionId: 'example-position-01',
      stopPositionId: 'example-position-05',
      distance: metric('example-trip-01', 42.5, 'KILOMETRE'),
      nightDistance: metric('example-trip-01', 0, 'KILOMETRE'),
      maximumSpeed: metric('example-trip-01', 70, 'KILOMETRES_PER_HOUR'),
      provenance: evidence('example-trip-01', '2026-10-20T06:00:00.000Z'),
    },
    {
      __typename: 'FleetScenarioTrip',
      id: 'example-trip-02',
      vehicleId,
      startedAt: '2026-10-20T12:00:00.000Z',
      stoppedAt: '2026-10-20T13:00:00.000Z',
      startPositionId: 'example-position-06',
      stopPositionId: 'example-position-08',
      distance: metric('example-trip-02', 41, 'KILOMETRE'),
      nightDistance: metric('example-trip-02', 0, 'KILOMETRE'),
      maximumSpeed: metric('example-trip-02', 60, 'KILOMETRES_PER_HOUR'),
      provenance: evidence('example-trip-02', '2026-10-20T12:00:00.000Z'),
    },
  ],
  positionSamples,
  signalSamples: positionSamples.flatMap((point, index) => [
    signal(point, 'SPEED', speeds[index] ?? null, 'KILOMETRES_PER_HOUR'),
    signal(point, 'COOLANT_TEMPERATURE', temperatures[index] ?? null, 'CELSIUS'),
    signal(point, 'EXTERNAL_VOLTAGE', voltages[index] ?? null, 'VOLT'),
    signal(point, 'FUEL_USED', fuelUsed[index] ?? null, 'LITRE'),
    signal(point, 'DISTANCE_COUNTER', distances[index] ?? null, 'KILOMETRE'),
    signal(point, 'ENGINE_HOURS', engineHours[index] ?? null, 'HOUR'),
  ]),
};

graphqlFixture(AdminFleetScenarioDocument, (variables) => ({
  fleetScenario: { ...fixtureScenario, branchId: variables.branchId ?? defaultBranchId },
}));
