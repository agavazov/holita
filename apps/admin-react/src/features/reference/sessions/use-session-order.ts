import { useCustomMutation, useInvalidate } from '@refinedev/core';
import type { DataError } from '../../../data/data-provider.js';
import type { ReferenceSessionDetailsFragment } from '../../../generated/graphql/operations.js';

export function useSessionOrder() {
  const invalidate = useInvalidate();
  return useCustomMutation<
    { items: ReferenceSessionDetailsFragment[] },
    DataError,
    { ids: string[] }
  >({
    mutationOptions: {
      // Cache invalidation survives unmounting; local feedback stays in per-call callbacks.
      onSuccess: async (_response, variables) => {
        await invalidate({ resource: variables.url, invalidates: ['list', 'detail'] });
      },
    },
  });
}
