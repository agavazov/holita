import type {
  AdminFleetDiagnosticsQuery,
  FleetScenarioFaultDetailsFragment,
  FleetScenarioLogDetailsFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { isoToZonedWallTime } from '../../../ui/format/zoned-time';
import type { ListState } from '../../../ui/list/list-state';
import type { FaultFilters, FaultSort } from './fault-query';
import type en from './en.json';

export type DiagnosticScenario = AdminFleetDiagnosticsQuery['fleetScenario'];
export type Fault = FleetScenarioFaultDetailsFragment;

export function faultSourceRows(scenario: DiagnosticScenario): Fault[] {
  return scenario.faults.filter(
    (fault) =>
      fault.provenance.source === 'HOLITA_SCENARIO' &&
      fault.provenance.scenarioId === scenario.id &&
      scenario.vehicles.some((vehicle) => vehicle.id === fault.vehicleId),
  );
}

export function faultObservations(
  scenario: DiagnosticScenario,
  fault: Fault,
): readonly FleetScenarioLogDetailsFragment[] {
  return scenario.logs
    .filter(
      (log) =>
        fault.observationLogIds.includes(log.id) &&
        log.faultId === fault.id &&
        log.vehicleId === fault.vehicleId &&
        log.provenance.source === fault.provenance.source,
    )
    .sort((a, b) => (a.provenance.eventAt ?? '').localeCompare(b.provenance.eventAt ?? ''));
}

export function faultFields(
  scenario: DiagnosticScenario | null,
  text: typeof en,
): readonly FilterField[] {
  return [
    {
      key: 'vehicle',
      label: text.vehicle,
      type: 'enum',
      operators: ['isAnyOf'],
      options:
        scenario?.vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.label })) ?? [],
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
    ...(['system', 'severity', 'reportedStatus'] as const).map((key) => ({
      key,
      label: text[key],
      type: 'enum' as const,
      operators: ['isAnyOf'] as const,
      options: Object.entries(
        text[key === 'system' ? 'systems' : key === 'severity' ? 'severities' : 'statuses'],
      ).map(([value, label]) => ({ value, label })),
    })),
  ];
}

function matches(scenario: DiagnosticScenario, fault: Fault, condition: FilterCondition): boolean {
  if (condition.field === 'localReview') {
    return true;
  }
  if (condition.field === 'trip') {
    return condition.values.includes(fault.tripId);
  }
  if (condition.field !== 'observedOn') {
    const value =
      condition.field === 'vehicle'
        ? fault.vehicleId
        : condition.field === 'system'
          ? fault.system
          : condition.field === 'severity'
            ? fault.severity
            : fault.reportedStatus;
    return condition.values.includes(value);
  }
  return faultObservations(scenario, fault).some((log) => {
    const day = log.provenance.eventAt
      ? isoToZonedWallTime(log.provenance.eventAt, scenario.period.timeZone)?.slice(0, 10)
      : null;
    const [from = '', to = ''] = condition.values;
    return (
      !!day &&
      (condition.operator === 'between'
        ? day >= from && day <= to
        : condition.operator === 'after'
          ? day > from
          : condition.operator === 'before'
            ? day < from
            : day === from)
    );
  });
}

export function filteredFaults(
  scenario: DiagnosticScenario,
  state: ListState<FaultFilters, FaultSort>,
  text: typeof en,
  language: Language,
): Fault[] {
  const words = state.search.toLocaleLowerCase(language).split(/\s+/u).filter(Boolean);
  return faultSourceRows(scenario)
    .filter((fault) => {
      const vehicle = scenario.vehicles.find((vehicle) => vehicle.id === fault.vehicleId);
      const searchable =
        `${fault.code} ${text.codes[fault.code]} ${vehicle?.label ?? fault.vehicleId}`.toLocaleLowerCase(
          language,
        );
      return (
        words.every((word) => searchable.includes(word)) &&
        (state.filter.conditions ?? []).every((condition) => matches(scenario, fault, condition))
      );
    })
    .sort((a, b) => {
      const result =
        state.sort.field === 'code'
          ? a.code.localeCompare(b.code)
          : a.lastObservedAt.localeCompare(b.lastObservedAt);
      return state.sort.direction === 'DESC' ? -result : result;
    });
}
