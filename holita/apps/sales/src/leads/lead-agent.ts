import { inject, resource } from '@angular/core';
import type { SalesAgentFieldsFragment } from '../generated/leads-operations';
import type { leadStrings } from './lead-strings';
import { LeadsApi } from './leads-api';

export function agentLabel(
  agent: SalesAgentFieldsFragment | undefined,
  text: (typeof leadStrings)['en'],
): string {
  return agent
    ? agent.active
      ? agent.name
      : `${text.inactiveAgent} · ${agent.name}`
    : text.unknownAgent;
}

export function injectLeadAgents(
  selection: 'eligible' | 'assigned' | (() => (string | null | undefined)[]) = 'eligible',
) {
  const api = inject(LeadsApi);
  return resource({
    params: () => {
      const scope = api.scope();
      const source =
        typeof selection === 'function'
          ? [...new Set(selection().filter((id): id is string => !!id))]
          : selection;
      return scope && (!Array.isArray(source) || source.length) ? { scope, source } : undefined;
    },
    loader: ({ params, abortSignal }) => api.agents(params.scope, params.source, abortSignal),
  });
}
