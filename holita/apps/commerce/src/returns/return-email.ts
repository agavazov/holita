import type { EmailLanguage } from '../local-mailbox/local-mailbox.repository.js';

const copy = {
  bg: {
    subject: 'Получихме заявката ви за връщане',
    reference: 'Номер на заявката',
    date: 'Дата на заявката',
    lines: 'Артикули за връщане',
  },
  en: {
    subject: 'We received your return request',
    reference: 'Request reference',
    date: 'Request date',
    lines: 'Items requested for return',
  },
};

export function returnRequestEmail(
  { id, requestedAt }: { id: string; requestedAt: Date },
  recipient: string,
  language: EmailLanguage,
  lines: { label: string; sku: string; quantity: number }[],
) {
  const text = copy[language];
  const date = new Intl.DateTimeFormat(language === 'bg' ? 'bg-BG' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'Europe/Sofia',
  }).format(requestedAt);
  return {
    template: 'return.requested',
    sourceEventId: id,
    recipient,
    language,
    subject: `${text.subject} · ${id}`,
    body: [
      `${text.reference}: ${id}`,
      `${text.date}: ${date}`,
      '',
      `${text.lines}:`,
      ...lines.map(({ label, sku, quantity }) => `${String(quantity)} × ${label} (${sku})`),
    ].join('\n'),
  };
}
