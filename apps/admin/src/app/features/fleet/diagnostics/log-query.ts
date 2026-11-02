import type { FleetEvidenceSource } from '../../../../generated/graphql/operations';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { codecs, type ListDefinition } from '../../../ui/list/list-state';
import { diagnosticConditions } from './diagnostic-conditions';

export interface LogFilters {
  readonly source: FleetEvidenceSource;
  readonly conditions: readonly FilterCondition[];
}
export type LogSort = 'eventAt';
const fields: readonly FilterField[] = [
  { key: 'vehicle', label: '', type: 'enum', operators: ['isAnyOf'] },
  { key: 'trip', label: '', type: 'enum', operators: ['isAnyOf'] },
  { key: 'observedOn', label: '', type: 'date', operators: ['on', 'between', 'after', 'before'] },
  {
    key: 'kind',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: [
      'FAULT_REPORTED',
      'FAULT_STATUS',
      'MEASUREMENT',
      'AVAILABILITY',
      'INTEGRATION_ISSUE',
      'RULE_EVALUATION',
    ].map((value) => ({ value, label: value })),
  },
  {
    key: 'severity',
    label: '',
    type: 'enum',
    operators: ['isAnyOf'],
    options: ['INFO', 'WARNING', 'CRITICAL'].map((value) => ({ value, label: value })),
  },
  { key: 'relatedFault', label: '', type: 'enum', operators: ['isAnyOf'] },
];
export const logConditions = diagnosticConditions(fields);
export const logDefinition: ListDefinition<LogFilters, LogSort> = {
  pageSizes: [10, 20, 50],
  defaultPageSize: 20,
  sorts: [{ param: 'eventAt', field: 'eventAt' }],
  defaultSort: { field: 'eventAt', direction: 'ASC' },
  filters: {
    source: codecs.choice(['HOLITA_SCENARIO', 'KARMA_API'], 'HOLITA_SCENARIO'),
    conditions: logConditions,
  },
};
