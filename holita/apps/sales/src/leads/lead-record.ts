import { computed, inject, resource, type Signal } from '@angular/core';
import type { SalesLeadFieldsFragment } from '../generated/leads-operations';
import { LeadsApi } from './leads-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function leadLabel(lead: SalesLeadFieldsFragment): string {
  return lead.displayName ?? lead.websiteUrl ?? lead.id;
}

export function injectLeadRecord(id: Signal<string | null>) {
  const api = inject(LeadsApi);
  const validId = computed(() => uuid.test(id() ?? ''));
  const record = resource({
    params: () => {
      const scope = api.scope();
      const key = id();
      return scope && key && validId() ? { scope, id: key } : undefined;
    },
    loader: ({ params }) => api.find(params.scope, params.id),
  });
  return {
    record,
    validId,
    lead: computed(() => (record.hasValue() ? (record.value() ?? null) : null)),
  };
}
