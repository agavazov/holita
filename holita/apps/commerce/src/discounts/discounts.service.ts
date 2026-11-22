import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isISO8601, isUUID } from 'class-validator';
import { checkoutCurrency } from '../checkout/currency.js';
import type { CartDiscount, CartDiscountIssue } from '../generated/graphql/storefront-types.js';
import type {
  Discount,
  DiscountInput,
  DiscountPage,
  QueryDiscountsArgs,
} from '../generated/graphql/types.js';
import { Prisma, type Discount as StoredDiscount } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import { DiscountsRepository } from './discounts.repository.js';

function fieldError(path: string, code: string, message: string) {
  return new UnprocessableEntityException({ message, fieldErrors: [{ path, code, message }] });
}

const promoMessages: Record<CartDiscountIssue, string> = {
  INVALID: 'Promo code is unavailable',
  NOT_STARTED: 'Promo code is not valid yet',
  EXPIRED: 'Promo code has expired',
  MINIMUM_NOT_MET: 'Cart subtotal is below the promo code minimum',
  EXHAUSTED: 'Promo code has reached its usage limit',
};

export function promoError(issue: CartDiscountIssue) {
  return fieldError('code', `PROMO_${issue}`, promoMessages[issue]);
}

function normalizedCode(value: string): string | null {
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,64}$/u.test(trimmed) ? trimmed.toUpperCase() : null;
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Discount ID must be a UUID');
  }
  return id.toLowerCase();
}

function decimal(raw: string, path: 'value' | 'minSubtotal') {
  const value = raw.trim();
  if (!/^\d{1,30}(?:\.\d{1,2})?$/u.test(value)) {
    throw fieldError(path, 'INVALID_VALUE', 'Enter a decimal with up to two decimal places');
  }
  return new Prisma.Decimal(value);
}

function instant(raw: string | null | undefined, path: 'startsAt' | 'endsAt') {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (
    !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
    !isISO8601(value, { strict: true, strictSeparator: true }) ||
    Number.isNaN(date.getTime())
  ) {
    throw fieldError(path, 'INVALID_VALUE', 'Enter an ISO date and time with a time zone');
  }
  return date;
}

function fields(input: DiscountInput) {
  const code = normalizedCode(input.code);
  if (!code) {
    throw fieldError(
      'code',
      'INVALID_VALUE',
      'Use 1 to 64 letters, digits, hyphens or underscores',
    );
  }
  const { type, enabled, usageLimit = null } = input;
  const value = decimal(input.value, 'value');
  if (value.lte(0) || (type === 'PERCENTAGE' && value.gt(100))) {
    throw fieldError('value', 'INVALID_VALUE', 'Enter a positive amount or a percentage up to 100');
  }
  if (usageLimit !== null && usageLimit < 1) {
    throw fieldError('usageLimit', 'INVALID_VALUE', 'Enter a positive whole number');
  }
  const startsAt = instant(input.startsAt, 'startsAt');
  const endsAt = instant(input.endsAt, 'endsAt');
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw fieldError('endsAt', 'INVALID_WINDOW', 'The end must follow the start');
  }
  const minimum = input.minSubtotal?.trim();
  const minSubtotal = minimum ? decimal(minimum, 'minSubtotal') : null;
  return { code, type, value, enabled, startsAt, endsAt, minSubtotal, usageLimit };
}

function present(row: StoredDiscount): Discount {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value.toFixed(2),
    enabled: row.enabled,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    minSubtotal: row.minSubtotal?.toFixed(2) ?? null,
    usageLimit: row.usageLimit,
    redeemedCount: row.redeemedCount,
    currency: checkoutCurrency,
  };
}

function issueFor(
  row: StoredDiscount,
  subtotal: Prisma.Decimal,
  now: Date,
): CartDiscountIssue | null {
  if (!row.enabled) {
    return 'INVALID';
  }
  if (row.startsAt && row.startsAt > now) {
    return 'NOT_STARTED';
  }
  if (row.endsAt && row.endsAt <= now) {
    return 'EXPIRED';
  }
  if (row.minSubtotal && subtotal.lt(row.minSubtotal)) {
    return 'MINIMUM_NOT_MET';
  }
  if (row.usageLimit !== null && row.redeemedCount >= row.usageLimit) {
    return 'EXHAUSTED';
  }
  return null;
}

function calculate(row: StoredDiscount, subtotal: Prisma.Decimal): CartDiscount {
  const { code, type, value } = row;
  const issue = issueFor(row, subtotal, new Date());
  if (issue) {
    return { code, amount: '0.00', issue };
  }
  const amount = type === 'PERCENTAGE' ? subtotal.mul(value.div(100)) : value;
  return { code, amount: (amount.lt(subtotal) ? amount : subtotal).toFixed(2), issue: null };
}

@Injectable()
export class DiscountsService {
  constructor(private readonly repository: DiscountsRepository) {}

  async list(
    context: RequestContext,
    { offset = 0, limit = 20, search: rawSearch, sort }: QueryDiscountsArgs,
  ): Promise<DiscountPage> {
    const scope = await requireScope(context, false);
    const search = (rawSearch ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.repository.list(scope, offset, limit, words, sort);
    return { ...page, items: page.items.map(present), currency: checkoutCurrency };
  }

  async find(context: RequestContext, id: string): Promise<Discount | null> {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async save(context: RequestContext, input: DiscountInput, id?: string): Promise<Discount> {
    const scope = await requireScope(context, true);
    const data = fields(input);
    try {
      const row =
        id === undefined
          ? await this.repository.create(scope, data)
          : await this.repository.update(scope, recordId(id), data);
      return present(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw fieldError('code', 'DUPLICATE_VALUE', 'This shop already uses the promo code');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Discount not found');
        }
      }
      throw error;
    }
  }

  async apply(
    tx: Prisma.TransactionClient,
    scope: Scope,
    rawCode: string,
    subtotal: Prisma.Decimal,
  ) {
    const code = normalizedCode(rawCode);
    const row = code && (await this.repository.byCode(tx, scope, code));
    if (!row) {
      throw promoError('INVALID');
    }
    const discount = calculate(row, subtotal);
    if (discount.issue) {
      throw promoError(discount.issue);
    }
    return { id: row.id, discount };
  }

  async preview(tx: Prisma.TransactionClient, scope: Scope, id: string, subtotal: Prisma.Decimal) {
    const row = await this.repository.find(scope, id, tx);
    if (!row) {
      throw promoError('INVALID');
    }
    return calculate(row, subtotal);
  }

  lock(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return this.repository.lock(tx, scope, id);
  }

  redeem(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return this.repository.redeem(tx, scope, id);
  }
}
