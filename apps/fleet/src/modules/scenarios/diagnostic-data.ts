import type {
  FleetEvidenceOrigin,
  FleetEvidencePeriod,
  FleetEvidenceProvenance,
  FleetScenario,
  FleetScenarioFault,
  FleetScenarioLog,
  FleetScenarioLogKind,
  FleetScenarioRuleEvaluation,
  FleetScenarioSignalSample,
} from '../../generated/graphql/types.js';

type Provenance = (
  sourceRecordId: string,
  eventAt?: Date | null,
  origin?: FleetEvidenceOrigin,
) => FleetEvidenceProvenance;

type LogContext = Partial<
  Pick<
    FleetScenarioLog,
    | 'tripId'
    | 'severity'
    | 'faultId'
    | 'reportedStatus'
    | 'signalSampleId'
    | 'evaluationId'
    | 'reason'
  >
>;

function window(from: string, toExclusive: string): FleetEvidencePeriod {
  return { from: new Date(from), toExclusive: new Date(toExclusive), timeZone: 'Europe/Sofia' };
}

function inWindow(at: Date | null | undefined, period: FleetEvidencePeriod): boolean {
  return (
    at != null &&
    at.getTime() >= period.from.getTime() &&
    at.getTime() < period.toExclusive.getTime()
  );
}

export function diagnosticData(
  vehicleId: string,
  signalSamples: readonly FleetScenarioSignalSample[],
  exampleClock: Date,
  provenance: Provenance,
): Pick<FleetScenario, 'faults' | 'logs' | 'ruleEvaluations'> {
  function log(
    id: string,
    at: Date,
    kind: FleetScenarioLogKind,
    context: LogContext,
  ): FleetScenarioLog {
    return {
      id,
      vehicleId,
      kind,
      tripId: null,
      severity: 'INFO',
      faultId: null,
      reportedStatus: null,
      signalSampleId: null,
      evaluationId: null,
      reason: null,
      ...context,
      provenance: provenance(id, at, kind === 'RULE_EVALUATION' ? 'DERIVED' : 'ILLUSTRATIVE'),
    };
  }

  const faultLogs = [
    log('example-log-fault-01', new Date('2026-10-20T06:20:00Z'), 'FAULT_REPORTED', {
      tripId: 'example-trip-01',
      severity: 'WARNING',
      faultId: 'example-fault-01',
      reportedStatus: 'ACTIVE',
    }),
    log('example-log-fault-02', new Date('2026-10-20T06:40:00Z'), 'FAULT_REPORTED', {
      tripId: 'example-trip-01',
      severity: 'WARNING',
      faultId: 'example-fault-01',
      reportedStatus: 'ACTIVE',
    }),
    log('example-log-fault-03', new Date('2026-10-20T07:00:00Z'), 'FAULT_REPORTED', {
      tripId: 'example-trip-01',
      severity: 'WARNING',
      faultId: 'example-fault-01',
      reportedStatus: 'ACTIVE',
    }),
    log('example-log-fault-04', new Date('2026-10-20T06:10:00Z'), 'FAULT_REPORTED', {
      tripId: 'example-trip-01',
      severity: 'WARNING',
      faultId: 'example-fault-02',
      reportedStatus: 'ACTIVE',
    }),
    log('example-log-fault-05', new Date('2026-10-20T06:15:00Z'), 'FAULT_STATUS', {
      tripId: 'example-trip-01',
      faultId: 'example-fault-02',
      reportedStatus: 'RESOLVED',
    }),
  ];
  const faults: FleetScenarioFault[] = [
    {
      id: 'example-fault-01',
      vehicleId,
      tripId: 'example-trip-01',
      code: 'EXAMPLE_COOLING_01',
      system: 'COOLING',
      severity: 'WARNING',
      reportedStatus: 'ACTIVE',
      firstObservedAt: new Date('2026-10-20T06:20:00Z'),
      lastObservedAt: new Date('2026-10-20T07:00:00Z'),
      occurrences: 3,
      reportedResolvedAt: null,
      observationLogIds: ['example-log-fault-01', 'example-log-fault-02', 'example-log-fault-03'],
      provenance: provenance('example-fault-01', new Date('2026-10-20T07:00:00Z')),
    },
    {
      id: 'example-fault-02',
      vehicleId,
      tripId: 'example-trip-01',
      code: 'EXAMPLE_POWER_01',
      system: 'ELECTRICAL',
      severity: 'WARNING',
      reportedStatus: 'RESOLVED',
      firstObservedAt: new Date('2026-10-20T06:10:00Z'),
      lastObservedAt: new Date('2026-10-20T06:10:00Z'),
      occurrences: 1,
      reportedResolvedAt: new Date('2026-10-20T06:15:00Z'),
      observationLogIds: ['example-log-fault-04', 'example-log-fault-05'],
      provenance: provenance('example-fault-02', new Date('2026-10-20T06:15:00Z')),
    },
  ];

  function signalInputs(ids: readonly string[], tripId: string, period: FleetEvidencePeriod) {
    const available = ids.flatMap((id) => {
      const sample = signalSamples.find(
        (row) =>
          row.id === id &&
          row.vehicleId === vehicleId &&
          row.tripId === tripId &&
          inWindow(row.provenance.eventAt, period),
      );
      return sample?.value != null && sample.availability === 'COMPLETE' ? [sample] : [];
    });
    return {
      values: available.flatMap((sample) => (sample.value == null ? [] : [sample.value])),
      ids: available.map((sample) => sample.id),
      missingIds: ids.filter((id) => !available.some((sample) => sample.id === id)),
    };
  }

  function repeatedFault(): FleetScenarioRuleEvaluation {
    const period = window('2026-10-20T06:00:00Z', '2026-10-20T08:00:00Z');
    const reports = faultLogs.filter(
      (row) =>
        row.vehicleId === vehicleId &&
        row.faultId === 'example-fault-01' &&
        row.kind === 'FAULT_REPORTED' &&
        inWindow(row.provenance.eventAt, period),
    );
    const minimumReports = 3;
    const matched = reports.length >= minimumReports;
    return {
      id: 'example-evaluation-fault-01',
      vehicleId,
      tripId: 'example-trip-01',
      faultId: 'example-fault-01',
      rule: 'REPEATED_FAULT',
      ruleId: 'example-repeated-fault-v1',
      version: 1,
      window: period,
      evaluatedAt: exampleClock,
      state: matched ? 'MATCHED' : 'NOT_MATCHED',
      attention: matched ? 'REVIEW' : null,
      thresholds: [{ kind: 'MINIMUM_REPORTS', value: minimumReports, unit: null }],
      availableInputs: reports.length,
      requiredInputs: minimumReports,
      contributingSignalIds: [],
      contributingLogIds: reports.map((row) => row.id),
      missingSignalIds: [],
      missingEvidence: ['MANUFACTURER_FAULT_MEANING_UNVERIFIED'],
      provenance: provenance('example-evaluation-fault-01', exampleClock, 'DERIVED'),
    };
  }

  function temperaturePattern(): FleetScenarioRuleEvaluation {
    const period = window('2026-10-20T06:20:00Z', '2026-10-20T07:01:00Z');
    const inputs = signalInputs(
      [
        'example-position-03-coolant_temperature',
        'example-position-04-coolant_temperature',
        'example-position-05-coolant_temperature',
      ],
      'example-trip-01',
      period,
    );
    const threshold = 95;
    const minimumHighSamples = 2;
    const complete = inputs.values.length === 3;
    const rising = inputs.values.every(
      (value, index, values) => index === 0 || value > (values[index - 1] ?? value),
    );
    const matched =
      complete &&
      rising &&
      inputs.values.slice(-minimumHighSamples).every((value) => value >= threshold);
    return {
      id: 'example-evaluation-temperature-01',
      vehicleId,
      tripId: 'example-trip-01',
      faultId: null,
      rule: 'TEMPERATURE_PATTERN',
      ruleId: 'example-temperature-pattern-v1',
      version: 1,
      window: period,
      evaluatedAt: exampleClock,
      state: !complete ? 'INSUFFICIENT_DATA' : matched ? 'MATCHED' : 'NOT_MATCHED',
      attention: matched ? 'MONITOR' : null,
      thresholds: [
        { kind: 'TEMPERATURE_AT_LEAST', value: threshold, unit: 'CELSIUS' },
        { kind: 'MINIMUM_HIGH_SAMPLES', value: minimumHighSamples, unit: null },
      ],
      availableInputs: inputs.values.length,
      requiredInputs: 3,
      contributingSignalIds: inputs.ids,
      contributingLogIds: [],
      missingSignalIds: inputs.missingIds,
      missingEvidence: [
        ...(!complete ? (['SIGNAL_VALUE_UNAVAILABLE'] as const) : []),
        'CONTINUOUS_TEMPERATURE_HISTORY_UNAVAILABLE',
        'ENGINE_LOAD_CONTEXT_UNAVAILABLE',
        'VEHICLE_LIMITS_UNVERIFIED',
      ],
      provenance: provenance('example-evaluation-temperature-01', exampleClock, 'DERIVED'),
    };
  }

  function voltagePattern(
    id: string,
    tripId: string,
    period: FleetEvidencePeriod,
    signalIds: readonly string[],
  ): FleetScenarioRuleEvaluation {
    const inputs = signalInputs(signalIds, tripId, period);
    const threshold = 27.6;
    const complete = inputs.values.length === 3;
    const matched = complete && inputs.values.every((value) => value <= threshold);
    return {
      id,
      vehicleId,
      tripId,
      faultId: null,
      rule: 'VOLTAGE_PATTERN',
      ruleId: 'example-voltage-pattern-v1',
      version: 1,
      window: period,
      evaluatedAt: exampleClock,
      state: !complete ? 'INSUFFICIENT_DATA' : matched ? 'MATCHED' : 'NOT_MATCHED',
      attention: matched ? 'MONITOR' : null,
      thresholds: [{ kind: 'VOLTAGE_AT_MOST', value: threshold, unit: 'VOLT' }],
      availableInputs: inputs.values.length,
      requiredInputs: 3,
      contributingSignalIds: inputs.ids,
      contributingLogIds: [],
      missingSignalIds: inputs.missingIds,
      missingEvidence: [
        ...(!complete ? (['SIGNAL_VALUE_UNAVAILABLE'] as const) : []),
        'VEHICLE_LIMITS_UNVERIFIED',
      ],
      provenance: provenance(id, exampleClock, 'DERIVED'),
    };
  }

  const ruleEvaluations = [
    repeatedFault(),
    temperaturePattern(),
    voltagePattern(
      'example-evaluation-voltage-01',
      'example-trip-01',
      window('2026-10-20T06:20:00Z', '2026-10-20T07:01:00Z'),
      [
        'example-position-03-external_voltage',
        'example-position-04-external_voltage',
        'example-position-05-external_voltage',
      ],
    ),
    voltagePattern(
      'example-evaluation-voltage-02',
      'example-trip-02',
      window('2026-10-20T12:00:00Z', '2026-10-20T13:01:00Z'),
      [
        'example-position-06-external_voltage',
        'example-position-07-external_voltage',
        'example-position-08-external_voltage',
      ],
    ),
  ];
  const logs = [
    ...faultLogs,
    ...signalSamples.flatMap((sample) => {
      const at = sample.provenance.eventAt;
      return at == null
        ? []
        : [
            log(`example-log-measurement-${sample.id}`, at, 'MEASUREMENT', {
              tripId: sample.tripId,
              signalSampleId: sample.id,
            }),
          ];
    }),
    log('example-log-availability-01', new Date('2026-10-20T06:40:00Z'), 'AVAILABILITY', {
      tripId: 'example-trip-01',
      signalSampleId: 'example-position-04-external_voltage',
      reason: 'SIGNAL_VALUE_UNAVAILABLE',
    }),
    log('example-log-integration-01', new Date('2026-10-20T06:45:00Z'), 'INTEGRATION_ISSUE', {
      reason: 'EXAMPLE_UPSTREAM_FAILURE',
    }),
    ...ruleEvaluations.map((evaluation) =>
      log(`example-log-${evaluation.id}`, evaluation.evaluatedAt, 'RULE_EVALUATION', {
        tripId: evaluation.tripId,
        evaluationId: evaluation.id,
      }),
    ),
  ].sort(
    (left, right) =>
      (left.provenance.eventAt?.getTime() ?? 0) - (right.provenance.eventAt?.getTime() ?? 0) ||
      left.id.localeCompare(right.id),
  );

  return { faults, logs, ruleEvaluations };
}
