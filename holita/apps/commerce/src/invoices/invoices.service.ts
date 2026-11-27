import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isEmail, isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { CartPrice } from '../cart/cart.service.js';
import { contentListCriteria } from '../content-validation.js';
import type {
  Invoice,
  InvoiceIssuerSettings,
  InvoiceIssuerSettingsInput,
  InvoicePage,
  IssueStandaloneInvoiceInput,
  IssueOrderInvoiceInput,
  QueryInvoicesArgs,
} from '../generated/graphql/types.js';
import { requireScope, type RequestContext } from '../scope.js';
import { InvoicesRepository } from './invoices.repository.js';

function invalid(path: string, message: string, code = 'INVALID_VALUE') {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function invoiceDate(value: string): Date | null {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return null;
  }
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function filterDate(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }
  const date = invoiceDate(value);
  if (!date) {
    throw new BadRequestException('Enter a valid issue date');
  }
  return date;
}

function text(value: string | null | undefined, path: string, max: number): string | null {
  const trimmed = value?.trim() ?? '';
  if (Array.from(trimmed).length > max || trimmed.includes('\u0000')) {
    throw invalid(path, 'Invalid invoice field');
  }
  return trimmed || null;
}

function required(value: string | null, path: string): string {
  if (!value) {
    throw invalid(path, 'Enter a value', 'REQUIRED');
  }
  return value;
}

function dateField(value: string | null | undefined, path: string): Date | null {
  if (value == null) {
    return null;
  }
  const date = invoiceDate(value.trim());
  if (!date) {
    throw invalid(path, 'Enter a valid calendar date');
  }
  return date;
}

function issuerFields(input: InvoiceIssuerSettingsInput) {
  return {
    issuerName: text(input.issuerName, 'issuerName', 200),
    issuerCompanyId: text(input.issuerCompanyId, 'issuerCompanyId', 100),
    issuerAddress: text(input.issuerAddress, 'issuerAddress', 1000),
    issuerVatNumber: text(input.issuerVatNumber, 'issuerVatNumber', 100),
    issuerRepresentative: text(input.issuerRepresentative, 'issuerRepresentative', 128),
    issuerBankName: text(input.issuerBankName, 'issuerBankName', 128),
    issuerIban: text(input.issuerIban, 'issuerIban', 64),
    issuerBic: text(input.issuerBic, 'issuerBic', 32),
  };
}

function details(input: IssueOrderInvoiceInput | IssueStandaloneInvoiceInput) {
  const issueDate = invoiceDate(required(text(input.issueDate, 'issueDate', 10), 'issueDate'));
  if (!issueDate) {
    throw invalid('issueDate', 'Enter a valid calendar date');
  }
  const taxEventDate = dateField(input.taxEventDate, 'taxEventDate');
  const dueDate = dateField(input.dueDate, 'dueDate');
  if (dueDate && dueDate < issueDate) {
    throw invalid('dueDate', 'The due date must be on or after the issue date', 'INVALID_RANGE');
  }
  const paymentTermDays = input.paymentTermDays ?? null;
  if (paymentTermDays !== null && (paymentTermDays < 0 || paymentTermDays > 3650)) {
    throw invalid(
      'paymentTermDays',
      'Enter a payment term between 0 and 3650 days',
      'OUT_OF_RANGE',
    );
  }
  const recipientEmail = text(input.recipientEmail, 'recipientEmail', 254);
  if (recipientEmail && !isEmail(recipientEmail)) {
    throw invalid('recipientEmail', 'Enter a valid email address');
  }
  const issuer = issuerFields(input);
  return {
    ...issuer,
    number: required(text(input.number, 'number', 100), 'number'),
    issueDate,
    taxEventDate,
    dueDate,
    paymentTermDays,
    paymentMethod: text(input.paymentMethod, 'paymentMethod', 200),
    paymentStatus: input.paymentStatus ?? null,
    reason: text(input.reason, 'reason', 255),
    note: text(input.note, 'note', 5000),
    issuerName: required(issuer.issuerName, 'issuerName'),
    issuerCompanyId: required(issuer.issuerCompanyId, 'issuerCompanyId'),
    issuerAddress: required(issuer.issuerAddress, 'issuerAddress'),
    recipientName: required(text(input.recipientName, 'recipientName', 200), 'recipientName'),
    recipientAddress: required(
      text(input.recipientAddress, 'recipientAddress', 1000),
      'recipientAddress',
    ),
    recipientCompanyId: text(input.recipientCompanyId, 'recipientCompanyId', 100),
    recipientVatNumber: text(input.recipientVatNumber, 'recipientVatNumber', 100),
    recipientEmail,
    recipientPhone: text(input.recipientPhone, 'recipientPhone', 100),
  };
}

function orderLineUnits(input: IssueOrderInvoiceInput['lineUnits']) {
  const units = new Map<string, string>();
  for (const { orderLineId, unit } of input ?? []) {
    const id = orderLineId.toLowerCase();
    if (!isUUID(id) || units.has(id)) {
      throw invalid('lineUnits', 'Choose each order line only once');
    }
    units.set(id, required(text(unit, 'lineUnits', 32), 'lineUnits'));
  }
  return units;
}

function standaloneLines(input: IssueStandaloneInvoiceInput['lines']) {
  if (!input.length) {
    throw invalid('lines', 'Add at least one invoice line', 'REQUIRED');
  }
  return input.map((line, sortOrder) => {
    const path = `lines.${String(sortOrder)}`;
    const description = required(
      text(line.description, `${path}.description`, 1000),
      `${path}.description`,
    );
    const unit = text(line.unit, `${path}.unit`, 32);
    if (line.quantity < 1) {
      throw invalid(`${path}.quantity`, 'Enter a positive quantity', 'OUT_OF_RANGE');
    }
    const price = line.unitPrice.trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/u.test(price)) {
      throw invalid(`${path}.unitPrice`, 'Enter a non-negative price with up to two decimals');
    }
    const unitPrice = new CartPrice(price);
    return {
      sortOrder,
      description,
      sku: '',
      unit,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice.times(line.quantity),
    };
  });
}

function numberUsed() {
  return invalid('number', 'This invoice number is already in use', 'INVOICE_NUMBER_USED');
}

type InvoiceRow = NonNullable<Awaited<ReturnType<InvoicesRepository['find']>>>;

function present(row: InvoiceRow): Invoice {
  return {
    ...row,
    issueDate: row.issueDate.toISOString().slice(0, 10),
    taxEventDate: row.taxEventDate?.toISOString().slice(0, 10) ?? null,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    subtotal: row.subtotal.toFixed(2),
    discountAmount: row.discountAmount.toFixed(2),
    shippingFee: row.shippingFee.toFixed(2),
    total: row.total.toFixed(2),
    lines: row.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
    })),
  };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly invoices: InvoicesRepository) {}

  async list(context: RequestContext, args: QueryInvoicesArgs): Promise<InvoicePage> {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = contentListCriteria(args);
    const from = filterDate(args.filter?.issueDateFrom);
    const to = filterDate(args.filter?.issueDateTo);
    if (from && to && from > to) {
      throw new BadRequestException('Invalid issue date range');
    }
    const page = await this.invoices.list(scope, offset, limit, words, from, to);
    return {
      ...page,
      items: page.items.map((row) => ({
        ...row,
        issueDate: row.issueDate.toISOString().slice(0, 10),
        total: row.total.toFixed(2),
      })),
    };
  }

  async find(context: RequestContext, orderId: string) {
    const scope = await requireScope(context, false);
    if (!isUUID(orderId)) {
      return null;
    }
    const invoice = await this.invoices.find(scope, orderId.toLowerCase());
    return invoice ? present(invoice) : null;
  }

  async findById(context: RequestContext, id: string) {
    const scope = await requireScope(context, false);
    if (!isUUID(id)) {
      return null;
    }
    const invoice = await this.invoices.findById(scope, id.toLowerCase());
    return invoice ? present(invoice) : null;
  }

  async readIssuerSettings(context: RequestContext): Promise<InvoiceIssuerSettings> {
    const scope = await requireScope(context, false);
    return (await this.invoices.findIssuerSettings(scope)) ?? issuerFields({});
  }

  async updateIssuerSettings(
    context: RequestContext,
    input: InvoiceIssuerSettingsInput,
  ): Promise<InvoiceIssuerSettings> {
    const scope = await requireScope(context, true);
    return this.invoices.saveIssuerSettings(scope, issuerFields(input));
  }

  async issue(context: RequestContext, orderId: string, input: IssueOrderInvoiceInput) {
    const scope = await requireScope(context, true);
    if (!isUUID(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const result = await this.invoices.issue(
      scope,
      orderId.toLowerCase(),
      input.orderReviewRevision,
      details(input),
      orderLineUnits(input.lineUnits),
    );
    switch (result.outcome) {
      case 'missing':
        throw new NotFoundException('Order not found');
      case 'issued':
        throw new GraphQLError('This order already has an invoice', {
          extensions: { code: 'CONFLICT' },
        });
      case 'order-changed':
        throw invalid(
          'orderReviewRevision',
          'Review the updated order before issuing the invoice',
          'INVOICE_ORDER_CHANGED',
        );
      case 'invalid-lines':
        throw invalid('lineUnits', 'The order lines have changed');
      case 'number-used':
        throw numberUsed();
      case 'saved':
        return present(result.invoice);
    }
  }
  async issueStandalone(context: RequestContext, input: IssueStandaloneInvoiceInput) {
    const scope = await requireScope(context, true);
    const result = await this.invoices.issueStandalone(
      scope,
      details(input),
      standaloneLines(input.lines),
    );
    if (result.outcome === 'number-used') {
      throw numberUsed();
    }
    return present(result.invoice);
  }
}
