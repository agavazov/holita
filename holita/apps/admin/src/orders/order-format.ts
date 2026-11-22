import { operatorStrings } from '@holita/operator';
import { localeOf, toneSeverity, type Language } from '@osnova/ui';
import type { OrderPaymentStatus, OrderStatus } from '../generated/orders-operations';

export const orderStatuses: readonly OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];

const statusLabels = {
  PLACED: 'orderPlaced',
  CONFIRMED: 'orderConfirmed',
  PROCESSING: 'orderProcessing',
  SHIPPED: 'orderShipped',
  COMPLETED: 'orderCompleted',
  CANCELLED: 'orderCancelled',
} satisfies Record<OrderStatus, keyof typeof operatorStrings.en>;

export function orderStatusText(status: OrderStatus, language: Language): string {
  return operatorStrings[language][statusLabels[status]];
}

export function orderStatusSeverity(status: OrderStatus) {
  return toneSeverity(
    (
      {
        PLACED: 'neutral',
        CONFIRMED: 'info',
        PROCESSING: 'accent',
        SHIPPED: 'info',
        COMPLETED: 'success',
        CANCELLED: 'danger',
      } as const
    )[status],
  );
}

export function orderPaymentText(status: OrderPaymentStatus, language: Language): string {
  return status === 'PAID'
    ? operatorStrings[language].orderPaid
    : operatorStrings[language].orderUnpaid;
}

export function orderPaymentSeverity(status: OrderPaymentStatus) {
  return toneSeverity(status === 'PAID' ? 'success' : 'warn');
}

export function orderAmount(amount: string, currency: string, language: Language): string {
  return new Intl.NumberFormat(localeOf(language), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
