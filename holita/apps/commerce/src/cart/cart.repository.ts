import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { catalogueVariantValues } from '../products/product-relations.js';
import type { Scope } from '../scope.js';

export type CartOwner = { customerId: string } | { guestTokenHash: string };

@Injectable()
export class CartRepository {
  constructor(private readonly database: DatabaseService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work);
  }

  readTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  find(tx: Prisma.TransactionClient, scope: Scope, owner: CartOwner) {
    return tx.cart.findFirst({ where: { ...scope, ...owner }, select: { id: true } });
  }

  async lock(tx: Prisma.TransactionClient, scope: Scope, owner: CartOwner) {
    // Serialize writes and merges on this cart before reading its lines.
    const [cart] = await tx.cart.updateManyAndReturn({
      where: { ...scope, ...owner },
      data: { updatedAt: new Date() },
      select: { id: true },
    });
    return cart;
  }

  async lockCustomerCart(tx: Prisma.TransactionClient, scope: Scope, customerId: string) {
    const owner = { customerId };
    const cart = await this.lock(tx, scope, owner);
    if (cart) {
      return cart;
    }
    await tx.cart.createMany({ data: { ...scope, ...owner }, skipDuplicates: true });
    const created = await this.lock(tx, scope, owner);
    if (!created) {
      throw new Error('Customer cart was not created');
    }
    return created;
  }

  createGuestCart(tx: Prisma.TransactionClient, scope: Scope, guestTokenHash: string) {
    return tx.cart.create({ data: { ...scope, guestTokenHash }, select: { id: true } });
  }

  deleteGuestCart(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return tx.cart.delete({ where: { ...scope, id } });
  }

  lines(tx: Prisma.TransactionClient, scope: Scope, cartId: string) {
    return tx.cartLine.findMany({
      where: { ...scope, cartId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  line(tx: Prisma.TransactionClient, scope: Scope, cartId: string, id: string) {
    return tx.cartLine.findUnique({ where: { ...scope, cartId, id } });
  }

  variantLine(tx: Prisma.TransactionClient, scope: Scope, cartId: string, variantId: string) {
    return tx.cartLine.findUnique({
      where: { tenantId_branchId_cartId_variantId: { ...scope, cartId, variantId } },
      select: { quantity: true },
    });
  }

  async publicVariants(tx: Prisma.TransactionClient, scope: Scope, ids: string[]) {
    if (!ids.length) {
      return [];
    }
    return tx.productVariant.findMany({
      where: { ...scope, id: { in: ids }, active: true, product: { ...scope, status: 'ACTIVE' } },
      select: {
        id: true,
        product: { select: { id: true, name: true } },
        inventoryTracked: true,
        quantity: true,
        price: true,
        values: catalogueVariantValues(scope),
      },
    });
  }

  setVariantQuantity(
    tx: Prisma.TransactionClient,
    scope: Scope,
    cartId: string,
    variantId: string,
    quantity: number,
  ) {
    const identity = { ...scope, cartId, variantId };
    return tx.cartLine.upsert({
      where: { tenantId_branchId_cartId_variantId: identity },
      create: { ...identity, quantity },
      update: { quantity },
    });
  }

  setLineQuantity(
    tx: Prisma.TransactionClient,
    scope: Scope,
    cartId: string,
    id: string,
    quantity: number,
  ) {
    return tx.cartLine.update({ where: { ...scope, cartId, id }, data: { quantity } });
  }

  removeLine(tx: Prisma.TransactionClient, scope: Scope, cartId: string, id: string) {
    return tx.cartLine.deleteMany({ where: { ...scope, cartId, id } });
  }
}
