import { primitive, type BaseTokenSections } from '@primeuix/themes/aura/base';
import type { Brand, PaletteStep } from './brands';
import { categoryPalette, categorySlots, statusTones } from './status-tones';

export type PaletteName = Exclude<keyof BaseTokenSections.Primitive, 'borderRadius'>;

const white = '#ffffff';

/** The hex value of an Aura primitive, e.g. `primitiveHex('blue', 600)`. */
export function primitiveHex(palette: PaletteName, step: PaletteStep): string {
  const value = primitive[palette]?.[step];
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Missing Aura primitive ${palette}.${String(step)}.`);
  }
  return value;
}

function channels(hex: string): readonly [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a #rrggbb colour, got ${hex}.`);
  }
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG 2.x contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** `color-mix(in srgb, a <weight>, b)` for opaque colours; `weight` is the share of `a` (0–1). */
function mixSrgb(a: string, b: string, weight: number): string {
  const first = channels(a);
  const second = channels(b);
  const mixed = first.map((channel, index) =>
    Math.round(channel * weight + (second[index] ?? 0) * (1 - weight)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** A named contrast pair with its WCAG minimum (4.5 for text, 3 for non-text). */
export interface ContrastCheck {
  readonly name: string;
  readonly foreground: string;
  readonly background: string;
  readonly ratio: number;
  readonly minimum: 3 | 4.5;
}

function check(
  name: string,
  foreground: string,
  background: string,
  minimum: 3 | 4.5,
): ContrastCheck {
  return { name, foreground, background, minimum, ratio: contrastRatio(foreground, background) };
}

/** Every AA pair the brand's primary and neutral ramps must satisfy (spec 1.3 and 1.5). */
export function brandContrastChecks(brand: Brand): readonly ContrastCheck[] {
  const primary = (step: PaletteStep) => primitiveHex(brand.primary, step);
  const surface = (step: PaletteStep) => primitiveHex(brand.neutral, step);
  const light = primary(brand.light.color);
  const dark = primary(brand.dark.color);
  const formBorder = mixSrgb(surface(500), surface(400), 0.5);
  return [
    check('White on primary', white, light, 4.5),
    check('White on primary hover', white, primary(brand.light.hover), 4.5),
    check('Primary on surface 0', light, white, 4.5),
    check('Primary on surface 50', light, surface(50), 4.5),
    check('Primary on surface 100', light, surface(100), 4.5),
    check('Selected text on primary 50', primary(brand.emphasis), primary(50), 4.5),
    check('Accent tag text on primary 100', primary(brand.emphasis), primary(100), 4.5),
    check('Focus ring on surface 0', light, white, 3),
    check('Focus ring on surface 50', light, surface(50), 3),
    check('Dark: primary on surface 900', dark, surface(900), 4.5),
    check('Dark: primary on surface 950', dark, surface(950), 4.5),
    check('Dark: surface 950 on primary', surface(950), dark, 4.5),
    check('Dark: surface 950 on primary hover', surface(950), primary(brand.dark.hover), 4.5),
    check('Text on surface 0', surface(700), white, 4.5),
    check('Muted text on surface 0', surface(500), white, 4.5),
    check('Muted text on surface 50', surface(500), surface(50), 4.5),
    check('Canvas muted text on surface 100', surface(600), surface(100), 4.5),
    check('Dark: muted text on surface 900', surface(400), surface(900), 4.5),
    check('Dark: canvas muted text on surface 950', surface(400), surface(950), 4.5),
    check('Form border on surface 0', formBorder, white, 3),
    check('Form border on surface 50', formBorder, surface(50), 3),
    check('Dark: form border on surface 950', surface(500), surface(950), 3),
    check('Dark: form border on surface 900', surface(500), surface(900), 3),
  ];
}

/** Status tone pairs (spec 1.6) for a brand's neutral ramp. */
export function toneContrastChecks(brand: Brand): readonly ContrastCheck[] {
  const surface = (step: PaletteStep) => primitiveHex(brand.neutral, step);
  const checks: ContrastCheck[] = [];
  const solidSteps = [
    { tone: 'success', step: 700 },
    { tone: 'info', step: 700 },
    { tone: 'warn', step: 700 },
    { tone: 'danger', step: 600 },
  ] as const;
  for (const { tone, step } of solidSteps) {
    const hex = (value: PaletteStep) => primitiveHex(statusTones[tone], value);
    const darkTint = mixSrgb(hex(400), surface(900), 0.16);
    checks.push(
      check(`Tag ${tone}: 800 on 100`, hex(800), hex(100), 4.5),
      check(`Dark tag ${tone}: 200 on tint`, hex(200), darkTint, 4.5),
      check(`Solid ${tone} mark on surface 0`, hex(600), white, 3),
      check(`Dark solid ${tone} mark on surface 900`, hex(400), surface(900), 3),
      check(`Message ${tone}: 700 on 50`, hex(700), hex(50), 4.5),
      check(`Dark message ${tone}: 300 on tint`, hex(300), darkTint, 4.5),
      check(`Toast ${tone} detail: surface 700 on 50`, surface(700), hex(50), 4.5),
      check(`Dark toast ${tone}: 300 on surface 900`, hex(300), surface(900), 4.5),
      check(`Button ${tone}: white on ${String(step)}`, white, hex(step), 4.5),
      check(`Dark button ${tone}: surface 950 on 400`, surface(950), hex(400), 4.5),
      check(`Outlined/text button ${tone}: 700 on surface 0`, hex(700), white, 4.5),
      check(`Outlined/text button ${tone}: 700 on hover 50`, hex(700), hex(50), 4.5),
      check(`Dark outlined/text button ${tone}: 300 on surface 900`, hex(300), surface(900), 4.5),
    );
  }
  const dangerTint = primitiveHex(statusTones.danger, 100);
  checks.push(
    check('Tag neutral: 700 on 100', surface(700), surface(100), 4.5),
    check('Dark tag neutral: 200 on 800', surface(200), surface(800), 4.5),
    check('Outlined/text button secondary: 600 on surface 0', surface(600), white, 4.5),
    check('Outlined/text button secondary: 600 on danger 100', surface(600), dangerTint, 4.5),
    check(
      'Dark outlined/text button secondary: 300 on surface 900',
      surface(300),
      surface(900),
      4.5,
    ),
    check('Segment label: 600 on surface 100', surface(600), surface(100), 4.5),
    check('Dark segment label: 400 on surface 950', surface(400), surface(950), 4.5),
  );
  for (const slot of categorySlots) {
    const { family, light } = categoryPalette[slot];
    checks.push(
      check(`Category ${slot} on surface 0`, primitiveHex(family, light), white, 3),
      check(`Dark category ${slot} on surface 900`, primitiveHex(family, 400), surface(900), 3),
    );
  }
  return checks;
}
