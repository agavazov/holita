import { operatorStrings } from '@holita/operator';
import { toneSeverity, type Language } from '@osnova/ui';
import type { OrderReturnStatus } from '../generated/orders-operations';

export function returnStatusText(status: OrderReturnStatus, language: Language): string {
  const text = operatorStrings[language];
  return {
    PENDING: text.returnPending,
    APPROVED: text.returnApproved,
    REJECTED: text.returnRejected,
  }[status];
}

export function returnStatusSeverity(status: OrderReturnStatus) {
  const tones = { PENDING: 'warn', APPROVED: 'success', REJECTED: 'danger' } as const;
  return toneSeverity(tones[status]);
}
