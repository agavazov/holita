import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import { observationRange } from './diagnostic-time';
import type { DiagnosticScenario } from './fault-mapping';
import { logEvaluation } from './log-mapping';

export function vehicleSummaryData(
  scenario: DiagnosticScenario,
  vehicleId: string,
  conditions: readonly FilterCondition[],
) {
  const vehicle =
    scenario.vehicles.find(
      (row) =>
        row.id === vehicleId &&
        row.provenance.source === 'HOLITA_SCENARIO' &&
        row.provenance.scenarioId === scenario.id,
    ) ?? null;
  const ranges = conditions
    .filter((condition) => condition.field === 'observedOn')
    .map((condition) => observationRange(condition, scenario.period.timeZone));
  const from = ranges.length
    ? Math.max(...ranges.map((range) => range.from))
    : Date.parse(scenario.period.from);
  const to = ranges.length
    ? Math.min(...ranges.map((range) => range.to))
    : Date.parse(scenario.period.toExclusive);
  const loadedFrom = Math.max(from, Date.parse(scenario.period.from));
  const loadedTo = Math.min(to, Date.parse(scenario.period.toExclusive));
  const hasPeriod = !!vehicle && loadedFrom < loadedTo;
  const trips = scenario.trips.filter(
    (row) =>
      row.vehicleId === vehicleId &&
      row.provenance.source === 'HOLITA_SCENARIO' &&
      row.provenance.scenarioId === scenario.id &&
      conditions
        .filter((condition) => condition.field === 'trip')
        .every((condition) => condition.values.includes(row.id)),
  );
  const inPeriod = (at: string | null | undefined) => {
    const instant = at ? Date.parse(at) : NaN;
    return hasPeriod && instant >= loadedFrom && instant < loadedTo;
  };
  const sourceLogs = scenario.logs.filter((log) => {
    if (
      !vehicle ||
      log.vehicleId !== vehicleId ||
      log.provenance.source !== 'HOLITA_SCENARIO' ||
      log.provenance.scenarioId !== scenario.id ||
      (log.tripId
        ? !trips.some((trip) => trip.id === log.tripId)
        : conditions.some((condition) => condition.field === 'trip'))
    ) {
      return false;
    }
    return true;
  });
  const logs = sourceLogs
    .filter((log) => {
      if (log.kind === 'RULE_EVALUATION') {
        const evaluation = logEvaluation(scenario, log);
        return (
          hasPeriod &&
          !!evaluation &&
          Date.parse(evaluation.window.from) < loadedTo &&
          Date.parse(evaluation.window.toExclusive) > loadedFrom
        );
      }
      return inPeriod(log.provenance.eventAt);
    })
    .sort(
      (left, right) =>
        (left.provenance.eventAt ?? '').localeCompare(right.provenance.eventAt ?? '') ||
        left.id.localeCompare(right.id),
    );
  const faults = scenario.faults.flatMap((fault) => {
    if (
      fault.vehicleId !== vehicleId ||
      fault.provenance.source !== 'HOLITA_SCENARIO' ||
      fault.provenance.scenarioId !== scenario.id ||
      !trips.some((trip) => trip.id === fault.tripId)
    ) {
      return [];
    }
    const observations = logs.filter(
      (log) =>
        fault.observationLogIds.includes(log.id) &&
        log.faultId === fault.id &&
        log.tripId === fault.tripId &&
        (log.kind === 'FAULT_REPORTED' || log.kind === 'FAULT_STATUS'),
    );
    return observations.length ? [{ fault, observations }] : [];
  });
  const evaluations = scenario.ruleEvaluations
    .filter(
      (evaluation) =>
        hasPeriod &&
        evaluation.vehicleId === vehicleId &&
        evaluation.provenance.source === 'HOLITA_SCENARIO' &&
        evaluation.provenance.scenarioId === scenario.id &&
        trips.some((trip) => trip.id === evaluation.tripId) &&
        Date.parse(evaluation.window.from) < loadedTo &&
        Date.parse(evaluation.window.toExclusive) > loadedFrom,
    )
    .sort(
      (left, right) =>
        left.window.from.localeCompare(right.window.from) || left.id.localeCompare(right.id),
    );
  const signals = scenario.signalSamples
    .filter(
      (sample) =>
        sample.vehicleId === vehicleId &&
        sample.provenance.source === 'HOLITA_SCENARIO' &&
        sample.provenance.scenarioId === scenario.id &&
        trips.some((trip) => trip.id === sample.tripId) &&
        inPeriod(sample.provenance.eventAt),
    )
    .sort(
      (left, right) =>
        (right.provenance.eventAt ?? '').localeCompare(left.provenance.eventAt ?? '') ||
        left.id.localeCompare(right.id),
    );
  const latestSignals = (['SPEED', 'COOLANT_TEMPERATURE', 'EXTERNAL_VOLTAGE'] as const).map(
    (signal) => {
      const sample = signals.find((sample) => sample.signal === signal) ?? null;
      const log = sample
        ? (logs.find(
            (log) =>
              log.kind === 'MEASUREMENT' &&
              log.signalSampleId === sample.id &&
              log.tripId === sample.tripId,
          ) ?? null)
        : null;
      return { signal, sample, log };
    },
  );
  const missingReferences = [
    ...new Set([
      ...faults.flatMap(({ fault }) =>
        fault.observationLogIds.filter(
          (id) =>
            !sourceLogs.some(
              (log) => log.id === id && log.faultId === fault.id && log.tripId === fault.tripId,
            ),
        ),
      ),
      ...evaluations.flatMap((evaluation) => [
        ...evaluation.contributingLogIds.filter(
          (id) => !sourceLogs.some((log) => log.id === id && log.tripId === evaluation.tripId),
        ),
        ...[...evaluation.contributingSignalIds, ...evaluation.missingSignalIds].filter(
          (id) =>
            !scenario.signalSamples.some(
              (sample) =>
                sample.id === id &&
                sample.vehicleId === vehicleId &&
                sample.tripId === evaluation.tripId &&
                sample.provenance.source === 'HOLITA_SCENARIO' &&
                sample.provenance.scenarioId === scenario.id,
            ),
        ),
      ]),
    ]),
  ];
  return {
    vehicle,
    hasPeriod,
    missingReferences,
    selectedFrom: Number.isFinite(from) ? new Date(from).toISOString() : null,
    selectedTo: Number.isFinite(to) ? new Date(to).toISOString() : null,
    loadedPeriod: hasPeriod
      ? {
          from: new Date(loadedFrom).toISOString(),
          toExclusive: new Date(loadedTo).toISOString(),
          timeZone: scenario.period.timeZone,
        }
      : null,
    partialPeriod: hasPeriod && (from < loadedFrom || to > loadedTo),
    faults,
    evaluations,
    logs,
    latestSignals,
    counts: hasPeriod
      ? {
          active: faults.filter(({ fault }) => fault.reportedStatus === 'ACTIVE').length,
          resolved: faults.filter(({ fault }) => fault.reportedStatus === 'RESOLVED').length,
          reports: faults.reduce(
            (sum, row) =>
              sum + row.observations.filter((log) => log.kind === 'FAULT_REPORTED').length,
            0,
          ),
        }
      : null,
  };
}
