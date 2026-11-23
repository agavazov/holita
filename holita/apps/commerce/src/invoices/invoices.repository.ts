import { Injectable } from '@nestjs/common';
import { CartPrice } from '../cart/cart.service.js';
import { checkoutCurrency } from '../checkout/currency.js';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import type { Scope } from '../scope.js';

type IssuerSettings = Omit<Prisma.InvoiceIssuerSettingsCreateManyInput, keyof Scope>;
type InvoiceDetails = Omit<
  Prisma.InvoiceCreateManyInput,
  | keyof Scope
  | 'id'
  | 'orderId'
  | 'orderNumber'
  | 'currency'
  | 'subtotal'
  | 'shippingFee'
  | 'total'
  | 'discountAmount'
>;
type InvoiceLineDetails = Omit<
  Prisma.InvoiceLineCreateManyInput,
  keyof Scope | 'id' | 'invoiceId' | 'lineTotal'
> & { lineTotal: Prisma.Decimal };

function invoiceLines(scope: Scope) {
  return { lines: { where: scope, orderBy: { sortOrder: 'asc' } } } satisfies Prisma.InvoiceInclude;
}

@Injectable()
export class InvoicesRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly orders: OrdersRepository,
  ) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    issueDateFrom: Date | undefined,
    issueDateTo: Date | undefined,
  ) {
    const where: Prisma.InvoiceWhereInput = {
      ...scope,
      issueDate: {
        ...(issueDateFrom ? { gte: issueDateFrom } : {}),
        ...(issueDateTo ? { lte: issueDateTo } : {}),
      },
      AND: words.map((word) => {
        const match = { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' } as const;
        return { OR: [{ number: match }, { recipientName: match }] };
      }),
    };
    const invoice = this.database.client.invoice;
    const [items, total] = await this.database.client.$transaction(
      [
        invoice.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            orderId: true,
            number: true,
            issueDate: true,
            recipientName: true,
            currency: true,
            total: true,
          },
        }),
        invoice.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find(scope: Scope, orderId: string) {
    return this.database.client.invoice.findUnique({
      where: { tenantId_branchId_orderId: { ...scope, orderId } },
      include: invoiceLines(scope),
    });
  }

  findById(scope: Scope, id: string) {
    return this.database.client.invoice.findUnique({
      where: { ...scope, id },
      include: invoiceLines(scope),
    });
  }

  findIssuerSettings(scope: Scope) {
    return this.database.client.invoiceIssuerSettings.findUnique({
      where: { tenantId_branchId: scope },
    });
  }

  saveIssuerSettings(scope: Scope, fields: IssuerSettings) {
    return this.database.client.invoiceIssuerSettings.upsert({
      where: { tenantId_branchId: scope },
      create: { ...scope, ...fields },
      update: fields,
    });
  }

  issue(
    scope: Scope,
    orderId: string,
    details: InvoiceDetails,
    units: ReadonlyMap<string, string>,
  ) {
    return this.orders.transaction(async (tx) => {
      const order = await this.orders.lockOrder(tx, scope, orderId);
      if (!order) {
        return { outcome: 'missing' } as const;
      }
      if (order.invoice) {
        return { outcome: 'issued' } as const;
      }
      const lineIds = new Set(order.lines.map((line) => line.id));
      if ([...units.keys()].some((id) => !lineIds.has(id))) {
        return { outcome: 'invalid-lines' } as const;
      }

      return this.save(
        tx,
        scope,
        {
          ...scope,
          ...details,
          paymentStatus: details.paymentStatus ?? order.paymentStatus,
          orderId,
          orderNumber: order.orderNumber,
          currency: order.currency,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          shippingFee: order.shippingFee,
          total: order.total,
        },
        order.lines.map(({ id, sortOrder, label, sku, quantity, unitPrice }) => ({
          sortOrder,
          description: label,
          sku,
          unit: units.get(id) ?? null,
          quantity,
          unitPrice,
          lineTotal: new CartPrice(unitPrice).times(quantity),
        })),
      );
    });
  }

  issueStandalone(scope: Scope, details: InvoiceDetails, lines: InvoiceLineDetails[]) {
    const total = lines.reduce((sum, line) => sum.plus(line.lineTotal), new CartPrice(0));
    return this.database.client.$transaction((tx) =>
      this.save(
        tx,
        scope,
        {
          ...scope,
          ...details,
          paymentStatus: details.paymentStatus ?? 'UNPAID',
          currency: checkoutCurrency,
          subtotal: total,
          shippingFee: 0,
          total,
        },
        lines,
      ),
    );
  }

  private async save(
    tx: Prisma.TransactionClient,
    scope: Scope,
    data: Prisma.InvoiceCreateManyInput,
    lines: InvoiceLineDetails[],
  ) {
    const [invoice] = await tx.invoice.createManyAndReturn({ data, skipDuplicates: true });
    if (!invoice) {
      return { outcome: 'number-used' } as const;
    }
    await tx.invoiceLine.createMany({
      data: lines.map((line) => ({ ...scope, ...line, invoiceId: invoice.id })),
    });
    const saved = await tx.invoice.findUniqueOrThrow({
      where: { ...scope, id: invoice.id },
      include: invoiceLines(scope),
    });
    return { outcome: 'saved', invoice: saved } as const;
  }
}
