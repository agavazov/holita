import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isEmail, isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { contentListCriteria } from '../content-validation.js';
import type {
  Invoice,
  InvoicePage,
  IssueOrderInvoiceInput,
  QueryInvoicesArgs,
} from '../generated/graphql/types.js';
import { requireScope, type RequestContext } from '../scope.js';
import { InvoicesRepository } from './invoices.repository.js';

function invalid(path: keyof IssueOrderInvoiceInput, message: string, code = 'INVALID_VALUE') {
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

function details(input: IssueOrderInvoiceInput) {
  const text = (field: keyof IssueOrderInvoiceInput, max: number) => {
    const value = input[field]?.trim() ?? '';
    if (Array.from(value).length > max || value.includes('\u0000')) {
      throw invalid(field, 'Invalid invoice field');
    }
    return value;
  };
  const required = (field: keyof IssueOrderInvoiceInput, max: number) => {
    const value = text(field, max);
    if (!value) {
      throw invalid(field, 'Enter a value', 'REQUIRED');
    }
    return value;
  };
  const issueDate = invoiceDate(required('issueDate', 10));
  if (!issueDate) {
    throw invalid('issueDate', 'Enter a valid calendar date');
  }
  const recipientEmail = text('recipientEmail', 254);
  if (recipientEmail && !isEmail(recipientEmail)) {
    throw invalid('recipientEmail', 'Enter a valid email address');
  }
  return {
    number: required('number', 100),
    issueDate,
    issuerName: required('issuerName', 200),
    issuerCompanyId: required('issuerCompanyId', 100),
    issuerAddress: required('issuerAddress', 1000),
    issuerVatNumber: text('issuerVatNumber', 100) || null,
    recipientName: required('recipientName', 200),
    recipientAddress: required('recipientAddress', 1000),
    recipientCompanyId: text('recipientCompanyId', 100) || null,
    recipientVatNumber: text('recipientVatNumber', 100) || null,
    recipientEmail: recipientEmail || null,
    recipientPhone: text('recipientPhone', 100) || null,
  };
}

type InvoiceRow = NonNullable<Awaited<ReturnType<InvoicesRepository['find']>>>;

function present(row: InvoiceRow): Invoice {
  return {
    ...row,
    issueDate: row.issueDate.toISOString().slice(0, 10),
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

  async issue(context: RequestContext, orderId: string, input: IssueOrderInvoiceInput) {
    const scope = await requireScope(context, true);
    if (!isUUID(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const result = await this.invoices.issue(scope, orderId.toLowerCase(), details(input));
    switch (result.outcome) {
      case 'missing':
        throw new NotFoundException('Order not found');
      case 'issued':
        throw new GraphQLError('This order already has an invoice', {
          extensions: { code: 'CONFLICT' },
        });
      case 'number-used':
        throw invalid('number', 'This invoice number is already in use', 'INVOICE_NUMBER_USED');
      case 'saved':
        return present(result.invoice);
    }
  }
}
