import { localReviewField } from './diagnostics-review';
import type { FleetEvidenceSource } from '../../../../generated/graphql/operations';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { codecs, type ListDefinition } from '../../../ui/list/list-state';
import { diagnosticConditions } from './diagnostic-conditions';

export interface RiskFilters {
  readonly source: FleetEvidenceSource;
  readonly conditions: readonly FilterCondition[];
}
export type RiskSort = 'window';
const fields: readonly FilterField[] = [
  localReviewField,
  { key: 'vehicle', label: '', type: 'enum', operators: ['isAnyOf'] },
  { key: 'trip', label: '', type: 'enum', operators: ['isAnyOf'] },
  { key: 'observedOn', label: '', type: 'date', operators: ['on', 'between', 'after', 'before'] },
  {
    key: 'rule',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['REPEATED_FAULT', 'TEMPERATURE_PATTERN', 'VOLTAGE_PATTERN'].map((value) => ({
      value,
      label: value,
    })),
  },
  {
    key: 'state',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['MATCHED', 'NOT_MATCHED', 'INSUFFICIENT_DATA'].map((value) => ({
      value,
      label: value,
    })),
  },
  {
    key: 'attention',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['MONITOR', 'REVIEW', 'NONE'].map((value) => ({ value, label: value })),
  },
];
export const riskConditions = diagnosticConditions(fields);
export const riskDefinition: ListDefinition<RiskFilters, RiskSort> = {
  pageSizes: [10, 20, 50],
  defaultPageSize: 10,
  sorts: [{ param: 'window', field: 'window' }],
  defaultSort: { field: 'window', direction: 'ASC' },
  filters: {
    source: codecs.choice(['HOLITA_SCENARIO', 'KARMA_API'], 'HOLITA_SCENARIO'),
    conditions: riskConditions,
  },
};
