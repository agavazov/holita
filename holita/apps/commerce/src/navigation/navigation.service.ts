import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CategoriesService } from '../categories/categories.service.js';
import { contentInputError, contentListCriteria } from '../content-validation.js';
import type { ShopNavigation, ShopNavigationLink } from '../generated/graphql/storefront-types.js';
import type {
  NavigationDestinationPage,
  NavigationMenu,
  NavigationMenuItemInput,
  NavigationPlacement,
  QueryNavigationDestinationChoicesArgs,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PagesService } from '../pages/pages.service.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import {
  NavigationRepository,
  type NavigationItemFields,
  type NavigationMenuRow,
} from './navigation.repository.js';

type MenuItemRow = NavigationMenuRow['items'][number];

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Navigation menu ID must be a UUID');
  }
  return id.toLowerCase();
}

function invalidDestination(path: string) {
  return contentInputError(
    path,
    'INVALID_DESTINATION',
    'Choose a destination of the selected type from this shop',
  );
}

function linkLabel(value: string | null | undefined, path: string) {
  const label = value?.trim() ?? '';
  if (label.includes('\u0000') || Array.from(label).length > 200) {
    throw contentInputError(
      path,
      'INVALID_VALUE',
      'Link label must contain at most 200 characters',
    );
  }
  return label || null;
}

function absoluteUrl(value: string | null | undefined, path: string) {
  const url = value?.trim() ?? '';
  const hasControl = Array.from(value ?? '').some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
  if (
    hasControl ||
    Array.from(url).length > 2048 ||
    !/^https?:\/\//iu.test(url) ||
    !URL.parse(url)?.hostname
  ) {
    throw contentInputError(path, 'INVALID_URL', 'Enter an absolute HTTP or HTTPS URL');
  }
  return url;
}

function itemFields(item: NavigationMenuItemInput, sortOrder: number): NavigationItemFields {
  const path = 'items.' + String(sortOrder);
  const labelBg = linkLabel(item.labelBg, path + '.labelBg');
  const labelEn = linkLabel(item.labelEn, path + '.labelEn');
  if (!labelBg && !labelEn) {
    throw contentInputError(
      path + '.labelBg',
      'INVALID_VALUE',
      'Enter a label in at least one language',
    );
  }
  const { destinationType, destinationId } = item;
  const needsId =
    destinationType === 'CATEGORY' ||
    destinationType === 'COLLECTION' ||
    destinationType === 'PAGE';
  if (needsId ? !destinationId || !isUUID(destinationId) : destinationId != null) {
    throw invalidDestination(path + '.destinationId');
  }
  if (destinationType !== 'URL' && item.url != null) {
    throw invalidDestination(path + '.url');
  }
  const id = destinationId?.toLowerCase() ?? null;
  return {
    sortOrder,
    labelBg,
    labelEn,
    destinationType,
    categoryId: destinationType === 'CATEGORY' ? id : null,
    collectionId: destinationType === 'COLLECTION' ? id : null,
    pageId: destinationType === 'PAGE' ? id : null,
    url: destinationType === 'URL' ? absoluteUrl(item.url, path + '.url') : null,
  };
}

function pageHref(shopPath: string, slug: string): string {
  return shopPath + '/pages/' + encodeURIComponent(slug);
}

function publicLink(
  item: MenuItemRow,
  shopPath: string,
  categorySlugs: ReadonlyMap<string, string>,
): ShopNavigationLink | null {
  const { id, labelBg, labelEn, destinationType } = item;
  const link = { id, labelBg, labelEn, external: false };
  switch (destinationType) {
    case 'CATEGORY': {
      const slug = item.categoryId && categorySlugs.get(item.categoryId);
      return slug ? { ...link, href: shopPath + '/categories/' + encodeURIComponent(slug) } : null;
    }
    case 'COLLECTION':
      return item.collection?.active
        ? { ...link, href: shopPath + '/collections/' + encodeURIComponent(item.collection.slug) }
        : null;
    case 'PAGE':
      return item.page?.status === 'PUBLISHED'
        ? { ...link, href: pageHref(shopPath, item.page.slug) }
        : null;
    case 'BLOG':
      return { ...link, href: shopPath + '/blog' };
    case 'URL':
      return item.url ? { ...link, href: item.url, external: true } : null;
  }
}

@Injectable()
export class NavigationService {
  constructor(
    private readonly repository: NavigationRepository,
    private readonly categories: CategoriesService,
    private readonly pages: PagesService,
  ) {}

  async list(context: RequestContext) {
    const rows = await this.repository.list(await requireScope(context, false));
    return rows.map(({ id, placement, _count }) => ({ id, placement, itemCount: _count.items }));
  }

  async find(context: RequestContext, id: string) {
    const scope = await requireScope(context, false);
    const row = await this.repository.find(scope, recordId(id));
    return row ? this.present(scope, row) : null;
  }

  async choices(
    context: RequestContext,
    args: QueryNavigationDestinationChoicesArgs,
  ): Promise<NavigationDestinationPage> {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = contentListCriteria(args);
    switch (args.type) {
      case 'CATEGORY': {
        const result = await this.repository.categoryChoices(scope, offset, limit, words);
        const categories = result.items.length ? await this.categories.publicTree(scope) : [];
        const publicIds = new Set(categories.map(({ id }) => id));
        return {
          ...result,
          items: result.items.map(({ id, name, slug }) => ({
            id,
            name,
            slug,
            visible: publicIds.has(id),
          })),
        };
      }
      case 'COLLECTION': {
        const result = await this.repository.collectionChoices(scope, offset, limit, words);
        return {
          ...result,
          items: result.items.map(({ id, name, slug, active }) => ({
            id,
            name,
            slug,
            visible: active,
          })),
        };
      }
      case 'PAGE': {
        const result = await this.repository.pageChoices(scope, offset, limit, words);
        return {
          ...result,
          items: result.items.map(({ id, titleBg, titleEn, slug, status }) => ({
            id,
            titleBg,
            titleEn,
            slug,
            visible: status === 'PUBLISHED',
          })),
        };
      }
      default:
        throw new BadRequestException('This destination type has no record choices');
    }
  }

  async save(
    context: RequestContext,
    target: { id: string } | { placement: NavigationPlacement },
    input: NavigationMenuItemInput[],
  ) {
    const scope = await requireScope(context, true);
    const menu = 'id' in target ? { id: recordId(target.id) } : target;
    const items = input.map(itemFields);
    const invalidIndex = await this.repository.firstInvalidDestination(scope, items);
    if (invalidIndex !== -1) {
      throw invalidDestination('items.' + String(invalidIndex) + '.destinationId');
    }
    try {
      const row = await this.repository.save(scope, menu, items);
      return await this.present(scope, row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw contentInputError(
            'placement',
            'DUPLICATE_VALUE',
            'This shop already has a menu for this placement',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Navigation menu not found');
        }
        if (error.code === 'P2003') {
          throw new ConflictException('A destination changed while saving');
        }
      }
      throw error;
    }
  }

  async publicLinks(scope: Scope, origin?: string | null): Promise<ShopNavigation> {
    const [menus, policies] = await Promise.all([
      this.repository.menusWithItems(scope),
      this.pages.publishedPolicyLinks(scope),
    ]);
    const categories = await this.categorySlugs(
      scope,
      menus.flatMap(({ items }) => items),
    );
    const shopPath = '/s/' + encodeURIComponent(scope.branchId);
    const result: ShopNavigation = { header: [], footer: [] };
    for (const menu of menus) {
      const slot = menu.placement === 'HEADER' ? result.header : result.footer;
      for (const item of menu.items) {
        const link = publicLink(item, shopPath, categories);
        if (link) {
          slot.push(link);
        }
      }
    }
    const storefrontOrigin = origin ? URL.parse(origin)?.origin : undefined;
    const linkUrl = (href: string) =>
      storefrontOrigin ? (URL.parse(href, storefrontOrigin)?.href ?? href) : href;
    const footerUrls = new Set(result.footer.map(({ href }) => linkUrl(href)));
    for (const { slug, ...link } of policies) {
      const href = pageHref(shopPath, slug);
      if (!footerUrls.has(linkUrl(href))) {
        result.footer.push({ ...link, href, external: false });
      }
    }
    return result;
  }

  private async categorySlugs(scope: Scope, items: MenuItemRow[]) {
    const categories = items.some(({ categoryId }) => categoryId)
      ? await this.categories.publicTree(scope)
      : [];
    return new Map(categories.map(({ id, slug }) => [id, slug]));
  }

  private async present(scope: Scope, menu: NavigationMenuRow): Promise<NavigationMenu> {
    const categories = await this.categorySlugs(scope, menu.items);
    return {
      id: menu.id,
      placement: menu.placement,
      items: menu.items.map((item) => ({
        id: item.id,
        labelBg: item.labelBg,
        labelEn: item.labelEn,
        destinationType: item.destinationType,
        destinationId: item.categoryId ?? item.collectionId ?? item.pageId,
        destinationName: item.category?.name ?? item.collection?.name ?? item.page?.slug ?? null,
        destinationTitleBg: item.page?.titleBg ?? null,
        destinationTitleEn: item.page?.titleEn ?? null,
        destinationVisible: item.categoryId
          ? categories.has(item.categoryId)
          : item.page
            ? item.page.status === 'PUBLISHED'
            : (item.collection?.active ?? null),
        url: item.url,
      })),
    };
  }
}
