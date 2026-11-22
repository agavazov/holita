import type { OrderPaymentStatus, OrderStatus } from './generated/operations';
import type { messages } from './storefront-messages';

type StatusPresentation = {
  readonly label: keyof typeof messages.bg;
  readonly tone: string;
};

export const orderStatuses = {
  PLACED: { label: 'orderStatusPlaced', tone: 'INFO' },
  CONFIRMED: { label: 'orderStatusConfirmed', tone: 'INFO' },
  PROCESSING: { label: 'orderStatusProcessing', tone: 'INFO' },
  SHIPPED: { label: 'orderStatusShipped', tone: 'INFO' },
  COMPLETED: { label: 'orderStatusCompleted', tone: 'SUCCESS' },
  CANCELLED: { label: 'orderStatusCancelled', tone: 'DANGER' },
} as const satisfies Record<OrderStatus, StatusPresentation>;

export const paymentStatuses = {
  UNPAID: { label: 'paymentUnpaid', tone: 'WARN' },
  PAID: { label: 'paymentPaid', tone: 'SUCCESS' },
} as const satisfies Record<OrderPaymentStatus, StatusPresentation>;
