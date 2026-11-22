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
import {
  Prisma,
  type Brand,
  type Product,
  type ProductVariant,
} from './generated/prisma/client.js';
import { brandLogoUrl } from './brands/brand-images.js';
import { BrandsRepository } from './brands/brands.repository.js';
import { CartService, type CartContext } from './cart/cart.service.js';
import { CategoriesService } from './categories/categories.service.js';
import { CharacteristicsService } from './characteristics/characteristics.service.js';
import { CollectionsService } from './collections/collections.service.js';
import type {
  CatalogueCategory,
  CatalogueListing,
  CatalogueOption,
  CataloguePage,
  CatalogueProduct,
  CatalogueVariantSelection,
  QueryCatalogueArgs,
  Shopper,
  ShopperSession,
} from './generated/graphql/storefront-types.js';
import type { Scope } from './scope.js';
import { CatalogueRepository, type BrowseCriteria } from './products/catalogue.repository.js';
import { CommerceRepository } from './products/commerce.repository.js';
import { productImageUrl } from './products/product-images.js';
import {
  compareCatalogueOptionValues,
  trackedVariantQuantity,
} from './products/product-relations.js';
import { ShopperRepository } from './customers/shopper.repository.js';

export interface StorefrontContext {
  branchId: string | undefined;
  authorization: string | undefined;
  cartToken?: string | string[];
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

function categoryPathFor(id: string, categories: ReadonlyMap<string, CatalogueCategory>) {
  const categoryPath: CatalogueCategory[] = [];
  let current = categories.get(id);
  while (current) {
    categoryPath.push(current);
    current = current.parentId ? categories.get(current.parentId) : undefined;
  }
  return categoryPath.reverse();
}

function filterIds(ids: readonly string[]): string[] {
  if (ids.some((id) => !isUUID(id))) {
    throw new BadRequestException('Invalid filter ID');
  }
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

function browseCriteria({
  offset = 0,
  limit = 20,
  filter,
  sort,
}: QueryCatalogueArgs): BrowseCriteria {
  validatePage(offset, limit);
  const search = filter?.search?.trim() ?? '';
  const words = search ? search.split(/\s+/u) : [];
  if (Array.from(search).length > 200 || search.includes('\u0000')) {
    throw new BadRequestException('Invalid search');
  }
  const minPrice = filter?.minPrice ?? null;
  const maxPrice = filter?.maxPrice ?? null;
  if (
    [minPrice, maxPrice].some(
      (price) => price !== null && !/^\d{1,10}(?:\.\d{1,2})?$/.test(price),
    ) ||
    (minPrice !== null && maxPrice !== null && Number(minPrice) > Number(maxPrice))
  ) {
    throw new BadRequestException('Invalid price range');
  }
  return {
    offset,
    limit,
    words,
    minPrice,
    maxPrice,
    sort: sort ?? null,
    brandIds: filterIds(filter?.brandIds ?? []),
    optionValueIds: filterIds(filter?.optionValueIds ?? []),
    inStock: filter?.inStock === true,
  };
}

type CatalogueProductRow = NonNullable<Awaited<ReturnType<CommerceRepository['publicProduct']>>>;
type CatalogueProductSummary = Omit<CatalogueProduct, 'variantSelection'>;
type CataloguePageSummary = Omit<CataloguePage, 'items'> & { items: CatalogueProductSummary[] };
type VariantSelectionRow = Awaited<
  ReturnType<CommerceRepository['publicProductVariantSelections']>
>[number];
interface VariantSelectionBatch {
  ids: Set<string>;
  selections: Promise<Map<string, CatalogueVariantSelection>>;
}

function variantAvailable(variant: Pick<ProductVariant, 'inventoryTracked' | 'quantity'>): boolean {
  return (trackedVariantQuantity(variant) ?? 1) > 0;
}

function catalogueVariantSelection({ variants }: VariantSelectionRow): CatalogueVariantSelection {
  const distinctValues = new Map(
    variants.flatMap(({ values }) =>
      values.map(({ optionValue }) => [optionValue.id, optionValue] as const),
    ),
  );
  const orderedValues = [...distinctValues.values()].sort(compareCatalogueOptionValues);
  const optionGroups = new Map<string, CatalogueOption>();
  for (const { id, label, option } of orderedValues) {
    const group = optionGroups.get(option.id) ?? { ...option, values: [] };
    group.values.push({ id, label });
    optionGroups.set(option.id, group);
  }
  const orderedValueIds = orderedValues.map(({ id }) => id);
  return {
    options: [...optionGroups.values()],
    variants: variants.map((variant) => {
      const valueIds = new Set(variant.values.map(({ optionValue }) => optionValue.id));
      return {
        id: variant.id,
        sku: variant.sku,
        price: variant.price.toFixed(2),
        available: variantAvailable(variant),
        optionValueIds: orderedValueIds.filter((id) => valueIds.has(id)),
      };
    }),
  };
}

function catalogueProduct(
  item: CatalogueProductRow,
  categories: ReadonlyMap<string, CatalogueCategory>,
): CatalogueProductSummary {
  const variant = item.variants[0];
  if (!variant) {
    throw new Error('Public catalogue product is missing an active variant');
  }
  const category = item.categoryId ? categories.get(item.categoryId) : undefined;
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
    available: item.variants.some(variantAvailable),
    brand: item.brand?.status === 'ACTIVE' ? catalogueBrand(item.brand) : null,
    category: category ?? null,
    categoryPath: category ? categoryPathFor(category.id, categories) : [],
    badges: item.badgeAssignments.map(({ badge: { id, name, color } }) => ({ id, name, color })),
    tags: item.tagAssignments.map(({ tag }) => tag),
  };
}

@Injectable()
export class StorefrontService {
  private readonly variantSelectionBatches = new WeakMap<
    StorefrontContext,
    VariantSelectionBatch
  >();

  constructor(
    private readonly products: CommerceRepository,
    private readonly browsing: CatalogueRepository,
    private readonly shoppers: ShopperRepository,
    private readonly carts: CartService,
    private readonly brands: BrandsRepository,
    private readonly categories: CategoriesService,
    private readonly collections: CollectionsService,
    private readonly characteristics: CharacteristicsService,
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
  async catalogue(
    context: StorefrontContext,
    args: QueryCatalogueArgs,
  ): Promise<CataloguePageSummary> {
    const scope = await this.publicScope(context);
    const page = await this.browsing.page(scope, { kind: 'all' }, browseCriteria(args));
    if (!page) {
      throw new Error('Missing shop catalogue');
    }
    return this.cataloguePage(scope, page);
  }
  private async cataloguePage(
    scope: Scope,
    page: NonNullable<Awaited<ReturnType<CatalogueRepository['page']>>>,
    tree?: CatalogueCategory[],
    listing?: CatalogueListing,
  ): Promise<CataloguePageSummary> {
    const categories = tree
      ? new Map(tree.map((category) => [category.id, category]))
      : await this.productCategories(scope, page.items);
    return {
      ...page,
      listing:
        listing ?? (page.listing && { ...page.listing, categoryPath: [], subcategories: [] }),
      facets: { ...page.facets, brands: page.facets.brands.map(catalogueBrand) },
      items: page.items.map((item) => catalogueProduct(item, categories)),
    };
  }
  async product(context: StorefrontContext, id: string) {
    const scope = await this.publicScope(context);
    if (!isUUID(id)) {
      return null;
    }
    const item = await this.products.publicProduct(scope, id.toLowerCase());
    return item ? catalogueProduct(item, await this.productCategories(scope, [item])) : null;
  }
  productVariantSelection(
    context: StorefrontContext,
    id: string,
  ): Promise<CatalogueVariantSelection> {
    let batch = this.variantSelectionBatches.get(context);
    if (!batch) {
      const ids = new Set<string>();
      // GraphQL resolves sibling catalogue items with the same request context.
      const selections = new Promise<void>((resolve) => setImmediate(resolve)).then(async () => {
        this.variantSelectionBatches.delete(context);
        const scope = await this.publicScope(context);
        const rows = await this.products.publicProductVariantSelections(scope, [...ids]);
        return new Map(rows.map((row) => [row.id, catalogueVariantSelection(row)]));
      });
      batch = { ids, selections };
      this.variantSelectionBatches.set(context, batch);
    }
    batch.ids.add(id);
    return batch.selections.then(
      (selections) => selections.get(id) ?? { options: [], variants: [] },
    );
  }
  async productSpecifications(context: StorefrontContext, id: string) {
    return this.characteristics.publicSpecifications(await this.publicScope(context), id);
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
  async catalogueBrandIndex(context: StorefrontContext, offset: number, limit: number) {
    const scope = await this.publicScope(context);
    validatePage(offset, limit);
    const page = await this.browsing.brands(scope, offset, limit);
    return { ...page, items: page.items.map(catalogueBrand) };
  }
  async catalogueTags(context: StorefrontContext, offset: number, limit: number) {
    const scope = await this.publicScope(context);
    validatePage(offset, limit);
    return this.browsing.tags(scope, offset, limit);
  }
  async catalogueListing(
    context: StorefrontContext,
    kind: 'category' | 'brand' | 'collection' | 'tag',
    args: QueryCatalogueArgs & { slug: string },
  ): Promise<CataloguePageSummary | null> {
    const scope = await this.publicScope(context);
    const criteria = browseCriteria(args);
    const { slug } = args;
    if (!slug || slug.length > 400 || slug.includes('\u0000')) {
      return null;
    }
    if (kind !== 'category') {
      const page = await this.browsing.page(scope, { kind, slug }, criteria);
      return page ? this.cataloguePage(scope, page) : null;
    }
    const tree = await this.categories.publicTree(scope);
    const category = tree.find((entry) => entry.slug === slug);
    if (!category) {
      return null;
    }
    const descendants = new Set([category.id]);
    for (const entry of tree) {
      if (entry.parentId && descendants.has(entry.parentId)) {
        descendants.add(entry.id);
      }
    }
    const page = await this.browsing.page(scope, { kind, ids: [...descendants] }, criteria);
    const categories = new Map(tree.map((entry) => [entry.id, entry]));
    return page
      ? this.cataloguePage(scope, page, tree, {
          id: category.id,
          name: category.name,
          slug: category.slug,
          categoryPath: categoryPathFor(category.id, categories),
          subcategories: tree.filter((entry) => entry.parentId === category.id),
        })
      : null;
  }
  private async createSession(
    tx: Prisma.TransactionClient,
    scope: Scope,
    shopper: Shopper,
    cartToken: StorefrontContext['cartToken'],
  ): Promise<ShopperSession> {
    const token = `holita-shopper.${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.shoppers.createSession(tx, scope, shopper.id, tokenHash(token), expiresAt);
    const cartMergeIssues = await this.carts.merge(tx, scope, shopper.id, cartToken);
    return { token, shopper, expiresAt: expiresAt.toISOString(), cartMergeIssues };
  }
  async register(context: StorefrontContext, name: string, email: string, password: string) {
    const scope = await this.publicScope(context);
    const input = credentials(name, email, password);
    const passwordHash = await hashPassword(password);
    try {
      return await this.shoppers.transaction(async (tx) => {
        const shopper = await this.shoppers.create(tx, scope, { ...input, passwordHash });
        return this.createSession(tx, scope, shopper, context.cartToken);
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Email is already registered');
      }
      throw error;
    }
  }
  async signIn(context: StorefrontContext, email: string, password: string) {
    const scope = await this.publicScope(context);
    const address = email.trim().toLowerCase();
    const shopper = await this.shoppers.findByEmail(scope, address);
    if (!shopper?.passwordHash || !(await verifyPassword(password, shopper.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.shoppers.transaction((tx) =>
      this.createSession(tx, scope, shopper, context.cartToken),
    );
  }
  private async verifiedShopper(scope: Scope, context: StorefrontContext) {
    const token = bearer(context);
    if (!token) {
      return null;
    }
    const session = await this.shoppers.findSession(scope, tokenHash(token));
    return session?.customer ?? null;
  }
  async me(context: StorefrontContext) {
    return this.verifiedShopper(await this.publicScope(context), context);
  }
  async cartContext(context: StorefrontContext): Promise<CartContext> {
    const scope = await this.publicScope(context);
    const shopper = await this.verifiedShopper(scope, context);
    if (context.authorization !== undefined && !shopper) {
      throw new UnauthorizedException('Sign in to this shop to access your cart');
    }
    return { scope, customerId: shopper?.id, cartToken: context.cartToken };
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
