import type {
  FleetEventSeverity,
  FleetProblemSortField,
  FleetProblemState,
} from '../../../generated/graphql/operations';
import { codecs, type ListDefinition } from '../../ui/list/list-state';
import { problemSeverities, problemStates } from '../fleet/overview/problems-query';

interface DeviceProblemFilters {
  readonly severity: readonly FleetEventSeverity[];
  readonly state: readonly FleetProblemState[];
}

export const deviceProblemDefinition: ListDefinition<DeviceProblemFilters, FleetProblemSortField> =
  {
    pageSizes: [10, 20, 50, 100],
    defaultPageSize: 20,
    sorts: [
      { param: 'time', field: 'TIME' },
      { param: 'source', field: 'SOURCE' },
      { param: 'severity', field: 'SEVERITY' },
      { param: 'state', field: 'STATE' },
    ],
    defaultSort: { field: 'TIME', direction: 'DESC' },
    filters: {
      severity: codecs.enumList(problemSeverities),
      state: codecs.enumList(problemStates),
    },
  };
