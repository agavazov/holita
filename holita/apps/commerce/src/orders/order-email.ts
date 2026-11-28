import type { Order, OrderStatus } from '../generated/prisma/client.js';
import type { EmailLanguage } from '../local-mailbox/local-mailbox.repository.js';

const templates = {
  PLACED: {
    bg: 'Получихме поръчката ви',
    en: 'We received your order',
  },
  CONFIRMED: {
    bg: 'Поръчката ви е потвърдена',
    en: 'Your order is confirmed',
  },
  SHIPPED: {
    bg: 'Поръчката ви е изпратена',
    en: 'Your order has shipped',
  },
  COMPLETED: {
    bg: 'Поръчката ви е завършена',
    en: 'Your order is complete',
  },
  CANCELLED: {
    bg: 'Поръчката ви е отменена',
    en: 'Your order was cancelled',
  },
} satisfies Record<Exclude<OrderStatus, 'PROCESSING'>, Record<EmailLanguage, string>>;

export function orderEmail(
  order: Order,
  status: Exclude<OrderStatus, 'PROCESSING'>,
  sourceEventId: string,
) {
  const language: EmailLanguage = order.emailLanguage === 'en' ? 'en' : 'bg';
  const { orderNumber, contactEmail, contactName } = order;
  const message = templates[status][language];
  const greeting = language === 'bg' ? 'Здравейте' : 'Hello';
  const orderLabel = language === 'bg' ? 'Номер на поръчката' : 'Order number';
  const lines = [
    `${greeting}, ${contactName}!`,
    '',
    `${message}.`,
    `${orderLabel}: ${orderNumber}`,
  ];
  if (status === 'PLACED') {
    const total = order.total.toFixed(2);
    lines.push(
      language === 'bg'
        ? `Общо: ${total.replace('.', ',')} ${order.currency}`
        : `Total: ${total} ${order.currency}`,
    );
  }
  return {
    template: `order.${status.toLowerCase()}`,
    sourceEventId,
    recipient: contactEmail,
    language,
    subject: `${message} · ${orderNumber}`,
    body: lines.join('\n'),
  };
}
