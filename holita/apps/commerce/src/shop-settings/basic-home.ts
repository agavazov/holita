import { contentInputError, validContentSlug } from '../content-validation.js';
import type {
  ShopBasicHomeInput,
  ShopBasicHomeSettings,
  ShopHomeBenefitIcon,
  ShopHomeBenefitSettings,
  ShopHomeTileSettings,
} from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { imageType, maxImageBytes, rasterUpload } from '../media/image-files.js';

type Tile = Required<Omit<ShopHomeTileSettings, '__typename' | 'imageUrl'>> & {
  imageKey: string | null;
};
type Benefit = Required<Omit<ShopHomeBenefitSettings, '__typename'>>;
export type BasicHome = Required<
  Omit<ShopBasicHomeSettings, '__typename' | 'heroImageUrl' | 'tiles' | 'benefits'>
> & {
  heroImageKey: string | null;
  tiles: (Tile | null)[];
  benefits: (Benefit | null)[];
};
type Upload = NonNullable<ReturnType<typeof rasterUpload>>;
type ImageChange = Upload | null | undefined;

export function text(value: string | null | undefined, field: string, max: number) {
  const trimmed = value?.trim() ?? '';
  if (trimmed.includes('\u0000') || Array.from(trimmed).length > max) {
    throw contentInputError(field, 'INVALID_VALUE', 'Enter supported text within the field limit');
  }
  return trimmed || null;
}

export function contentTarget(
  href: string,
): { section: 'categories' | 'collections' | 'pages'; slug: string } | null {
  const [root, section, slug, extra] = href.split('/');
  if (root !== '' || !slug || extra !== undefined || !validContentSlug(slug)) {
    return null;
  }
  return section === 'categories' || section === 'collections' || section === 'pages'
    ? { section, slug }
    : null;
}

function homeHref(value: string | null | undefined, field: string) {
  const href = text(value, field, 220);
  if (
    href &&
    ![
      '/products',
      '/products?sort=newest',
      '/categories',
      '/collections',
      '/brands',
      '/tags',
      '/blog',
      '/contacts',
    ].includes(href) &&
    !contentTarget(href)
  ) {
    throw contentInputError(
      field,
      'INVALID_DESTINATION',
      'Enter a supported link within this shop',
    );
  }
  return href;
}

export function validateHome(input: ShopBasicHomeInput, brandingBytes: number) {
  if (input.tiles.length !== 3 || input.benefits.length !== 4) {
    throw contentInputError(
      'basicHome',
      'INVALID_VALUE',
      'Provide three tile and four benefit slots',
    );
  }

  let bytes = brandingBytes;
  function upload(value: string | null | undefined, field: string): ImageChange {
    if (value == null) {
      return value;
    }
    const image = rasterUpload(value);
    if (!image) {
      throw contentInputError(
        field,
        'INVALID_IMAGE',
        'Choose a JPEG, PNG or WebP image up to 5 MiB',
      );
    }
    bytes += image.bytes.length;
    if (bytes > maxImageBytes) {
      throw contentInputError(
        'basicHomeImages',
        'IMAGE_BATCH_TOO_LARGE',
        'New images can total up to 5 MiB per save',
      );
    }
    return image;
  }

  const { announcementEnabled, showTiles, showBenefits, showLatestProducts } = input;
  return {
    announcementEnabled,
    announcementBg: text(input.announcementBg, 'basicHomeAnnouncementBg', 200),
    announcementEn: text(input.announcementEn, 'basicHomeAnnouncementEn', 200),
    welcomeBg: text(input.welcomeBg, 'basicHomeWelcomeBg', 200),
    welcomeEn: text(input.welcomeEn, 'basicHomeWelcomeEn', 200),
    heroActionBg: text(input.heroActionBg, 'basicHomeHeroActionBg', 200),
    heroActionEn: text(input.heroActionEn, 'basicHomeHeroActionEn', 200),
    heroHref: homeHref(input.heroHref, 'basicHomeHeroHref'),
    heroImageUpload: upload(input.heroImageUpload, 'basicHomeHeroImageUpload'),
    showTiles,
    tiles: input.tiles.map((tile, index) => {
      if (!tile) {
        return null;
      }
      const field = `basicHomeTile${String(index + 1)}`;
      return {
        titleBg: text(tile.titleBg, field + 'TitleBg', 200),
        titleEn: text(tile.titleEn, field + 'TitleEn', 200),
        eyebrowBg: text(tile.eyebrowBg, field + 'EyebrowBg', 200),
        eyebrowEn: text(tile.eyebrowEn, field + 'EyebrowEn', 200),
        imageAltBg: text(tile.imageAltBg, field + 'ImageAltBg', 200),
        imageAltEn: text(tile.imageAltEn, field + 'ImageAltEn', 200),
        href: homeHref(tile.href, field + 'Href'),
        imageUpload: upload(tile.imageUpload, field + 'ImageUpload'),
      };
    }),
    showBenefits,
    benefits: input.benefits.map((benefit, index) => {
      if (!benefit) {
        return null;
      }
      const field = `basicHomeBenefit${String(index + 1)}`;
      return {
        titleBg: text(benefit.titleBg, field + 'TitleBg', 200),
        titleEn: text(benefit.titleEn, field + 'TitleEn', 200),
        descriptionBg: text(benefit.descriptionBg, field + 'DescriptionBg', 500),
        descriptionEn: text(benefit.descriptionEn, field + 'DescriptionEn', 500),
        icon: benefit.icon,
      };
    }),
    showLatestProducts,
  };
}

function object(value: Prisma.JsonValue | undefined) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function string(value: Prisma.JsonValue | undefined) {
  return typeof value === 'string' ? value : null;
}

function key(value: Prisma.JsonValue | undefined) {
  return typeof value === 'string' && imageType(value) ? value : null;
}

function icon(value: Prisma.JsonValue | undefined): ShopHomeBenefitIcon {
  return value === 'CALENDAR' || value === 'GIFT_CARD' || value === 'PLANET' ? value : 'RETURNS';
}

export function readHome(value: Prisma.JsonValue): BasicHome | null {
  const home = object(value);
  if (!home) {
    return null;
  }
  const tiles = Array.isArray(home.tiles) ? home.tiles : [];
  const benefits = Array.isArray(home.benefits) ? home.benefits : [];
  return {
    announcementEnabled: home.announcementEnabled === true,
    announcementBg: string(home.announcementBg),
    announcementEn: string(home.announcementEn),
    welcomeBg: string(home.welcomeBg),
    welcomeEn: string(home.welcomeEn),
    heroActionBg: string(home.heroActionBg),
    heroActionEn: string(home.heroActionEn),
    heroHref: string(home.heroHref),
    heroImageKey: key(home.heroImageKey),
    showTiles: home.showTiles !== false,
    tiles: [0, 1, 2].map((index) => {
      const tile = object(tiles[index]);
      return (
        tile && {
          titleBg: string(tile.titleBg),
          titleEn: string(tile.titleEn),
          eyebrowBg: string(tile.eyebrowBg),
          eyebrowEn: string(tile.eyebrowEn),
          imageAltBg: string(tile.imageAltBg),
          imageAltEn: string(tile.imageAltEn),
          href: string(tile.href),
          imageKey: key(tile.imageKey),
        }
      );
    }),
    showBenefits: home.showBenefits !== false,
    benefits: [0, 1, 2, 3].map((index) => {
      const benefit = object(benefits[index]);
      return (
        benefit && {
          titleBg: string(benefit.titleBg),
          titleEn: string(benefit.titleEn),
          descriptionBg: string(benefit.descriptionBg),
          descriptionEn: string(benefit.descriptionEn),
          icon: icon(benefit.icon),
        }
      );
    }),
    showLatestProducts: home.showLatestProducts !== false,
  };
}

export function homeImageKeys(home: BasicHome | null, publicOnly = false) {
  const tiles = home?.tiles ?? [];
  return [
    home?.heroImageKey,
    ...tiles.map((tile) =>
      publicOnly && (!home?.showTiles || !(tile?.titleBg || tile?.titleEn)) ? null : tile?.imageKey,
    ),
  ].filter((value): value is string => !!value);
}

export function homeImageUrl(branchId: string, key: string | null) {
  return key ? `/media/shop-home/${branchId}/${key}` : null;
}
