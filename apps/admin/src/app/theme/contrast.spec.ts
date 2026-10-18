import { brands } from './brands';
import {
  brandContrastChecks,
  contrastRatio,
  mixSrgb,
  primitiveHex,
  relativeLuminance,
  toneContrastChecks,
} from './contrast';
import { brandNames } from './theme-choice';

describe('theme contrast', () => {
  it('computes WCAG 2.x luminance, ratios and sRGB mixes', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(mixSrgb('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixSrgb('#ff0000', '#0000ff', 0.25)).toBe('#4000bf');
    expect(() => relativeLuminance('blue')).toThrow('Expected a #rrggbb colour');
  });

  it('reads Aura primitives and reproduces the documented ratios', () => {
    expect(primitiveHex('blue', 600)).toBe('#2563eb');
    // Spec 1.3: white on the cobalt primary 5.17, the rejected emerald-500 2.54.
    expect(contrastRatio('#ffffff', primitiveHex('blue', 600))).toBeCloseTo(5.17, 2);
    expect(contrastRatio('#ffffff', primitiveHex('emerald', 500))).toBeCloseTo(2.54, 2);
    // Spec 1.5 canvas rule: muted 500 on surface 100 fails, which is why the canvas uses 600.
    expect(contrastRatio(primitiveHex('slate', 500), primitiveHex('slate', 100))).toBeLessThan(4.5);
  });

  describe.each(brandNames)('%s brand', (name) => {
    const brand = brands[name];

    it.each(brandContrastChecks(brand).map((item) => [item.name, item] as const))(
      'meets AA: %s',
      (_name, item) => {
        expect(item.ratio).toBeGreaterThanOrEqual(item.minimum);
      },
    );

    it.each(toneContrastChecks(brand).map((item) => [item.name, item] as const))(
      'meets AA: %s',
      (_name, item) => {
        expect(item.ratio).toBeGreaterThanOrEqual(item.minimum);
      },
    );
  });
});
