import { hash } from 'node:crypto';
import type { Order, OrderLine } from '../generated/prisma/client.js';

type ReviewedOrder = Pick<
  Order,
  'id' | 'orderNumber' | 'currency' | 'subtotal' | 'discountAmount' | 'shippingFee' | 'total'
> & {
  lines: readonly Pick<
    OrderLine,
    'id' | 'sortOrder' | 'label' | 'sku' | 'quantity' | 'unitPrice'
  >[];
};

export function invoiceOrderRevision(order: ReviewedOrder): string {
  return hash(
    'sha256',
    JSON.stringify([
      order.id,
      order.orderNumber,
      order.currency,
      order.subtotal.toFixed(2),
      order.discountAmount.toFixed(2),
      order.shippingFee.toFixed(2),
      order.total.toFixed(2),
      order.lines.map(({ id, sortOrder, label, sku, quantity, unitPrice }) => [
        id,
        sortOrder,
        label,
        sku,
        quantity,
        unitPrice.toFixed(2),
      ]),
    ]),
    'hex',
  );
}
