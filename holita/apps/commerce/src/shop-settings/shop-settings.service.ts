import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { CategoriesService } from '../categories/categories.service.js';
import { contentInputError } from '../content-validation.js';
import type { PublicShopHome } from '../generated/graphql/storefront-types.js';
import type { ShopSettings, ShopSettingsInput } from '../generated/graphql/types.js';
import {
  imageDirectory,
  imageType,
  maxImageBytes,
  rasterUpload,
  readImage,
  removeImage,
  writeImage,
} from '../media/image-files.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import {
  contentTarget,
  homeImageKeys,
  homeImageUrl,
  readHome,
  text,
  validateHome,
  type BasicHome,
} from './basic-home.js';
import { ShopSettingsRepository, type StoredShopSettings } from './shop-settings.repository.js';

type ShopImageDirectory = 'shop-home' | 'shop-branding';
const emptySettings: StoredShopSettings = {
  displayName: null,
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
  logoKey: null,
  faviconKey: null,
  basicHome: null,
};

function brandingUpload(value: string | null | undefined, field: 'logo' | 'favicon') {
  if (value == null) {
    return value;
  }
  const upload = rasterUpload(value);
  if (!upload) {
    throw contentInputError(field, 'INVALID_IMAGE', 'Choose a JPEG, PNG or WebP image up to 5 MiB');
  }
  return upload;
}

function presentDetails({ logoKey, faviconKey, ...fields }: StoredShopSettings, branchId: string) {
  return {
    ...fields,
    logoUrl: logoKey ? `/media/shop-branding/${branchId}/${logoKey}` : null,
    faviconUrl: faviconKey ? `/media/shop-branding/${branchId}/${faviconKey}` : null,
  };
}

function presentSettings(settings: StoredShopSettings, branchId: string): ShopSettings {
  const { basicHome, ...fields } = presentDetails(settings, branchId);
  return { ...fields, basicHome: basicHome && presentHome(basicHome, branchId) };
}

function presentHome(home: BasicHome, branchId: string) {
  const { heroImageKey, tiles, ...fields } = home;
  return {
    ...fields,
    heroImageUrl: homeImageUrl(branchId, heroImageKey),
    tiles: tiles.map((tile) => {
      if (!tile) {
        return null;
      }
      const { imageKey, ...fields } = tile;
      return { ...fields, imageUrl: homeImageUrl(branchId, imageKey) };
    }),
  };
}

@Injectable()
export class ShopSettingsService {
  private readonly logger = new Logger(ShopSettingsService.name);

  constructor(
    private readonly repository: ShopSettingsRepository,
    private readonly categories: CategoriesService,
  ) {}

  async read(context: RequestContext): Promise<ShopSettings> {
    const scope = await requireScope(context, false);
    return presentSettings(await this.readScoped(scope), scope.branchId);
  }

  async publicDetails(scope: Scope) {
    return presentDetails(await this.readScoped(scope), scope.branchId);
  }

  private async readScoped(scope: Scope): Promise<StoredShopSettings> {
    const row = await this.repository.find(scope);
    return row ? { ...row, basicHome: readHome(row.basicHome) } : emptySettings;
  }

  async publicHome(scope: Scope): Promise<PublicShopHome | null> {
    const { basicHome } = await this.readScoped(scope);
    if (!basicHome) {
      return null;
    }
    const {
      welcomeBg,
      welcomeEn,
      heroActionBg,
      heroActionEn,
      heroHref,
      heroImageUrl,
      showTiles,
      tiles: storedTiles,
      showBenefits,
      benefits,
      showLatestProducts,
    } = presentHome(basicHome, scope.branchId);
    const tiles = showTiles ? storedTiles : [];
    const hrefs = [heroHref, ...tiles.map((tile) => tile?.href ?? null)];
    const categorySlugs = new Set(
      hrefs.some((href) => href?.startsWith('/categories/'))
        ? (await this.categories.publicTree(scope)).map(({ slug }) => slug)
        : [],
    );
    const publicHref = async (href: string | null) => {
      const target = href && contentTarget(href);
      if (target) {
        const visible =
          target.section === 'categories'
            ? categorySlugs.has(target.slug)
            : await this.repository.destinationExists(scope, target, true);
        return visible ? href : null;
      }
      return href;
    };
    return {
      welcomeBg,
      welcomeEn,
      heroActionBg,
      heroActionEn,
      heroHref: await publicHref(heroHref),
      heroImageUrl,
      showTiles,
      tiles: await Promise.all(
        tiles.map(async (tile) => {
          if (!tile) {
            return null;
          }
          if (!tile.titleBg && !tile.titleEn) {
            return { ...tile, href: null, imageUrl: null };
          }
          return { ...tile, href: await publicHref(tile.href) };
        }),
      ),
      showBenefits,
      benefits: showBenefits ? benefits : [],
      showLatestProducts,
    };
  }

  async update(context: RequestContext, input: ShopSettingsInput): Promise<ShopSettings> {
    const scope = await requireScope(context, true);
    const fields = {
      displayName: text(input.displayName, 'displayName', 200),
      contactEmail: text(input.contactEmail, 'contactEmail', 254),
      contactPhone: text(input.contactPhone, 'contactPhone', 50),
      contactAddress: text(input.contactAddress, 'contactAddress', 500),
    };
    if (fields.contactEmail && !isEmail(fields.contactEmail)) {
      throw contentInputError('contactEmail', 'INVALID_EMAIL', 'Enter a valid email address');
    }
    const logoUpload = brandingUpload(input.logo, 'logo');
    const faviconUpload = brandingUpload(input.favicon, 'favicon');
    const brandingBytes = (logoUpload?.bytes.length ?? 0) + (faviconUpload?.bytes.length ?? 0);
    if (brandingBytes > maxImageBytes) {
      throw contentInputError(
        'brandingImages',
        'IMAGE_BATCH_TOO_LARGE',
        'New images can total up to 5 MiB per save',
      );
    }
    const validatedHome = input.basicHome ? validateHome(input.basicHome, brandingBytes) : null;
    if (validatedHome) {
      await this.validateHomeLinks(scope, validatedHome);
    }

    const newKeys: Record<ShopImageDirectory, string[]> = { 'shop-home': [], 'shop-branding': [] };
    const write = async (
      directory: ShopImageDirectory,
      upload: ReturnType<typeof brandingUpload>,
    ) => {
      if (!upload) {
        return upload;
      }
      const key = await writeImage(imageDirectory(scope, directory), upload);
      newKeys[directory].push(key);
      return key;
    };
    let saved: Awaited<ReturnType<ShopSettingsRepository['save']>>;
    try {
      const logoKey = await write('shop-branding', logoUpload);
      const faviconKey = await write('shop-branding', faviconUpload);
      let changeHome: ((previous: BasicHome | null) => BasicHome) | undefined;
      if (validatedHome) {
        const { heroImageUpload, tiles, ...home } = validatedHome;
        const heroKey = await write('shop-home', heroImageUpload);
        const tileKeys: (typeof heroKey)[] = [];
        for (const tile of tiles) {
          tileKeys.push(await write('shop-home', tile?.imageUpload));
        }
        changeHome = (previous) => ({
          ...home,
          heroImageKey: heroKey === undefined ? (previous?.heroImageKey ?? null) : heroKey,
          tiles: tiles.map((tile, index) => {
            if (!tile) {
              return null;
            }
            const { imageUpload: _imageUpload, ...copy } = tile;
            const key = tileKeys[index];
            return {
              ...copy,
              imageKey: key === undefined ? (previous?.tiles[index]?.imageKey ?? null) : key,
            };
          }),
        });
      }
      saved = await this.repository.save(scope, fields, { logoKey, faviconKey }, changeHome);
    } catch (error: unknown) {
      await this.removeImages(scope, 'shop-home', newKeys['shop-home']);
      await this.removeImages(scope, 'shop-branding', newKeys['shop-branding']);
      throw error;
    }
    const { settings, previous, previousRow } = saved;
    const kept = new Set(homeImageKeys(settings.basicHome));
    await this.removeImages(
      scope,
      'shop-home',
      homeImageKeys(previous).filter((key) => !kept.has(key)),
    );
    await this.removeImages(
      scope,
      'shop-branding',
      [previousRow.logoKey, previousRow.faviconKey].filter(
        (key): key is string =>
          key !== null && key !== settings.logoKey && key !== settings.faviconKey,
      ),
    );
    return presentSettings(settings, scope.branchId);
  }

  private async validateHomeLinks(scope: Scope, home: ReturnType<typeof validateHome>) {
    const links = [
      { href: home.heroHref, field: 'basicHomeHeroHref' },
      ...home.tiles.map((tile, index) => ({
        href: tile?.href,
        field: `basicHomeTile${String(index + 1)}Href`,
      })),
    ];
    const targets = links.map(({ href }) => href && contentTarget(href));
    if (targets.some(Boolean)) {
      const { basicHome: previous } = await this.readScoped(scope);
      const previousLinks = [
        previous?.heroHref,
        ...(previous?.tiles.map((tile) => tile?.href) ?? []),
      ];
      await Promise.all(
        links.map(async ({ href, field }, index) => {
          const target = targets[index];
          if (
            target &&
            href !== previousLinks[index] &&
            !(await this.repository.destinationExists(scope, target))
          ) {
            throw contentInputError(
              field,
              'INVALID_DESTINATION',
              'Choose a destination from this shop',
            );
          }
        }),
      );
    }
  }

  async image(scope: Scope, key: string, publicOnly: boolean) {
    const { basicHome } = await this.readScoped(scope);
    return this.readShopImage(scope, 'shop-home', key, homeImageKeys(basicHome, publicOnly));
  }

  async brandingImage(scope: Scope, key: string) {
    const { logoKey, faviconKey } = await this.readScoped(scope);
    return this.readShopImage(scope, 'shop-branding', key, [logoKey, faviconKey]);
  }

  private async readShopImage(
    scope: Scope,
    directory: ShopImageDirectory,
    key: string,
    keys: readonly (string | null)[],
  ) {
    const type = imageType(key);
    if (!type || !keys.includes(key)) {
      throw new NotFoundException();
    }
    try {
      return { bytes: await readImage(imageDirectory(scope, directory), key), type };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  private async removeImages(scope: Scope, directory: ShopImageDirectory, keys: string[]) {
    for (const key of keys) {
      try {
        await removeImage(imageDirectory(scope, directory), key);
      } catch {
        this.logger.warn('Could not remove a retired shop image');
      }
    }
  }
}
