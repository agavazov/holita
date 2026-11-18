import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { isEmail, isUUID } from 'class-validator';
import { Prisma } from './generated/prisma/client.js';
import { DatabaseService } from './database.service.js';

export interface StorefrontContext {
  branchId: string | undefined;
  authorization: string | undefined;
}
export interface ShopScope {
  id: string;
  tenantId: string;
  name: string;
}
const shopCache = new Map<string, { expires: number; shop: ShopScope | null }>();
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('base64url')}.${(await derive(password, salt)).toString('base64url')}`;
}
async function validPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  const salt = Buffer.from(parts[0], 'base64url');
  const expected = Buffer.from(parts[1], 'base64url');
  if (salt.length !== 16 || expected.length !== 64) {
    return false;
  }
  return timingSafeEqual(expected, await derive(password, salt));
}
function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function bearer(context: StorefrontContext): string | undefined {
  const value = context.authorization?.match(/^Bearer (holita-shopper\.[A-Za-z0-9_-]{43})$/);
  return value?.[1];
}
function credentials(name: string, email: string, password: string) {
  const trimmed = name.trim();
  const address = email.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed.length > 200 ||
    trimmed.includes('\u0000') ||
    address.length > 254 ||
    !isEmail(address) ||
    password.length < 12 ||
    password.length > 128
  ) {
    throw new BadRequestException('Invalid shopper details');
  }
  return { name: trimmed, email: address };
}
@Injectable()
export class StorefrontService {
  constructor(private readonly database: DatabaseService) {}
  async shop(context: StorefrontContext): Promise<ShopScope | null> {
    if (!context.branchId || !isUUID(context.branchId)) {
      return null;
    }
    const id = context.branchId.toLowerCase();
    const cached = shopCache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.shop;
    }
    const url = new URL(process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:12011/graphql');
    url.pathname = '/internal/branches/resolve';
    let value: unknown;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-core-internal-token': process.env.CORE_INTERNAL_AUTH_TOKEN ?? '',
        },
        body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (!response.ok) {
        throw new Error('Core request failed');
      }
      const body: unknown = await response.json();
      value = typeof body === 'object' && body !== null && 'branch' in body ? body.branch : null;
    } catch {
      throw new ServiceUnavailableException('Shop verification is unavailable');
    }
    const shop =
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      value.id === id &&
      'tenantId' in value &&
      typeof value.tenantId === 'string' &&
      'name' in value &&
      typeof value.name === 'string'
        ? { id, tenantId: value.tenantId, name: value.name }
        : null;
    shopCache.set(id, { expires: Date.now() + 5000, shop });
    return shop;
  }
  async requireShop(context: StorefrontContext): Promise<ShopScope> {
    const shop = await this.shop(context);
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    return shop;
  }
  async catalogue(context: StorefrontContext, offset: number, limit: number) {
    const shop = await this.requireShop(context);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const where = { tenantId: shop.tenantId, branchId: shop.id, status: 'ACTIVE' as const };
    const [items, total] = await this.database.client.$transaction([
      this.database.client.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.database.client.product.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ id: item.id, name: item.name, price: item.price.toFixed(2) })),
      total,
      offset,
      limit,
    };
  }
  async product(context: StorefrontContext, id: string) {
    const shop = await this.requireShop(context);
    if (!isUUID(id)) {
      return null;
    }
    const item = await this.database.client.product.findFirst({
      where: { id: id.toLowerCase(), tenantId: shop.tenantId, branchId: shop.id, status: 'ACTIVE' },
    });
    return item ? { id: item.id, name: item.name, price: item.price.toFixed(2) } : null;
  }
  private async createSession(
    shop: ShopScope,
    shopper: { id: string; name: string; email: string },
  ) {
    const token = `holita-shopper.${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.database.client.shopperSession.create({
      data: {
        tenantId: shop.tenantId,
        branchId: shop.id,
        customerId: shopper.id,
        tokenHash: tokenHash(token),
        expiresAt,
      },
    });
    return { token, shopper, expiresAt: expiresAt.toISOString() };
  }
  async register(context: StorefrontContext, name: string, email: string, password: string) {
    const shop = await this.requireShop(context);
    const input = credentials(name, email, password);
    try {
      const shopper = await this.database.client.customer.create({
        data: {
          tenantId: shop.tenantId,
          branchId: shop.id,
          ...input,
          passwordHash: await hashPassword(password),
        },
      });
      return this.createSession(shop, shopper);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Email is already registered');
      }
      throw error;
    }
  }
  async signIn(context: StorefrontContext, email: string, password: string) {
    const shop = await this.requireShop(context);
    const address = email.trim().toLowerCase();
    const shopper = await this.database.client.customer.findFirst({
      where: {
        tenantId: shop.tenantId,
        branchId: shop.id,
        email: { equals: address, mode: 'insensitive' },
      },
    });
    if (!shopper?.passwordHash || !(await validPassword(password, shopper.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.createSession(shop, shopper);
  }
  async me(context: StorefrontContext) {
    const shop = await this.requireShop(context);
    const token = bearer(context);
    if (!token) {
      return null;
    }
    const session = await this.database.client.shopperSession.findFirst({
      where: {
        tokenHash: tokenHash(token),
        tenantId: shop.tenantId,
        branchId: shop.id,
        expiresAt: { gt: new Date() },
        customer: { tenantId: shop.tenantId, branchId: shop.id },
      },
      include: { customer: true },
    });
    return session?.customer ?? null;
  }
  async signOut(context: StorefrontContext) {
    const shop = await this.requireShop(context);
    const token = bearer(context);
    if (token) {
      await this.database.client.shopperSession.deleteMany({
        where: { tenantId: shop.tenantId, branchId: shop.id, tokenHash: tokenHash(token) },
      });
    }
    return true;
  }
}
