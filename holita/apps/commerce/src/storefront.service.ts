import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { isUUID } from 'class-validator';
import {
  hashPassword,
  normalizedEmail,
  userName,
  validatePassword,
  verifyPassword,
} from '@osnova/auth';
import { Prisma, type Brand, type Product, type ProductImage } from './generated/prisma/client.js';
import { brandLogoUrl } from './brands/brand-images.js';
import { BrandsRepository } from './brands/brands.repository.js';
import { CategoriesService } from './categories/categories.service.js';
import { CollectionsService } from './collections/collections.service.js';
import type { CatalogueCategory, CatalogueProduct } from './generated/graphql/storefront-types.js';
import type { Scope } from './scope.js';
import { CommerceRepository } from './products/commerce.repository.js';
import { productImageUrl } from './products/product-images.js';
import { ShopperRepository } from './customers/shopper.repository.js';

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
function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function bearer(context: StorefrontContext): string | undefined {
  const value = context.authorization?.match(/^Bearer (holita-shopper\.[A-Za-z0-9_-]{43})$/);
  return value?.[1];
}
function credentials(name: string, email: string, password: string) {
  try {
    validatePassword(password);
    return { name: userName(name), email: normalizedEmail(email) };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw new BadRequestException('Invalid shopper details');
    }
    throw error;
  }
}

function catalogueBrand(brand: Brand) {
  return { id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brandLogoUrl(brand) };
}

function validatePage(offset: number, limit: number): void {
  if (offset < 0 || limit < 1 || limit > 100) {
    throw new BadRequestException('Invalid page');
  }
}

function catalogueProduct(
  item: Product & {
    brand: Brand | null;
    variants: { price: Prisma.Decimal }[];
    images: ProductImage[];
  },
  categories: ReadonlyMap<string, CatalogueCategory>,
): CatalogueProduct {
  const variant = item.variants[0];
  if (!variant) {
    throw new Error('Public catalogue product is missing an active variant');
  }
  const category = item.categoryId ? categories.get(item.categoryId) : undefined;
  const categoryPath: CatalogueCategory[] = [];
  let current = category;
  while (current) {
    categoryPath.push(current);
    current = current.parentId ? categories.get(current.parentId) : undefined;
  }
  const images = item.images.map((image) => ({
    url: productImageUrl(image),
    altText: image.altText,
  }));
  return {
    id: item.id,
    coverImage: images[0] ?? null,
    images,
    name: item.name,
    descriptionBg: item.descriptionBg,
    descriptionEn: item.descriptionEn,
    price: variant.price.toFixed(2),
    brand: item.brand?.status === 'ACTIVE' ? catalogueBrand(item.brand) : null,
    category: category ?? null,
    categoryPath: categoryPath.reverse(),
  };
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly products: CommerceRepository,
    private readonly shoppers: ShopperRepository,
    private readonly brands: BrandsRepository,
    private readonly categories: CategoriesService,
    private readonly collections: CollectionsService,
  ) {}
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
    const scope = await this.publicScope(context);
    validatePage(offset, limit);
    return this.cataloguePage(scope, await this.products.catalogue(scope, offset, limit));
  }
  private async cataloguePage(
    scope: Scope,
    page: Awaited<ReturnType<CommerceRepository['catalogue']>>,
  ) {
    const categories = await this.productCategories(scope, page.items);
    return { ...page, items: page.items.map((item) => catalogueProduct(item, categories)) };
  }
  async product(context: StorefrontContext, id: string) {
    const scope = await this.publicScope(context);
    if (!isUUID(id)) {
      return null;
    }
    const item = await this.products.publicProduct(scope, id.toLowerCase());
    return item ? catalogueProduct(item, await this.productCategories(scope, [item])) : null;
  }
  private async productCategories(scope: Scope, products: readonly Product[]) {
    const tree = products.some((product) => product.categoryId)
      ? await this.categories.publicTree(scope)
      : [];
    return new Map(tree.map((category) => [category.id, category]));
  }
  async publicScope(context: StorefrontContext): Promise<Scope> {
    const shop = await this.requireShop(context);
    return { tenantId: shop.tenantId, branchId: shop.id };
  }
  async catalogueBrands(context: StorefrontContext, offset: number, limit: number) {
    const scope = await this.publicScope(context);
    validatePage(offset, limit);
    return (await this.brands.active(scope, offset, limit)).map(catalogueBrand);
  }
  async catalogueCategories(context: StorefrontContext) {
    return this.categories.publicTree(await this.publicScope(context));
  }
  async catalogueCollections(context: StorefrontContext, offset: number, limit: number) {
    const scope = await this.publicScope(context);
    validatePage(offset, limit);
    return this.collections.publicList(scope, offset, limit);
  }
  async catalogueCollectionProducts(
    context: StorefrontContext,
    slug: string,
    offset: number,
    limit: number,
  ) {
    const scope = await this.publicScope(context);
    validatePage(offset, limit);
    const page = await this.collections.publicProducts(scope, slug, offset, limit);
    return page ? this.cataloguePage(scope, page) : null;
  }
  private async createSession(
    shop: ShopScope,
    shopper: { id: string; name: string; email: string },
  ) {
    const token = `holita-shopper.${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.shoppers.createSession(
      { tenantId: shop.tenantId, branchId: shop.id },
      shopper.id,
      tokenHash(token),
      expiresAt,
    );
    return { token, shopper, expiresAt: expiresAt.toISOString() };
  }
  async register(context: StorefrontContext, name: string, email: string, password: string) {
    const shop = await this.requireShop(context);
    const input = credentials(name, email, password);
    try {
      const shopper = await this.shoppers.create(
        { tenantId: shop.tenantId, branchId: shop.id },
        { ...input, passwordHash: await hashPassword(password) },
      );
      return await this.createSession(shop, shopper);
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
    const shopper = await this.shoppers.findByEmail(
      { tenantId: shop.tenantId, branchId: shop.id },
      address,
    );
    if (!shopper?.passwordHash || !(await verifyPassword(password, shopper.passwordHash))) {
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
    const session = await this.shoppers.findSession(
      { tenantId: shop.tenantId, branchId: shop.id },
      tokenHash(token),
    );
    return session?.customer ?? null;
  }
  async signOut(context: StorefrontContext) {
    const shop = await this.requireShop(context);
    const token = bearer(context);
    if (token) {
      await this.shoppers.deleteSessions(
        { tenantId: shop.tenantId, branchId: shop.id },
        tokenHash(token),
      );
    }
    return true;
  }
}
