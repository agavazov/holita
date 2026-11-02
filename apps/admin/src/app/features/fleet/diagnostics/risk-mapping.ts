import type { FleetScenarioRuleEvaluationDetailsFragment } from '../../../../generated/graphql/operations';
import type { FilterField } from '../../../ui/filter-builder/filter-model';
import type { ListState } from '../../../ui/list/list-state';
import { observationRange } from './diagnostic-time';
import type { DiagnosticScenario } from './fault-mapping';
import type { RiskFilters, RiskSort } from './risk-query';
import type en from './risk-page.en.json';

export type DiagnosticEvaluation = FleetScenarioRuleEvaluationDetailsFragment;

export function riskSourceRows(scenario: DiagnosticScenario): DiagnosticEvaluation[] {
  return scenario.ruleEvaluations.filter(
    (row) =>
      row.provenance.source === 'HOLITA_SCENARIO' &&
      row.provenance.scenarioId === scenario.id &&
      scenario.vehicles.some((vehicle) => vehicle.id === row.vehicleId),
  );
}

export function evaluationFault(scenario: DiagnosticScenario, evaluation: DiagnosticEvaluation) {
  return (
    scenario.faults.find(
      (row) =>
        row.id === evaluation.faultId &&
        row.vehicleId === evaluation.vehicleId &&
        row.provenance.source === evaluation.provenance.source &&
        row.provenance.scenarioId === evaluation.provenance.scenarioId,
    ) ?? null
  );
}

export function filteredRisk(
  scenario: DiagnosticScenario,
  state: ListState<RiskFilters, RiskSort>,
  text: typeof en,
): DiagnosticEvaluation[] {
  const words = state.search.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return riskSourceRows(scenario)
    .filter((row) => {
      const vehicle = scenario.vehicles.find((vehicle) => vehicle.id === row.vehicleId);
      const fault = evaluationFault(scenario, row);
      const search =
        `${text.rules[row.rule]} ${text.states[row.state]} ${row.attention ? text.attentionLabels[row.attention] : text.noBand} ${vehicle?.label ?? ''} ${fault?.code ?? ''} ${row.ruleId} ${row.id}`.toLocaleLowerCase();
      return (
        words.every((word) => search.includes(word)) &&
        (state.filter.conditions ?? []).every((condition) => {
          if (condition.field === 'trip') {
            return condition.values.includes(row.tripId);
          }
          if (condition.field === 'localReview') {
            return true;
          }
          if (condition.field === 'observedOn') {
            const { from, to } = observationRange(condition, scenario.period.timeZone);
            return Date.parse(row.window.from) < to && Date.parse(row.window.toExclusive) > from;
          }
          const value =
            condition.field === 'vehicle'
              ? row.vehicleId
              : condition.field === 'rule'
                ? row.rule
                : condition.field === 'state'
                  ? row.state
                  : (row.attention ?? 'NONE');
          return condition.values.includes(value);
        })
      );
    })
    .sort((a, b) => {
      const order = a.window.from.localeCompare(b.window.from) || a.id.localeCompare(b.id);
      return state.sort.direction === 'DESC' ? -order : order;
    });
}

export function riskFields(
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
      key: 'rule',
      label: text.rule,
      type: 'enum',
      operators: ['isAnyOf'],
      options: Object.entries(text.rules).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'state',
      label: text.state,
      type: 'enum',
      operators: ['isAnyOf'],
      options: Object.entries(text.states).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'attention',
      label: text.attention,
      type: 'enum',
      operators: ['isAnyOf'],
      options: [
        ...Object.entries(text.attentionLabels).map(([value, label]) => ({ value, label })),
        { value: 'NONE', label: text.noBand },
      ],
    },
  ];
}
