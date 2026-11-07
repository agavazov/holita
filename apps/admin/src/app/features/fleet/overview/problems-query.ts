import type {
  AdminDashboardProblemsQueryVariables,
  FleetEventSeverity,
  FleetFaultSystem,
  FleetProblemSourceKind,
  FleetProblemState,
} from '../../../../generated/graphql/operations';
import {
  codecs,
  type FilterCodec,
  type ListDefinition,
  type ListState,
} from '../../../ui/list/list-state';

export const problemSources = [
  'FLEET_ALERT',
  'DIAGNOSTIC',
  'ALARM',
  'REPORTING_GAP',
  'COMMAND',
] as const satisfies readonly FleetProblemSourceKind[];
export const problemSystems = [
  'ENGINE',
  'BRAKES',
  'ABS_EBS',
  'AFTERTREATMENT',
  'OTHER',
] as const satisfies readonly FleetFaultSystem[];
export const problemSeverities = [
  'CRITICAL',
  'WARNING',
  'INFO',
] as const satisfies readonly FleetEventSeverity[];
export const problemStates = [
  'OPEN',
  'ACKNOWLEDGED',
  'RECORDED',
  'FAILED',
  'UNCERTAIN',
  'EXPIRED',
] as const satisfies readonly FleetProblemState[];

export interface ProblemFilters {
  readonly system: readonly FleetFaultSystem[];
  readonly source: readonly FleetProblemSourceKind[];
  readonly severity: readonly FleetEventSeverity[];
  readonly state: readonly FleetProblemState[];
  readonly attention: boolean;
  readonly vehicleIds: readonly string[];
  readonly deviceIds: readonly string[];
  readonly from: string;
  readonly to: string;
}

const instant: FilterCodec<string> = {
  read: (values) => {
    const value = values[0];
    return value &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
      Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString()
      : undefined;
  },
  write: (value) => value ?? null,
  same: (left, right) => left === right,
};

export const problemDefinition: ListDefinition<ProblemFilters, 'occurredAt'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'occurredAt', direction: 'DESC' },
  filters: {
    system: codecs.enumList(problemSystems),
    source: codecs.enumList(problemSources),
    severity: codecs.enumList(problemSeverities),
    state: codecs.enumList(problemStates),
    attention: codecs.boolean(),
    vehicleIds: codecs.idList(100),
    deviceIds: codecs.idList(100),
    from: instant,
    to: instant,
  },
  normalizeFilter: (filter) => {
    if (!filter.from && !filter.to) {
      return filter;
    }
    if (filter.from && filter.to) {
      const duration = Date.parse(filter.to) - Date.parse(filter.from);
      if (duration > 0 && duration <= 93 * 86_400_000) {
        return filter;
      }
    }
    const normalized = { ...filter };
    delete normalized.from;
    delete normalized.to;
    return normalized;
  },
};

export function problemVariables(
  state: ListState<ProblemFilters, 'occurredAt'>,
): AdminDashboardProblemsQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    filter: {
      sourceKinds: state.filter.source ? [...state.filter.source] : null,
      severities: state.filter.severity ? [...state.filter.severity] : null,
      states: state.filter.state ? [...state.filter.state] : null,
      requiringAttention: state.filter.attention ?? null,
      vehicleIds: state.filter.vehicleIds ? [...state.filter.vehicleIds] : null,
      deviceIds: state.filter.deviceIds ? [...state.filter.deviceIds] : null,
      occurredFrom: state.filter.from ?? null,
      occurredTo: state.filter.to ?? null,
    },
  };
}
