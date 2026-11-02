import { convertToParamMap, type ParamMap, type Params, type Router } from '@angular/router';
import type { Language } from '../../../i18n/messages';
import { listStateParams, readListState } from '../../../ui/list/list-state';
import { faultConditions, faultDefinition } from './fault-query';
import { logConditions, logDefinition } from './log-query';
import { riskConditions, riskDefinition } from './risk-query';

export type DiagnosticSection = 'faults' | 'logs' | 'risk';
const sections = {
  faults: { conditions: faultConditions, context: 'faultContext', selected: 'fault' },
  logs: { conditions: logConditions, context: 'logContext', selected: 'log' },
  risk: { conditions: riskConditions, context: 'riskContext', selected: 'evaluation' },
};
const commonFields = ['vehicle', 'observedOn', 'trip'];
const contextKeys = [
  'source',
  'conditions',
  'search',
  'sort',
  'order',
  'page',
  'pageSize',
  'fault',
  'log',
  'evaluation',
  'vehicleSummary',
];

function snapshot(params: ParamMap): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of contextKeys) {
    const value = params.get(key);
    if (value !== null) {
      result[key] = value;
    }
  }
  return result;
}
function restored(value: string | null): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (contextKeys.includes(key) && typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function diagnosticsLink(
  router: Router,
  branchId: string,
  language: Language,
  current: DiagnosticSection,
  target: DiagnosticSection,
  params: ParamMap,
  selectedId?: string,
) {
  const saved =
    current === target ? snapshot(params) : restored(params.get(sections[target].context));
  const savedParams = convertToParamMap(saved);
  const targetConditions = sections[target].conditions.read(savedParams.getAll('conditions')) ?? [];
  const currentConditions = sections[current].conditions.read(params.getAll('conditions')) ?? [];
  const conditions = [
    ...targetConditions.filter((row) => !commonFields.includes(row.field)),
    ...currentConditions.filter((row) => commonFields.includes(row.field)),
  ];
  const query: Params =
    target === 'faults'
      ? listStateParams(readListState(savedParams, faultDefinition), faultDefinition)
      : target === 'logs'
        ? listStateParams(readListState(savedParams, logDefinition), logDefinition)
        : listStateParams(readListState(savedParams, riskDefinition), riskDefinition);
  const contexts: Record<string, string | null> = {
    faultContext: params.get('faultContext'),
    logContext: params.get('logContext'),
    riskContext: params.get('riskContext'),
    vehicleContext: params.get('vehicleContext'),
    truckContext: params.get('truckContext'),
  };
  if (selectedId && params.has('vehicleSummary')) {
    contexts['vehicleContext'] = JSON.stringify({
      section: current,
      query: JSON.stringify(snapshot(params)),
    });
  }
  if (current !== target) {
    contexts[sections[current].context] = JSON.stringify(snapshot(params));
  }
  return router.createUrlTree(['/', language, branchId, 'fleet', 'diagnostics', target], {
    queryParams: {
      ...query,
      ...contexts,
      source: params.get('source'),
      conditions: conditions.length ? JSON.stringify(conditions) : null,
      [sections[target].selected]: selectedId ?? saved[sections[target].selected] ?? null,
      vehicleSummary: selectedId ? null : (saved['vehicleSummary'] ?? null),
    },
  });
}

export function vehicleSummaryBackLink(
  router: Router,
  branchId: string,
  language: Language,
  params: ParamMap,
) {
  try {
    const value: unknown = JSON.parse(params.get('vehicleContext') ?? 'null');
    if (
      typeof value !== 'object' ||
      value === null ||
      !('section' in value) ||
      !('query' in value)
    ) {
      return null;
    }
    const { section, query } = value;
    if (
      (section !== 'faults' && section !== 'logs' && section !== 'risk') ||
      typeof query !== 'string'
    ) {
      return null;
    }
    const saved = restored(query);
    if (!saved['vehicleSummary']) {
      return null;
    }
    return router.createUrlTree(['/', language, branchId, 'fleet', 'diagnostics', section], {
      queryParams: {
        ...saved,
        faultContext: params.get('faultContext'),
        logContext: params.get('logContext'),
        riskContext: params.get('riskContext'),
        truckContext: params.get('truckContext'),
      },
    });
  } catch {
    return null;
  }
}
