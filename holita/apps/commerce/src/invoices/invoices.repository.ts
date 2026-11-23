import { Injectable } from '@nestjs/common';
import { CartPrice } from '../cart/cart.service.js';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import type { Scope } from '../scope.js';

type InvoiceDetails = Pick<
  Prisma.InvoiceCreateManyInput,
  | 'number'
  | 'issueDate'
  | 'issuerName'
  | 'issuerCompanyId'
  | 'issuerAddress'
  | 'issuerVatNumber'
  | 'recipientName'
  | 'recipientAddress'
  | 'recipientCompanyId'
  | 'recipientVatNumber'
  | 'recipientEmail'
  | 'recipientPhone'
>;

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

  issue(scope: Scope, orderId: string, details: InvoiceDetails) {
    return this.orders.transaction(async (tx) => {
      const order = await this.orders.lockOrder(tx, scope, orderId);
      if (!order) {
        return { outcome: 'missing' } as const;
      }
      if (order.invoice) {
        return { outcome: 'issued' } as const;
      }

      const [invoice] = await tx.invoice.createManyAndReturn({
        data: {
          ...scope,
          ...details,
          orderId,
          orderNumber: order.orderNumber,
          currency: order.currency,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          shippingFee: order.shippingFee,
          total: order.total,
        },
        skipDuplicates: true,
      });
      if (!invoice) {
        return { outcome: 'number-used' } as const;
      }

      await tx.invoiceLine.createMany({
        data: order.lines.map(({ sortOrder, label, sku, quantity, unitPrice }) => ({
          ...scope,
          invoiceId: invoice.id,
          sortOrder,
          description: label,
          sku,
          quantity,
          unitPrice,
          lineTotal: new CartPrice(unitPrice).times(quantity),
        })),
      });
      const saved = await tx.invoice.findUniqueOrThrow({
        where: { ...scope, id: invoice.id },
        include: invoiceLines(scope),
      });
      return { outcome: 'saved', invoice: saved } as const;
    });
  }
}
