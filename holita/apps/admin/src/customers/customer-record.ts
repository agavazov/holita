import { computed, inject, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRoute } from '@angular/router';
import type { OperatorCustomerQuery } from '../generated/customers-operations';
import { CustomersApi } from './customers-api';

export const customerRecordIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function injectCustomerRecord(route: ActivatedRoute, enabled: () => boolean = () => true) {
  const api = inject(CustomersApi);
  const routeParams = toSignal(route.paramMap, { requireSync: true });
  const id = computed(() => routeParams().get('recordId') ?? '');
  const validId = computed(() => customerRecordIdPattern.test(id()));
  const params = computed(() => {
    const scope = api.scope();
    return scope && validId() && enabled() ? { scope, id: id() } : undefined;
  });
  const record = resource({
    params,
    loader: ({ params }) => api.find(params.scope, params.id),
  });
  const profile = linkedSignal<
    { params: ReturnType<typeof params>; data: OperatorCustomerQuery['customer'] | undefined },
    OperatorCustomerQuery['customer']
  >({
    source: () => ({ params: params(), data: record.hasValue() ? record.value() : undefined }),
    computation: (current, previous) =>
      current.data !== undefined
        ? current.data
        : previous?.source.params === current.params
          ? (previous?.value ?? null)
          : null,
  });
  return { id, validId, params, record, profile };
}
