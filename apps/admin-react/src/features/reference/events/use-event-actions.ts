import { useCustomMutation, useInvalidate } from '@refinedev/core';
import type { DataError } from '../../../data/data-provider.js';
import type { EventAction } from '../../../data/events-provider.js';
import type { SetReferenceEventsStatusMutation } from '../../../generated/graphql/operations.js';

export function useEventActions() {
  const invalidate = useInvalidate();
  return useCustomMutation<
    SetReferenceEventsStatusMutation['setReferenceEventsStatus'],
    DataError,
    EventAction
  >({
    mutationOptions: {
      onSuccess: async (_result, variables) => {
        await Promise.all([
          invalidate({ resource: variables.url, invalidates: ['list'] }),
          ...variables.values.ids.flatMap((id) => [
            invalidate({ resource: variables.url, id, invalidates: ['detail'] }),
            invalidate({ resource: `${variables.url}/${id}/history`, invalidates: ['list'] }),
          ]),
        ]);
      },
    },
  });
}
