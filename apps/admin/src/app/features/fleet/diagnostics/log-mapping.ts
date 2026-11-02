import type { FleetScenarioLogDetailsFragment } from '../../../../generated/graphql/operations';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { observationRange } from './diagnostic-time';
import type { ListState } from '../../../ui/list/list-state';
import type { DiagnosticScenario } from './fault-mapping';
import type { LogFilters, LogSort } from './log-query';
import type en from './logs.en.json';
export type { DiagnosticScenario } from './fault-mapping';
export type DiagnosticLog = FleetScenarioLogDetailsFragment;

export function logEvaluation(scenario: DiagnosticScenario, log: DiagnosticLog) {
  return (
    scenario.ruleEvaluations.find(
      (row) =>
        row.id === log.evaluationId &&
        row.vehicleId === log.vehicleId &&
        row.tripId === log.tripId &&
        row.provenance.source === log.provenance.source &&
        row.provenance.scenarioId === log.provenance.scenarioId,
    ) ?? null
  );
}
export function logSignal(scenario: DiagnosticScenario, log: DiagnosticLog) {
  return (
    scenario.signalSamples.find(
      (row) =>
        row.id === log.signalSampleId &&
        row.vehicleId === log.vehicleId &&
        row.tripId === log.tripId &&
        row.provenance.source === log.provenance.source &&
        row.provenance.scenarioId === log.provenance.scenarioId,
    ) ?? null
  );
}
export function logPosition(scenario: DiagnosticScenario, log: DiagnosticLog) {
  if (log.kind !== 'MEASUREMENT') {
    return null;
  }
  const signal = logSignal(scenario, log);
  return signal
    ? (scenario.positionSamples.find(
        (row) =>
          row.id === signal.positionSampleId &&
          row.vehicleId === signal.vehicleId &&
          row.tripId === signal.tripId &&
          row.provenance.source === signal.provenance.source &&
          row.provenance.scenarioId === signal.provenance.scenarioId,
      ) ?? null)
    : null;
}
export function logFault(scenario: DiagnosticScenario, log: DiagnosticLog) {
  const id = log.faultId ?? logEvaluation(scenario, log)?.faultId;
  return (
    scenario.faults.find(
      (row) =>
        row.id === id &&
        row.vehicleId === log.vehicleId &&
        row.provenance.source === log.provenance.source &&
        row.provenance.scenarioId === log.provenance.scenarioId,
    ) ?? null
  );
}

function observationMatches(
  scenario: DiagnosticScenario,
  log: DiagnosticLog,
  condition: FilterCondition,
): boolean {
  const { from, to } = observationRange(condition, scenario.period.timeZone);
  if (log.kind === 'RULE_EVALUATION') {
    const evaluation = logEvaluation(scenario, log);
    return (
      !!evaluation &&
      Date.parse(evaluation.window.from) < to &&
      Date.parse(evaluation.window.toExclusive) > from
    );
  }
  const at = log.provenance.eventAt ? Date.parse(log.provenance.eventAt) : NaN;
  return at >= from && at < to;
}
export function logSourceRows(scenario: DiagnosticScenario): DiagnosticLog[] {
  return scenario.logs.filter(
    (log) =>
      log.provenance.source === 'HOLITA_SCENARIO' &&
      log.provenance.scenarioId === scenario.id &&
      scenario.vehicles.some((vehicle) => vehicle.id === log.vehicleId),
  );
}
export function filteredLogs(
  scenario: DiagnosticScenario,
  state: ListState<LogFilters, LogSort>,
  text: typeof en,
): DiagnosticLog[] {
  const words = state.search.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return logSourceRows(scenario)
    .filter((log) => {
      const signal = logSignal(scenario, log);
      const fault = logFault(scenario, log);
      const vehicle = scenario.vehicles.find((row) => row.id === log.vehicleId);
      const search =
        `${log.id} ${text.kinds[log.kind]} ${vehicle?.label ?? ''} ${fault?.code ?? ''} ${signal ? text.signals[signal.signal] : ''} ${log.reason ? text.reasons[log.reason] : ''}`.toLocaleLowerCase();
      return (
        words.every((word) => search.includes(word)) &&
        (state.filter.conditions ?? []).every((condition) => {
          if (condition.field === 'trip') {
            return log.tripId !== null && condition.values.includes(log.tripId);
          }
          if (condition.field === 'observedOn') {
            return observationMatches(scenario, log, condition);
          }
          const value =
            condition.field === 'vehicle'
              ? log.vehicleId
              : condition.field === 'kind'
                ? log.kind
                : condition.field === 'severity'
                  ? log.severity
                  : fault?.id;
          return value != null && condition.values.includes(value);
        })
      );
    })
    .sort((a, b) => {
      const order =
        (a.provenance.eventAt ?? '').localeCompare(b.provenance.eventAt ?? '') ||
        a.id.localeCompare(b.id);
      return state.sort.direction === 'DESC' ? -order : order;
    });
}
export function logFields(
  scenario: DiagnosticScenario | null,
  text: typeof en,
): readonly FilterField[] {
  return [
    {
      key: 'vehicle',
      label: text.vehicle,
      type: 'enum',
      operators: ['isAnyOf'],
      options: scenario?.vehicles.map((row) => ({ value: row.id, label: row.label })) ?? [],
    },
    {
      key: 'trip',
      label: text.trip,
      type: 'enum',
      operators: ['isAnyOf'],
      options: scenario?.trips.map((trip) => ({ value: trip.id, label: trip.id })) ?? [],
    },
    {
      key: 'observedOn',
      label: text.observedOn,
      type: 'date',
      operators: ['on', 'between', 'after', 'before'],
    },
    {
      key: 'kind',
      label: text.kind,
      type: 'enum',
      operators: ['isAnyOf'],
      options: Object.entries(text.kinds).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'severity',
      label: text.severity,
      type: 'enum',
      operators: ['isAnyOf'],
      options: Object.entries(text.severities).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'relatedFault',
      label: text.relatedFault,
      type: 'enum',
      operators: ['isAnyOf'],
      options: scenario?.faults.map((row) => ({ value: row.id, label: row.code })) ?? [],
    },
  ];
}
