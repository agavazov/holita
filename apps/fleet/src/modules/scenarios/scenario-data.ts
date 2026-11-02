import type {
  FleetEvidenceOrigin,
  FleetEvidenceProvenance,
  FleetScenario,
  FleetScenarioMetric,
  FleetScenarioPositionSample,
  FleetScenarioSignal,
  FleetScenarioSignalSample,
  FleetScenarioUnit,
} from '../../generated/graphql/types.js';
import type { FleetScope } from '../../validation.js';
import { diagnosticData } from './diagnostic-data.js';

export const operationalScenarioId = 'operational-day-v1';
const vehicleId = 'example-truck-01';

/** Fixed examples only. No source account IDs, customer locations or Storybook imports. */
export function operationalScenario(scope: FleetScope, retrievedAt: Date): FleetScenario {
  function provenance(
    sourceRecordId: string,
    eventAt: Date | null = null,
    origin: FleetEvidenceOrigin = 'ILLUSTRATIVE',
  ): FleetEvidenceProvenance {
    return {
      origin,
      source: 'HOLITA_SCENARIO',
      scenarioId: operationalScenarioId,
      sourceRecordId,
      eventAt,
      receivedAt: null,
      retrievedAt,
    };
  }

  function position(
    id: string,
    tripId: string,
    time: string,
    latitude: number,
    longitude: number,
  ): FleetScenarioPositionSample {
    return {
      id,
      vehicleId,
      tripId,
      latitude,
      longitude,
      provenance: provenance(id, new Date(time)),
    };
  }

  // Invented Sofia–Vakarel itinerary via public road landmarks, not a recorded journey.
  const positionSamples = [
    position('example-position-01', 'example-trip-01', '2026-10-20T06:00:00Z', 42.6907, 23.3383),
    position('example-position-02', 'example-trip-01', '2026-10-20T06:10:00Z', 42.6706, 23.37),
    position('example-position-03', 'example-trip-01', '2026-10-20T06:20:00Z', 42.6489, 23.3955),
    position('example-position-04', 'example-trip-01', '2026-10-20T06:40:00Z', 42.6006, 23.5943),
    position('example-position-05', 'example-trip-01', '2026-10-20T07:00:00Z', 42.556, 23.6973),
    position('example-position-06', 'example-trip-02', '2026-10-20T12:00:00Z', 42.556, 23.6973),
    position('example-position-07', 'example-trip-02', '2026-10-20T12:30:00Z', 42.6006, 23.5943),
    position('example-position-08', 'example-trip-02', '2026-10-20T13:00:00Z', 42.6907, 23.3383),
  ];

  function signal(
    point: FleetScenarioPositionSample,
    kind: FleetScenarioSignal,
    value: number | null,
    unit: FleetScenarioUnit,
  ): FleetScenarioSignalSample {
    const id = `${point.id}-${kind.toLowerCase()}`;
    return {
      id,
      vehicleId,
      tripId: point.tripId,
      positionSampleId: point.id,
      signal: kind,
      value,
      unit,
      availability: value === null ? 'UNAVAILABLE' : 'COMPLETE',
      provenance: provenance(
        id,
        point.provenance.eventAt ?? null,
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
  const signalSamples = positionSamples.flatMap((point, index) => [
    signal(point, 'SPEED', speeds[index] ?? null, 'KILOMETRES_PER_HOUR'),
    signal(point, 'COOLANT_TEMPERATURE', temperatures[index] ?? null, 'CELSIUS'),
    signal(point, 'EXTERNAL_VOLTAGE', voltages[index] ?? null, 'VOLT'),
    signal(point, 'FUEL_USED', fuelUsed[index] ?? null, 'LITRE'),
    signal(point, 'DISTANCE_COUNTER', distances[index] ?? null, 'KILOMETRE'),
    signal(point, 'ENGINE_HOURS', engineHours[index] ?? null, 'HOUR'),
  ]);

  function metric(recordId: string, value: number, unit: FleetScenarioUnit): FleetScenarioMetric {
    return {
      value,
      unit,
      availability: 'COMPLETE',
      availableInputs: 1,
      requiredInputs: 1,
      provenance: provenance(recordId),
    };
  }

  const exampleClock = new Date('2026-10-21T06:00:00Z');
  return {
    id: operationalScenarioId,
    branchId: scope.branchId,
    exampleClock,
    period: {
      from: new Date('2026-10-19T21:00:00Z'),
      toExclusive: new Date('2026-10-20T21:00:00Z'),
      timeZone: 'Europe/Sofia',
    },
    provenance: provenance(operationalScenarioId),
    coverage: {
      retrieval: 'COMPLETE',
      positionCoverage: 'PARTIAL',
      positionsLoaded: positionSamples.length,
      gaps: [
        { from: new Date('2026-10-20T06:20:00Z'), toExclusive: new Date('2026-10-20T06:40:00Z') },
      ],
    },
    vehicles: [{ id: vehicleId, label: 'EXAMPLE TRUCK 01', provenance: provenance(vehicleId) }],
    trips: [
      {
        id: 'example-trip-01',
        vehicleId,
        startedAt: new Date('2026-10-20T06:00:00Z'),
        stoppedAt: new Date('2026-10-20T07:00:00Z'),
        startPositionId: 'example-position-01',
        stopPositionId: 'example-position-05',
        distance: metric('example-trip-01', 42.5, 'KILOMETRE'),
        nightDistance: metric('example-trip-01', 0, 'KILOMETRE'),
        maximumSpeed: metric('example-trip-01', 70, 'KILOMETRES_PER_HOUR'),
        provenance: provenance('example-trip-01', new Date('2026-10-20T06:00:00Z')),
      },
      {
        id: 'example-trip-02',
        vehicleId,
        startedAt: new Date('2026-10-20T12:00:00Z'),
        stoppedAt: new Date('2026-10-20T13:00:00Z'),
        startPositionId: 'example-position-06',
        stopPositionId: 'example-position-08',
        distance: metric('example-trip-02', 41, 'KILOMETRE'),
        nightDistance: metric('example-trip-02', 0, 'KILOMETRE'),
        maximumSpeed: metric('example-trip-02', 60, 'KILOMETRES_PER_HOUR'),
        provenance: provenance('example-trip-02', new Date('2026-10-20T12:00:00Z')),
      },
    ],
    positionSamples,
    signalSamples,
    ...diagnosticData(vehicleId, signalSamples, exampleClock, provenance),
  };
}
