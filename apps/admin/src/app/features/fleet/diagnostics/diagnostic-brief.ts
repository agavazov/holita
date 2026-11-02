import type { FleetEvidenceFragment } from '../../../../generated/graphql/operations';
import type { DiagnosticScenario, Fault } from './fault-mapping';
import type { DiagnosticLog } from './log-mapping';
import type { DiagnosticEvaluation } from './risk-mapping';
import type { DiagnosticReviewStatus } from './diagnostics-review';

export type DiagnosticBriefReviewStatus = DiagnosticReviewStatus;
type SignalSample = DiagnosticScenario['signalSamples'][number];
type PositionSample = DiagnosticScenario['positionSamples'][number];
type RecordContext = Pick<Fault, 'vehicleId' | 'tripId' | 'provenance'>;

function provenance(value: FleetEvidenceFragment) {
  return {
    origin: value.origin,
    source: value.source,
    scenarioId: value.scenarioId,
    sourceRecordId: value.sourceRecordId,
    eventAt: value.eventAt,
    receivedAt: value.receivedAt,
    retrievedAt: value.retrievedAt,
  };
}

function sameContext(record: RecordContext, context: RecordContext) {
  return (
    record.vehicleId === context.vehicleId &&
    record.tripId === context.tripId &&
    record.provenance.source === context.provenance.source &&
    record.provenance.scenarioId === context.provenance.scenarioId
  );
}

function logRecord(log: DiagnosticLog) {
  return {
    id: log.id,
    vehicleId: log.vehicleId,
    tripId: log.tripId,
    kind: log.kind,
    severity: log.severity,
    faultId: log.faultId,
    reportedStatus: log.reportedStatus,
    signalSampleId: log.signalSampleId,
    evaluationId: log.evaluationId,
    reason: log.reason,
    provenance: provenance(log.provenance),
  };
}

function faultRecord(fault: Fault) {
  return {
    id: fault.id,
    vehicleId: fault.vehicleId,
    tripId: fault.tripId,
    code: fault.code,
    system: fault.system,
    severity: fault.severity,
    reportedStatus: fault.reportedStatus,
    firstObservedAt: fault.firstObservedAt,
    lastObservedAt: fault.lastObservedAt,
    occurrences: fault.occurrences,
    reportedResolvedAt: fault.reportedResolvedAt,
    observationLogIds: [...fault.observationLogIds],
    provenance: provenance(fault.provenance),
  };
}

function referencedSignal(scenario: DiagnosticScenario, id: string, context: RecordContext) {
  return (
    scenario.signalSamples.find((sample) => sample.id === id && sameContext(sample, context)) ??
    null
  );
}

function measurementLogs(scenario: DiagnosticScenario, sample: SignalSample) {
  return scenario.logs.filter(
    (log) =>
      log.kind === 'MEASUREMENT' &&
      log.signalSampleId === sample.id &&
      log.vehicleId === sample.vehicleId &&
      log.tripId === sample.tripId &&
      log.provenance.source === sample.provenance.source &&
      log.provenance.scenarioId === sample.provenance.scenarioId,
  );
}

function signalRecord(scenario: DiagnosticScenario, sample: SignalSample) {
  return {
    id: sample.id,
    vehicleId: sample.vehicleId,
    tripId: sample.tripId,
    positionSampleId: sample.positionSampleId,
    signal: sample.signal,
    value: sample.value,
    unit: sample.unit,
    availability: sample.availability,
    provenance: provenance(sample.provenance),
    measurementLogs: measurementLogs(scenario, sample).map(logRecord),
  };
}

function header(
  scenario: DiagnosticScenario,
  context: RecordContext,
  localReview: DiagnosticBriefReviewStatus,
) {
  const vehicle = scenario.vehicles.find(
    (row) =>
      row.id === context.vehicleId &&
      row.provenance.source === context.provenance.source &&
      row.provenance.scenarioId === context.provenance.scenarioId,
  );
  const trip = scenario.trips.find(
    (row) =>
      row.id === context.tripId &&
      sameContext(
        {
          vehicleId: row.vehicleId,
          tripId: row.id,
          provenance: row.provenance,
        },
        context,
      ),
  );
  return {
    exportMetadata: {
      illustrative: true,
      savedToServer: false,
      confirmsRepair: false,
      localReviewLifecycle:
        'Kept while navigating Faults, Logs and Risk. Reset when changing source, Branch, language or session, leaving Diagnostics, or reloading the page.',
      evidenceScope:
        'Selected record and its exact references from the loaded example; no full dataset snapshot or refetch.',
    },
    dataset: {
      scenarioId: scenario.id,
      exampleClock: scenario.exampleClock,
      provenance: provenance(scenario.provenance),
      observationPeriod: {
        from: scenario.period.from,
        toExclusive: scenario.period.toExclusive,
        timeZone: scenario.period.timeZone,
      },
      coverage: {
        retrieval: scenario.coverage.retrieval,
        positionCoverage: scenario.coverage.positionCoverage,
        positionsLoaded: scenario.coverage.positionsLoaded,
        gaps: scenario.coverage.gaps.map((gap) => ({
          from: gap.from,
          toExclusive: gap.toExclusive,
        })),
      },
    },
    vehicle: { id: context.vehicleId, label: vehicle?.label ?? null },
    trip: {
      id: context.tripId,
      record: trip
        ? {
            startedAt: trip.startedAt,
            stoppedAt: trip.stoppedAt,
            provenance: provenance(trip.provenance),
          }
        : null,
    },
    localReview: { status: localReview },
  };
}

function faultLogs(scenario: DiagnosticScenario, fault: Fault) {
  return fault.observationLogIds.map((id) => ({
    id,
    log:
      scenario.logs.find(
        (log) =>
          log.id === id &&
          log.faultId === fault.id &&
          log.vehicleId === fault.vehicleId &&
          log.tripId === fault.tripId &&
          log.provenance.source === fault.provenance.source &&
          log.provenance.scenarioId === fault.provenance.scenarioId,
      ) ?? null,
  }));
}

function contributorSamples(
  scenario: DiagnosticScenario,
  kind: 'fault' | 'risk',
  recordId: string,
) {
  if (kind === 'fault') {
    const fault = scenario.faults.find((row) => row.id === recordId);
    return fault
      ? faultLogs(scenario, fault).flatMap(({ log }) => {
          if (log?.kind !== 'MEASUREMENT' || !log.signalSampleId) {
            return [];
          }
          const sample = referencedSignal(scenario, log.signalSampleId, fault);
          return sample ? [sample] : [];
        })
      : [];
  }
  const evaluation = scenario.ruleEvaluations.find((row) => row.id === recordId);
  return evaluation
    ? evaluation.contributingSignalIds.flatMap((id) => {
        const sample = referencedSignal(scenario, id, evaluation);
        return sample ? [sample] : [];
      })
    : [];
}

function linkedPoints(scenario: DiagnosticScenario, kind: 'fault' | 'risk', recordId: string) {
  const points: { point: PositionSample; signalSampleIds: string[] }[] = [];
  for (const sample of contributorSamples(scenario, kind, recordId)) {
    const point = scenario.positionSamples.find(
      (row) => row.id === sample.positionSampleId && sameContext(row, sample),
    );
    if (!point) {
      continue;
    }
    const existing = points.find((row) => row.point.id === point.id);
    if (existing) {
      if (!existing.signalSampleIds.includes(sample.id)) {
        existing.signalSampleIds.push(sample.id);
      }
    } else {
      points.push({ point, signalSampleIds: [sample.id] });
    }
  }
  return points;
}

export function eligibleBriefPoints(
  scenario: DiagnosticScenario,
  kind: 'fault' | 'risk',
  recordId: string,
) {
  return linkedPoints(scenario, kind, recordId).map(({ point, signalSampleIds }) => ({
    id: point.id,
    eventAt: point.provenance.eventAt,
    signalSampleIds,
  }));
}

function selectedPoint(
  scenario: DiagnosticScenario,
  kind: 'fault' | 'risk',
  recordId: string,
  pointId: string,
) {
  const point = linkedPoints(scenario, kind, recordId).find(
    (row) => row.point.id === pointId,
  )?.point;
  return {
    id: pointId,
    record: point
      ? {
          vehicleId: point.vehicleId,
          tripId: point.tripId,
          latitude: point.latitude,
          longitude: point.longitude,
          provenance: provenance(point.provenance),
        }
      : null,
  };
}

export function faultBrief(
  scenario: DiagnosticScenario,
  fault: Fault,
  localReview: DiagnosticBriefReviewStatus,
  includePointId?: string,
) {
  const observations = faultLogs(scenario, fault);
  return {
    kind: 'fault',
    ...header(scenario, fault, localReview),
    fault: faultRecord(fault),
    observations: observations.map(({ id, log }) => ({ id, record: log ? logRecord(log) : null })),
    missingObservationLogIds: observations.filter(({ log }) => !log).map(({ id }) => id),
    limitations: [
      'Illustrative fault code; manufacturer meaning is unverified.',
      'Reported resolution does not confirm repair or ECU clearing.',
      'Local review does not change the source-reported fault status.',
    ],
    ...(includePointId
      ? { selectedPoint: selectedPoint(scenario, 'fault', fault.id, includePointId) }
      : {}),
  };
}

export function riskBrief(
  scenario: DiagnosticScenario,
  evaluation: DiagnosticEvaluation,
  localReview: DiagnosticBriefReviewStatus,
  includePointId?: string,
) {
  const signalReferences = evaluation.contributingSignalIds.map((id) => ({
    id,
    sample: referencedSignal(scenario, id, evaluation),
  }));
  const missingSignals = evaluation.missingSignalIds.map((id) => ({
    id,
    sample: referencedSignal(scenario, id, evaluation),
  }));
  const logReferences = evaluation.contributingLogIds.map((id) => ({
    id,
    log:
      scenario.logs.find(
        (log) =>
          log.id === id &&
          log.vehicleId === evaluation.vehicleId &&
          log.tripId === evaluation.tripId &&
          log.provenance.source === evaluation.provenance.source &&
          log.provenance.scenarioId === evaluation.provenance.scenarioId,
      ) ?? null,
  }));
  const fault = scenario.faults.find(
    (row) =>
      row.id === evaluation.faultId &&
      row.vehicleId === evaluation.vehicleId &&
      row.provenance.source === evaluation.provenance.source &&
      row.provenance.scenarioId === evaluation.provenance.scenarioId,
  );
  return {
    kind: 'risk',
    ...header(scenario, evaluation, localReview),
    evaluation: {
      id: evaluation.id,
      vehicleId: evaluation.vehicleId,
      tripId: evaluation.tripId,
      faultId: evaluation.faultId,
      rule: evaluation.rule,
      ruleId: evaluation.ruleId,
      version: evaluation.version,
      window: {
        from: evaluation.window.from,
        toExclusive: evaluation.window.toExclusive,
        timeZone: evaluation.window.timeZone,
      },
      evaluatedAt: evaluation.evaluatedAt,
      state: evaluation.state,
      attention: evaluation.attention,
      thresholds: evaluation.thresholds.map((threshold) => ({
        kind: threshold.kind,
        value: threshold.value,
        unit: threshold.unit,
      })),
      availableInputs: evaluation.availableInputs,
      requiredInputs: evaluation.requiredInputs,
      contributingSignalIds: [...evaluation.contributingSignalIds],
      contributingLogIds: [...evaluation.contributingLogIds],
      missingSignalIds: [...evaluation.missingSignalIds],
      missingEvidence: [...evaluation.missingEvidence],
      provenance: provenance(evaluation.provenance),
    },
    contributingSignals: signalReferences.map(({ id, sample }) => ({
      id,
      record: sample ? signalRecord(scenario, sample) : null,
    })),
    contributingLogs: logReferences.map(({ id, log }) => ({
      id,
      record: log ? logRecord(log) : null,
    })),
    missingInputs: missingSignals.map(({ id, sample }) => ({
      id,
      record: sample ? signalRecord(scenario, sample) : null,
    })),
    unavailableContributorSignalIds: signalReferences
      .filter(({ sample }) => !sample)
      .map(({ id }) => id),
    unavailableContributorLogIds: logReferences.filter(({ log }) => !log).map(({ id }) => id),
    relatedFault: evaluation.faultId
      ? { id: evaluation.faultId, record: fault ? faultRecord(fault) : null }
      : null,
    limitations: [
      'Versioned illustrative rule and thresholds; not a diagnosis, vehicle health assessment or failure probability.',
      'Server input counts and evaluation results are preserved even when referenced records are unavailable in the loaded data.',
      'Local review does not change the rule state or attention band.',
    ],
    ...(includePointId
      ? { selectedPoint: selectedPoint(scenario, 'risk', evaluation.id, includePointId) }
      : {}),
  };
}
