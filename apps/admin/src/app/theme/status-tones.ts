import type { Brand, PaletteStep } from './brands';

/** Status families, declared once; every status colour in the admin derives from this map. */
export const statusTones = { success: 'green', info: 'sky', warn: 'amber', danger: 'red' } as const;
export type StatusFamilyTone = keyof typeof statusTones;
export type StatusTone = StatusFamilyTone | 'neutral' | 'accent';
export const statusToneNames: readonly StatusTone[] = [
  'success',
  'info',
  'warn',
  'danger',
  'neutral',
  'accent',
];

/** Categorical slots for vehicle groups and chart series (light step vs white, dark 400 vs 900). */
export const categoryPalette = {
  c1: { family: 'blue', light: 600 },
  c2: { family: 'teal', light: 600 },
  c3: { family: 'amber', light: 600 },
  c4: { family: 'violet', light: 600 },
  c5: { family: 'rose', light: 600 },
  c6: { family: 'lime', light: 700 },
  c7: { family: 'cyan', light: 700 },
  c8: { family: 'fuchsia', light: 600 },
} as const satisfies Readonly<Record<string, { family: string; light: PaletteStep }>>;
export type CategorySlot = keyof typeof categoryPalette;
export const categorySlots: readonly CategorySlot[] = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
];

const tint = (family: string): string => `color-mix(in srgb, {${family}.400}, transparent 84%)`;

interface ToneTokens {
  readonly color: string;
  readonly background: string;
  readonly solid: string;
}

function familyTone(family: string): ToneTokens {
  return {
    color: `light-dark({${family}.800}, {${family}.200})`,
    background: `light-dark({${family}.100}, ${tint(family)})`,
    solid: `light-dark({${family}.600}, {${family}.400})`,
  };
}

/** `extend.app.tone.*`: text on tint, tint and solid marks for every status tone. */
export function appToneTokens(brand: Brand): Readonly<Record<StatusTone, ToneTokens>> {
  return {
    success: familyTone(statusTones.success),
    info: familyTone(statusTones.info),
    warn: familyTone(statusTones.warn),
    danger: familyTone(statusTones.danger),
    neutral: {
      color: 'light-dark({surface.700}, {surface.200})',
      background: 'light-dark({surface.100}, {surface.800})',
      solid: 'light-dark({surface.500}, {surface.400})',
    },
    accent: {
      color: `light-dark({primary.${String(brand.emphasis)}}, {primary.300})`,
      background: `light-dark({primary.100}, ${tint('primary')})`,
      solid: '{primary.color}',
    },
  };
}

function categoryToken(slot: CategorySlot): string {
  const { family, light } = categoryPalette[slot];
  return `light-dark({${family}.${String(light)}}, {${family}.400})`;
}

/** `extend.app.category.*`. */
export function appCategoryTokens(): Readonly<Record<CategorySlot, string>> {
  return {
    c1: categoryToken('c1'),
    c2: categoryToken('c2'),
    c3: categoryToken('c3'),
    c4: categoryToken('c4'),
    c5: categoryToken('c5'),
    c6: categoryToken('c6'),
    c7: categoryToken('c7'),
    c8: categoryToken('c8'),
  };
}

function tagTone(family: string) {
  return {
    background: `light-dark({${family}.100}, ${tint(family)})`,
    color: `light-dark({${family}.800}, {${family}.200})`,
  };
}

/** Tag severities: 800 on 100 in light, 200 on a 16 % tint in dark. */
export function tagToneTokens(brand: Brand) {
  return {
    primary: {
      background: `light-dark({primary.100}, ${tint('primary')})`,
      color: `light-dark({primary.${String(brand.emphasis)}}, {primary.300})`,
    },
    secondary: {
      background: 'light-dark({surface.100}, {surface.800})',
      color: 'light-dark({surface.700}, {surface.200})',
    },
    success: tagTone(statusTones.success),
    info: tagTone(statusTones.info),
    warn: tagTone(statusTones.warn),
    danger: tagTone(statusTones.danger),
  };
}

function messageTone(family: string) {
  const color = `light-dark({${family}.700}, {${family}.300})`;
  return {
    background: `light-dark(color-mix(in srgb, {${family}.50}, transparent 5%), ${tint(family)})`,
    borderColor: `light-dark({${family}.200}, color-mix(in srgb, {${family}.700}, transparent 64%))`,
    color,
    shadow: 'none',
    closeButton: {
      hoverBackground: `light-dark({${family}.100}, rgba(255, 255, 255, 0.05))`,
      focusRing: { color, shadow: 'none' },
    },
    outlined: { color, borderColor: color },
    simple: { color },
  };
}

/** Message severities: 700 on 50 in light, 300 on a tint in dark. */
export function messageToneTokens() {
  return {
    info: messageTone(statusTones.info),
    success: messageTone(statusTones.success),
    warn: messageTone(statusTones.warn),
    error: messageTone(statusTones.danger),
  };
}

function solidTone(family: string, light: PaletteStep) {
  const hover = Math.min(light + 100, 900);
  const active = Math.min(light + 200, 950);
  const background = `light-dark({${family}.${String(light)}}, {${family}.400})`;
  const hoverBackground = `light-dark({${family}.${String(hover)}}, {${family}.300})`;
  const activeBackground = `light-dark({${family}.${String(active)}}, {${family}.200})`;
  const color = 'light-dark(#ffffff, {surface.950})';
  return {
    background,
    hoverBackground,
    activeBackground,
    borderColor: background,
    hoverBorderColor: hoverBackground,
    activeBorderColor: activeBackground,
    color,
    hoverColor: color,
    activeColor: color,
    focusRing: { color: background, shadow: 'none' },
  };
}

/** Solid Button severities: white text in light, surface 950 text on the 400 step in dark. */
export function buttonToneTokens() {
  return {
    danger: solidTone(statusTones.danger, 600),
    warn: solidTone(statusTones.warn, 700),
    success: solidTone(statusTones.success, 700),
    info: solidTone(statusTones.info, 700),
  };
}

/**
 * Outlined and text Button severities: 700 text in light and 300 in dark, because Aura's 500
 * steps fall below 4.5:1 on white and on tinted panels; `warn` uses the amber family.
 */
export function buttonVariantToneTokens() {
  const tone = (family: string) => ({
    color: `light-dark({${family}.700}, {${family}.300})`,
  });
  const outlinedTone = (family: string) => ({
    ...tone(family),
    borderColor: `light-dark({${family}.200}, {${family}.700})`,
  });
  const secondary = { color: 'light-dark({surface.600}, {surface.300})' };
  return {
    outlined: {
      secondary,
      success: outlinedTone(statusTones.success),
      info: outlinedTone(statusTones.info),
      warn: outlinedTone(statusTones.warn),
      danger: outlinedTone(statusTones.danger),
    },
    text: {
      secondary,
      success: tone(statusTones.success),
      info: tone(statusTones.info),
      warn: tone(statusTones.warn),
      danger: tone(statusTones.danger),
    },
  };
}

/** Badge severities use the same solid steps as buttons. */
export function badgeToneTokens() {
  const badge = (family: string, light: PaletteStep) => ({
    background: `light-dark({${family}.${String(light)}}, {${family}.400})`,
    color: 'light-dark(#ffffff, {surface.950})',
  });
  return {
    danger: badge(statusTones.danger, 600),
    warn: badge(statusTones.warn, 700),
    success: badge(statusTones.success, 700),
    info: badge(statusTones.info, 700),
    secondary: {
      background: 'light-dark({surface.200}, {surface.700})',
      color: 'light-dark({surface.800}, {surface.100})',
    },
  };
}
