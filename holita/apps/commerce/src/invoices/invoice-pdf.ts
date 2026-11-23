import { chromium } from 'playwright';
import type { Invoice } from '../generated/graphql/types.js';

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function fact(label: string, value: string | null | undefined): string {
  return value ? `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>` : '';
}

function invoiceHtml(invoice: Invoice): string {
  const title = `Фактура № ${escape(invoice.number)}`;
  const currency = invoice.currency;
  const rows = invoice.lines
    .map(
      (line) => `<tr>
        <td>${escape(line.description)}<small>${escape(line.sku)}</small></td>
        <td class="amount">${String(line.quantity)}</td>
        <td class="amount">${escape(line.unitPrice)}</td>
        <td class="amount">${escape(line.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
    <html lang="bg">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { color: #202830; font: 10.5pt Arial, "Liberation Sans", "DejaVu Sans", sans-serif; }
        h1 { font-size: 21pt; margin: 0 0 12pt; overflow-wrap: anywhere; }
        h2 { font-size: 12pt; margin: 0 0 7pt; }
        dl { margin: 0; }
        dl div { display: grid; grid-template-columns: 88pt 1fr; gap: 6pt; margin-bottom: 4pt; }
        dt { font-weight: bold; }
        dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        .parties { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20pt; margin: 18pt 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        tr { break-inside: avoid; }
        th, td { border-bottom: 1px solid #cbd5df; padding: 6pt; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        th { background: #edf2f6; }
        .item { width: 46%; }
        small { display: block; margin-top: 2pt; color: #4b5763; }
        .amount { text-align: right; font-variant-numeric: tabular-nums; }
        .totals { break-inside: avoid; margin: 16pt 0 0 auto; max-width: 290pt; }
        .totals div { grid-template-columns: 100pt 1fr; }
        .totals dd { text-align: right; font-variant-numeric: tabular-nums; }
        .totals div:last-child { border-top: 1px solid #cbd5df; padding-top: 6pt; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <dl>
        ${fact('Дата на издаване', invoice.issueDate)}
        ${fact('Поръчка', invoice.orderNumber)}
        ${fact('Валута', invoice.currency)}
      </dl>
      <div class="parties">
        <section>
          <h2>Издател</h2>
          <dl>
            ${fact('Име', invoice.issuerName)}
            ${fact('ЕИК', invoice.issuerCompanyId)}
            ${fact('ДДС номер', invoice.issuerVatNumber)}
            ${fact('Адрес', invoice.issuerAddress)}
          </dl>
        </section>
        <section>
          <h2>Получател</h2>
          <dl>
            ${fact('Име', invoice.recipientName)}
            ${fact('ЕИК', invoice.recipientCompanyId)}
            ${fact('ДДС номер', invoice.recipientVatNumber)}
            ${fact('Адрес', invoice.recipientAddress)}
            ${fact('Имейл', invoice.recipientEmail)}
            ${fact('Телефон', invoice.recipientPhone)}
          </dl>
        </section>
      </div>
      <table aria-label="Артикули">
        <thead>
          <tr>
            <th class="item" scope="col">Артикул</th>
            <th class="amount" scope="col">Количество</th>
            <th class="amount" scope="col">Единична цена</th>
            <th class="amount" scope="col">Стойност</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <dl class="totals">
        ${fact('Междинна сума', `${invoice.subtotal} ${currency}`)}
        ${fact('Отстъпка', `${invoice.discountAmount} ${currency}`)}
        ${fact('Доставка', `${invoice.shippingFee} ${currency}`)}
        ${fact('Общо', `${invoice.total} ${currency}`)}
      </dl>
    </body>
    </html>`;
}

export async function renderInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false, offline: true });
    await page.setContent(invoiceHtml(invoice));
    return await page.pdf({
      format: 'A4',
      margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}
