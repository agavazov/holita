import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { textValidator } from '@osnova/ui';
import type {
  OperatorShopSettingsFieldsFragment,
  ShopBasicHomeInput,
  ShopHomeBenefitIcon,
} from '../generated/shop-settings-operations';
import { encodeImage } from '../image-upload';

type SavedHome = NonNullable<OperatorShopSettingsFieldsFragment['basicHome']>;
export type HomeImageDraft = File | 'keep' | null;

export const homeTextFields = [
  'announcementBg',
  'announcementEn',
  'welcomeBg',
  'welcomeEn',
  'heroActionBg',
  'heroActionEn',
  'heroHref',
] as const;
export const tileTextFields = [
  'titleBg',
  'titleEn',
  'eyebrowBg',
  'eyebrowEn',
  'imageAltBg',
  'imageAltEn',
  'href',
] as const;
export const benefitTextFields = ['titleBg', 'titleEn', 'descriptionBg', 'descriptionEn'] as const;
export const benefitIcons: ShopHomeBenefitIcon[] = ['RETURNS', 'CALENDAR', 'GIFT_CARD', 'PLANET'];

export const homeFieldPath = (prefix: string, field: string) =>
  prefix + field.charAt(0).toUpperCase() + field.slice(1);

export const homeErrorFields = [
  'basicHome',
  'basicHomeImages',
  'basicHomeHeroImageUpload',
  ...homeTextFields.map((field) => homeFieldPath('basicHome', field)),
  ...[1, 2, 3].flatMap((index) =>
    [...tileTextFields, 'imageUpload'].map((field) =>
      homeFieldPath('basicHomeTile' + String(index), field),
    ),
  ),
  ...[1, 2, 3, 4].flatMap((index) =>
    benefitTextFields.map((field) => homeFieldPath('basicHomeBenefit' + String(index), field)),
  ),
];

function text(value: string | null | undefined, max = 200, custom?: FormControl<boolean>) {
  const validate = textValidator(max);
  const field = new FormControl(value ?? '', {
    nonNullable: true,
    validators: [(control) => (custom?.value === false ? null : validate(control))],
  });
  custom?.valueChanges.subscribe(() => {
    field.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  });
  return field;
}

export function shopBasicHomeForm(saved?: SavedHome | null) {
  return new FormGroup({
    announcementEnabled: new FormControl(saved?.announcementEnabled ?? false, {
      nonNullable: true,
    }),
    announcementBg: text(saved?.announcementBg),
    announcementEn: text(saved?.announcementEn),
    welcomeBg: text(saved?.welcomeBg),
    welcomeEn: text(saved?.welcomeEn),
    heroActionBg: text(saved?.heroActionBg),
    heroActionEn: text(saved?.heroActionEn),
    heroHref: text(saved ? saved.heroHref : '/products', 220),
    heroImageUpload: new FormControl<HomeImageDraft>('keep', { nonNullable: true }),
    showTiles: new FormControl(saved?.showTiles ?? true, { nonNullable: true }),
    tiles: new FormArray(
      [0, 1, 2].map((index) => {
        const tile = saved?.tiles[index];
        const custom = new FormControl(!!tile, { nonNullable: true });
        return new FormGroup({
          custom,
          titleBg: text(tile?.titleBg, 200, custom),
          titleEn: text(tile?.titleEn, 200, custom),
          eyebrowBg: text(tile?.eyebrowBg, 200, custom),
          eyebrowEn: text(tile?.eyebrowEn, 200, custom),
          imageAltBg: text(tile?.imageAltBg, 200, custom),
          imageAltEn: text(tile?.imageAltEn, 200, custom),
          href: text(tile?.href, 220, custom),
          imageUpload: new FormControl<HomeImageDraft>('keep', { nonNullable: true }),
        });
      }),
    ),
    showBenefits: new FormControl(saved?.showBenefits ?? true, { nonNullable: true }),
    benefits: new FormArray(
      benefitIcons.map((defaultIcon, index) => {
        const benefit = saved?.benefits[index];
        const custom = new FormControl(!!benefit, { nonNullable: true });
        return new FormGroup({
          custom,
          titleBg: text(benefit?.titleBg, 200, custom),
          titleEn: text(benefit?.titleEn, 200, custom),
          descriptionBg: text(benefit?.descriptionBg, 500, custom),
          descriptionEn: text(benefit?.descriptionEn, 500, custom),
          icon: new FormControl(benefit?.icon ?? defaultIcon, { nonNullable: true }),
        });
      }),
    ),
    showLatestProducts: new FormControl(saved?.showLatestProducts ?? true, { nonNullable: true }),
  });
}

export type ShopBasicHomeForm = ReturnType<typeof shopBasicHomeForm>;

export async function shopBasicHomeInput({
  heroImageUpload,
  tiles,
  benefits,
  ...fields
}: ReturnType<ShopBasicHomeForm['getRawValue']>): Promise<ShopBasicHomeInput> {
  const encode = (image: HomeImageDraft) =>
    image instanceof File ? encodeImage(image) : image === 'keep' ? undefined : null;
  return {
    ...fields,
    heroImageUpload: await encode(heroImageUpload),
    tiles: await Promise.all(
      tiles.map(async ({ custom, imageUpload, ...tile }) =>
        custom ? { ...tile, imageUpload: await encode(imageUpload) } : null,
      ),
    ),
    benefits: benefits.map(({ custom, ...benefit }) => (custom ? benefit : null)),
  };
}
