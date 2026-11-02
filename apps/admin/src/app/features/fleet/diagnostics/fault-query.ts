import { localReviewField } from './diagnostics-review';
import type { FleetEvidenceSource } from '../../../../generated/graphql/operations';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { codecs, type ListDefinition } from '../../../ui/list/list-state';
import { diagnosticConditions } from './diagnostic-conditions';

export interface FaultFilters {
  readonly source: FleetEvidenceSource;
  readonly conditions: readonly FilterCondition[];
}
export type FaultSort = 'lastObservedAt' | 'code';

const fields: readonly FilterField[] = [
  localReviewField,
  { key: 'vehicle', label: '', type: 'enum', operators: ['isAnyOf'] },
  { key: 'trip', label: '', type: 'enum', operators: ['isAnyOf'] },
  {
    key: 'system',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['COOLING', 'ELECTRICAL'].map((value) => ({ value, label: value })),
  },
  {
    key: 'severity',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['INFO', 'WARNING', 'CRITICAL'].map((value) => ({ value, label: value })),
  },
  {
    key: 'reportedStatus',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['ACTIVE', 'RESOLVED'].map((value) => ({ value, label: value })),
  },
  { key: 'observedOn', label: '', type: 'date', operators: ['on', 'between', 'after', 'before'] },
];

export const faultConditions = diagnosticConditions(fields);

export const faultDefinition: ListDefinition<FaultFilters, FaultSort> = {
  pageSizes: [10, 20, 50],
  defaultPageSize: 20,
  sorts: [
    { param: 'lastObservedAt', field: 'lastObservedAt' },
    { param: 'code', field: 'code' },
  ],
  defaultSort: { field: 'lastObservedAt', direction: 'DESC' },
  filters: {
    source: codecs.choice(['HOLITA_SCENARIO', 'KARMA_API'], 'HOLITA_SCENARIO'),
    conditions: faultConditions,
  },
};
