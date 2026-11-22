import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { hash, randomBytes } from 'node:crypto';
import { isUUID } from 'class-validator';
import type {
  Cart,
  CartAddResult,
  CartIssue,
  CartLine,
  CartMergeIssue,
} from '../generated/graphql/storefront-types.js';
import { Prisma, type CartLine as StoredCartLine } from '../generated/prisma/client.js';
import { productImageUrl } from '../products/product-images.js';
import { catalogueOptionLabels, trackedVariantQuantity } from '../products/product-relations.js';
import type { Scope } from '../scope.js';
import { CartRepository, type CartOwner } from './cart.repository.js';

const MAX_QUANTITY = 2_147_483_647;
// A full-size price multiplied by an Int quantity can exceed Decimal's default precision.
export const CartPrice = Prisma.Decimal.clone({ precision: 32 });
type CartToken = string | string[] | undefined;
type PublicVariant = Awaited<ReturnType<CartRepository['publicVariants']>>[number];

export interface CartContext {
  scope: Scope;
  customerId: string | undefined;
  cartToken: CartToken;
}

function guestOwner(token: CartToken) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? { guestTokenHash: hash('sha256', token, 'hex') }
    : undefined;
}

export function cartMissing() {
  const message = 'Cart not found';
  return new NotFoundException({
    message,
    fieldErrors: [{ path: 'cart', code: 'CART_NOT_FOUND', message }],
  });
}

export function cartOwner({ customerId, cartToken }: CartContext): CartOwner | undefined {
  return customerId ? { customerId } : guestOwner(cartToken);
}

function ownerFor(context: CartContext) {
  const owner = cartOwner(context);
  if (context.cartToken !== undefined && !owner) {
    throw cartMissing();
  }
  return owner;
}

function inputIssue(path: string, code: string, message: string) {
  return new UnprocessableEntityException({
    message,
    fieldErrors: [{ path, code, message }],
  });
}

function recordId(id: string, path: 'lineId' | 'variantId'): string {
  if (!isUUID(id)) {
    throw inputIssue(path, 'INVALID_VALUE', 'Enter a valid ID');
  }
  return id.toLowerCase();
}

function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw inputIssue('quantity', 'INVALID_VALUE', 'Enter a positive whole quantity');
  }
}

function issueFor(variant: PublicVariant | undefined, quantity: number): CartIssue | null {
  if (!variant) {
    return 'UNAVAILABLE';
  }
  const available = trackedVariantQuantity(variant);
  return quantity > (available ?? MAX_QUANTITY) ? 'INSUFFICIENT_STOCK' : null;
}

function validateVariant(variant: PublicVariant | undefined, quantity: number): void {
  const issue = issueFor(variant, quantity);
  if (issue === 'UNAVAILABLE') {
    throw inputIssue('variantId', issue, 'Variant is unavailable');
  }
  if (issue === 'INSUFFICIENT_STOCK') {
    throw inputIssue('quantity', issue, 'Requested quantity is unavailable');
  }
}

function variantIds(lines: StoredCartLine[]) {
  return lines.flatMap(({ variantId }) => variantId ?? []);
}

function presentLine(line: StoredCartLine, variant: PublicVariant | undefined): CartLine {
  const image = variant?.product.images[0];
  const issue = issueFor(variant, line.quantity);
  return {
    id: line.id,
    variantId: variant?.id ?? null,
    productId: variant?.product.id ?? null,
    name: variant?.product.name ?? null,
    coverImage: image ? { url: productImageUrl(image), altText: image.altText } : null,
    optionLabels: variant ? catalogueOptionLabels(variant.values) : [],
    quantity: line.quantity,
    unitPrice: variant?.price.toFixed(2) ?? null,
    lineTotal: variant ? new CartPrice(variant.price).mul(line.quantity).toFixed(2) : null,
    available: issue === null,
    issue,
  };
}

@Injectable()
export class CartService {
  constructor(private readonly carts: CartRepository) {}

  async read(context: CartContext): Promise<Cart> {
    const ownedCart = await this.carts.readTransaction((tx) => this.readOwned(tx, context));
    return ownedCart?.cart ?? { lines: [], itemCount: 0, subtotal: '0.00' };
  }

  async readOwned(tx: Prisma.TransactionClient, context: CartContext) {
    const { scope } = context;
    const owner = ownerFor(context);
    if (!owner) {
      return null;
    }
    const cart = await this.carts.find(tx, scope, owner);
    if (!cart && 'guestTokenHash' in owner) {
      throw cartMissing();
    }
    return cart ? { id: cart.id, cart: await this.present(tx, scope, cart.id) } : null;
  }

  add(context: CartContext, id: string, quantity: number): Promise<CartAddResult> {
    const { scope } = context;
    const variantId = recordId(id, 'variantId');
    validateQuantity(quantity);
    const owner = ownerFor(context);
    return this.carts.transaction(async (tx) => {
      let cart: { id: string } | undefined;
      let guestCartToken: string | null = null;
      if (!owner) {
        guestCartToken = randomBytes(32).toString('base64url');
        cart = await this.carts.createGuestCart(tx, scope, hash('sha256', guestCartToken, 'hex'));
      } else if ('customerId' in owner) {
        cart = await this.carts.lockCustomerCart(tx, scope, owner.customerId);
      } else {
        cart = await this.carts.lock(tx, scope, owner);
      }
      if (!cart) {
        throw cartMissing();
      }
      const existing = await this.carts.variantLine(tx, scope, cart.id, variantId);
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      validateQuantity(nextQuantity);
      const [variant] = await this.carts.publicVariants(tx, scope, [variantId]);
      validateVariant(variant, nextQuantity);
      await this.carts.setVariantQuantity(tx, scope, cart.id, variantId, nextQuantity);
      return { cart: await this.present(tx, scope, cart.id), guestCartToken };
    });
  }

  update(context: CartContext, id: string, quantity: number): Promise<Cart> {
    const { scope } = context;
    const lineId = recordId(id, 'lineId');
    validateQuantity(quantity);
    return this.carts.transaction(async (tx) => {
      const cart = await this.lockForLine(tx, context);
      const line = await this.carts.line(tx, scope, cart.id, lineId);
      if (!line) {
        throw new NotFoundException('Cart line not found');
      }
      const [variant] = await this.carts.publicVariants(tx, scope, variantIds([line]));
      validateVariant(variant, quantity);
      await this.carts.setLineQuantity(tx, scope, cart.id, lineId, quantity);
      return this.present(tx, scope, cart.id);
    });
  }

  remove(context: CartContext, id: string): Promise<Cart> {
    const { scope } = context;
    const lineId = recordId(id, 'lineId');
    return this.carts.transaction(async (tx) => {
      const cart = await this.lockForLine(tx, context);
      const removed = await this.carts.removeLine(tx, scope, cart.id, lineId);
      if (!removed.count) {
        throw new NotFoundException('Cart line not found');
      }
      return this.present(tx, scope, cart.id);
    });
  }

  async merge(
    tx: Prisma.TransactionClient,
    scope: Scope,
    customerId: string,
    cartToken: CartToken,
  ): Promise<CartMergeIssue[]> {
    const owner = guestOwner(cartToken);
    const guest = owner && (await this.carts.lock(tx, scope, owner));
    if (!guest) {
      return [];
    }
    const lines = await this.carts.lines(tx, scope, guest.id);
    const issues = lines.length ? await this.mergeLines(tx, scope, customerId, lines) : [];
    await this.carts.deleteGuestCart(tx, scope, guest.id);
    return issues;
  }

  private async mergeLines(
    tx: Prisma.TransactionClient,
    scope: Scope,
    customerId: string,
    lines: StoredCartLine[],
  ): Promise<CartMergeIssue[]> {
    const customerCart = await this.carts.lockCustomerCart(tx, scope, customerId);
    const customerLines = await this.carts.lines(tx, scope, customerCart.id);
    const quantities = new Map(
      customerLines.map(({ variantId, quantity }) => [variantId, quantity]),
    );
    const variants = await this.variantMap(tx, scope, lines);
    const issues: CartMergeIssue[] = [];
    for (const { variantId, quantity } of lines) {
      const variant = variantId ? variants.get(variantId) : undefined;
      const nextQuantity = (quantities.get(variantId) ?? 0) + quantity;
      const reason = issueFor(variant, nextQuantity);
      if (reason) {
        issues.push({ name: variant?.product.name ?? null, quantity, reason });
      } else if (variant) {
        await this.carts.setVariantQuantity(tx, scope, customerCart.id, variant.id, nextQuantity);
      }
    }
    return issues;
  }

  private async lockForLine(tx: Prisma.TransactionClient, context: CartContext) {
    const owner = ownerFor(context);
    const cart = owner && (await this.carts.lock(tx, context.scope, owner));
    if (!cart) {
      if (owner && 'guestTokenHash' in owner) {
        throw cartMissing();
      }
      throw new NotFoundException('Cart line not found');
    }
    return cart;
  }

  private async variantMap(tx: Prisma.TransactionClient, scope: Scope, lines: StoredCartLine[]) {
    const variants = await this.carts.publicVariants(tx, scope, variantIds(lines));
    return new Map(variants.map((variant) => [variant.id, variant]));
  }

  async snapshot(tx: Prisma.TransactionClient, scope: Scope, cartId: string) {
    const lines = await this.carts.lines(tx, scope, cartId);
    const variants = await this.variantMap(tx, scope, lines);
    let itemCount = 0;
    let subtotal = new CartPrice(0);
    const presented = lines.map((line) => {
      const result = presentLine(line, line.variantId ? variants.get(line.variantId) : undefined);
      itemCount += line.quantity;
      if (!result.issue && result.lineTotal) {
        subtotal = subtotal.plus(result.lineTotal);
      }
      return result;
    });
    const cart: Cart = { lines: presented, itemCount, subtotal: subtotal.toFixed(2) };
    return { cart, variants };
  }

  private async present(tx: Prisma.TransactionClient, scope: Scope, cartId: string): Promise<Cart> {
    return (await this.snapshot(tx, scope, cartId)).cart;
  }
}
