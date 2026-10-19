import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { expect, waitFor } from 'storybook/test';
import { brands, paletteSteps } from './brands';
import {
  brandContrastChecks,
  contrastRatio,
  primitiveHex,
  toneContrastChecks,
  type PaletteName,
} from './contrast';
import { STORY_GLOBALS, storyThemeChoice } from '../../storybook/story-config';
import { categorySlots, statusToneNames } from './status-tones';
import { brandNames } from './theme-choice';

const appColorTokens = [
  'canvas-background',
  'canvas-muted-color',
  'frame-background',
  'frame-border-color',
  'panel-background',
  'panel-border-color',
  'panel-header-background',
  'sidebar-item-hover-background',
  'sidebar-item-active-background',
  'sidebar-item-indicator',
];
const semanticColorTokens = [
  'primary-color',
  'primary-hover-color',
  'primary-contrast-color',
  'text-color',
  'text-muted-color',
  'content-border-color',
  'form-field-border-color',
  'focus-ring-color',
  'highlight-background',
  'highlight-color',
];

@Component({
  selector: 'holita-foundation-colors',
  template: `
    @for (scheme of schemes; track scheme) {
      <section class="scheme" [class.app-dark]="scheme === 'dark'">
        <h2>{{ scheme === 'dark' ? 'Dark' : 'Light' }}</h2>
        <h3>App tokens (--p-app-*)</h3>
        <div class="grid">
          @for (token of appTokens; track token) {
            <div class="swatch">
              <span class="chip" [style.background]="'var(--p-app-' + token + ')'"></span>
              <code>--p-app-{{ token }}</code>
            </div>
          }
        </div>
        <h3>Semantic tokens</h3>
        <div class="grid">
          @for (token of semanticTokens; track token) {
            <div class="swatch">
              <span class="chip" [style.background]="'var(--p-' + token + ')'"></span>
              <code>--p-{{ token }}</code>
            </div>
          }
        </div>
        <h3>Primary and surface ramps</h3>
        @for (ramp of ['primary', 'surface']; track ramp) {
          <div class="ramp">
            @for (step of steps; track step) {
              <span
                class="step"
                [style.background]="'var(--p-' + ramp + '-' + step + ')'"
                [title]="ramp + ' ' + step"
              ></span>
            }
          </div>
        }
      </section>
    }
    <section class="checks">
      <h2>Contrast checks (active brand, WCAG 2.x)</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Ratio</th>
            <th scope="col">Minimum</th>
          </tr>
        </thead>
        <tbody>
          @for (item of checks; track item.name) {
            <tr>
              <th scope="row">{{ item.name }}</th>
              <td class="app-num">{{ item.ratio.toFixed(2) }}</td>
              <td class="app-num">{{ item.minimum }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
      gap: 1rem;
      padding: 1.5rem;
    }
    .scheme,
    .checks {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.25rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
      color: var(--p-text-color);
    }
    .checks {
      grid-column: 1 / -1;
    }
    h3 {
      margin-block-start: 0.5rem;
      font-size: var(--p-app-text-sm);
      color: var(--p-text-muted-color);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: 0.5rem;
    }
    .swatch {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--p-app-text-sm);
    }
    .chip {
      flex: none;
      inline-size: 2rem;
      block-size: 2rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-control);
    }
    .ramp {
      display: grid;
      grid-template-columns: repeat(11, 1fr);
      overflow: hidden;
      border-radius: var(--p-app-radius-control);
    }
    .step {
      display: grid;
      place-items: end start;
      block-size: 2.5rem;
      padding: 0.125rem 0.25rem;
      color: transparent;
    }
    table {
      border-collapse: collapse;
      font-size: var(--p-app-text-sm);
    }
    th,
    td {
      padding: 0.25rem 0.75rem;
      border-block-end: 1px solid var(--p-content-border-color);
      text-align: start;
    }
  `,
})
class FoundationColors {
  readonly schemes = ['light', 'dark'] as const;
  readonly appTokens = [
    ...appColorTokens,
    ...statusToneNames.flatMap((tone) => [
      `tone-${tone}-color`,
      `tone-${tone}-background`,
      `tone-${tone}-solid`,
    ]),
    ...categorySlots.map((slot) => `category-${slot}`),
  ];
  readonly semanticTokens = semanticColorTokens;
  readonly steps = paletteSteps;
  private readonly brand =
    brands[storyThemeChoice({ brand: inject(STORY_GLOBALS).split('/')[0] }).brand];
  readonly checks = [...brandContrastChecks(this.brand), ...toneContrastChecks(this.brand)];
}

@Component({
  selector: 'holita-foundation-brands',
  template: `
    @for (brand of brands; track brand.name) {
      <section>
        <h2>{{ brand.title }}</h2>
        @for (ramp of [brand.primary, brand.neutral]; track ramp) {
          <div class="ramp">
            @for (step of steps; track step) {
              <span class="step" [style.background]="hex(ramp, step)" [title]="ramp + ' ' + step">
                <small [style.color]="labelColor(ramp, step)">{{ step }}</small>
              </span>
            }
          </div>
        }
        <dl>
          @for (item of checksOf(brand.name); track item.name) {
            <div [class.fail]="item.ratio < item.minimum">
              <dt>{{ item.name }}</dt>
              <dd class="app-num">{{ item.ratio.toFixed(2) }} / {{ item.minimum }}</dd>
            </div>
          }
        </dl>
      </section>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
      gap: 1rem;
      padding: 1.5rem;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.25rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
    }
    .ramp {
      display: grid;
      grid-template-columns: repeat(11, 1fr);
      overflow: hidden;
      border-radius: var(--p-app-radius-control);
    }
    .step {
      display: grid;
      place-items: end start;
      block-size: 2.5rem;
      padding: 0.125rem 0.25rem;
      font-size: 0.625rem;
    }
    dl {
      display: flex;
      flex-direction: column;
      margin: 0;
      font-size: var(--p-app-text-sm);
    }
    dl div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-block: 0.25rem;
      border-block-end: 1px solid var(--p-content-border-color);
    }
    dd {
      margin: 0;
    }
    .fail {
      color: var(--p-app-tone-danger-color);
      font-weight: 700;
    }
  `,
})
class FoundationBrands {
  readonly brands = brandNames.map((name) => brands[name]);
  readonly steps = paletteSteps;
  hex(palette: PaletteName, step: (typeof paletteSteps)[number]): string {
    return primitiveHex(palette, step);
  }
  /** Black or white, whichever contrasts more with the swatch (always at least 4.5:1). */
  labelColor(palette: PaletteName, step: (typeof paletteSteps)[number]): string {
    const background = primitiveHex(palette, step);
    return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
      ? '#000000'
      : '#ffffff';
  }
  checksOf(name: (typeof brandNames)[number]) {
    return brandContrastChecks(brands[name]);
  }
}

@Component({
  selector: 'holita-foundation-typography',
  template: `
    <section>
      <p class="eyebrow">Eyebrow · text.xs</p>
      <h1>Page title · text.title</h1>
      <h2>Section heading · text.lg</h2>
      <h3>Card heading · text.md</h3>
      <p>Body text · text.base. Fleet vehicles are serviced on a fixed schedule.</p>
      <p class="meta">Meta and hints · text.sm · muted</p>
      <p class="kpi app-num">1,248 <small>km</small></p>
      <p class="table">Table cell · text.table · <span class="app-num">0123456789</span></p>
      <p class="app-mono">Mono · VIN WDB9634031L123456</p>
    </section>
  `,
  styles: `
    section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-inline-size: 48rem;
      margin: 1.5rem;
      padding: 1.5rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
    }
    .eyebrow {
      font-size: var(--p-app-text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
    .meta {
      font-size: var(--p-app-text-sm);
      color: var(--p-text-muted-color);
    }
    .kpi {
      font-size: var(--p-app-text-kpi);
      font-weight: 600;
    }
    .table {
      font-size: var(--p-app-text-table);
    }
  `,
})
class FoundationTypography {}

@Component({
  selector: 'holita-foundation-density',
  imports: [FormsModule, ButtonDirective, InputText, Select, TableModule],
  template: `
    <section>
      <div class="controls">
        <input pInputText aria-label="Text" data-measure="control" value="CB 1001 AX" />
        <button pButton type="button" data-measure="control">Save</button>
        <p-select
          data-measure="control"
          [options]="options"
          [(ngModel)]="value"
          ariaLabel="Select"
          appendTo="body"
        />
      </div>
      <p-table [value]="rows">
        <ng-template #header>
          <tr>
            <th scope="col">Plate</th>
            <th scope="col">Status</th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr data-measure="row">
            <td>{{ row.plate }}</td>
            <td>{{ row.status }}</td>
          </tr>
        </ng-template>
      </p-table>
      <div class="scale">
        @for (step of space; track step) {
          <div>
            <code>space.{{ step }}</code>
            <span class="bar" [style.inline-size]="'var(--p-app-space-' + step + ')'"></span>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    section {
      display: flex;
      flex-direction: column;
      gap: var(--p-app-stack-gap);
      max-inline-size: 48rem;
      margin: var(--p-app-gutter);
      padding: var(--p-app-panel-padding);
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    .scale {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: var(--p-app-text-sm);
    }
    .scale div {
      display: grid;
      grid-template-columns: 5rem 1fr;
      align-items: center;
      gap: 0.75rem;
    }
    .bar {
      display: block;
      block-size: 0.75rem;
      border-radius: 2px;
      background: var(--p-primary-color);
    }
  `,
})
class FoundationDensity {
  readonly options = ['Active', 'In service', 'Inactive'];
  value = 'Active';
  readonly rows = [
    { plate: 'CB 1001 AX', status: 'Active' },
    { plate: 'CB 1002 AX', status: 'In service' },
  ];
  readonly space = [1, 2, 3, 4, 5, 6, 8, 10];
}

@Component({
  selector: 'holita-foundation-shapes',
  template: `
    <section>
      @for (radius of radii; track radius) {
        <div class="shape" [style.border-radius]="'var(--p-app-radius-' + radius + ')'">
          radius.{{ radius }}
        </div>
      }
      <div class="shape floating">shadow.floating</div>
      <div class="shape field">form field border</div>
    </section>
  `,
  styles: `
    section {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin: 1.5rem;
    }
    .shape {
      display: grid;
      place-items: center;
      inline-size: 10rem;
      block-size: 6rem;
      border: 1px solid var(--p-content-border-color);
      background: var(--p-app-frame-background);
      font-size: var(--p-app-text-sm);
    }
    .floating {
      border-radius: var(--p-app-radius-frame);
      box-shadow: var(--p-app-shadow-floating);
    }
    .field {
      border-color: var(--p-form-field-border-color);
      border-radius: var(--p-app-radius-control);
    }
  `,
})
class FoundationShapes {
  readonly radii = ['frame', 'panel', 'control', 'tag'];
}

@Component({
  selector: 'holita-foundation-tones',
  template: `
    <section>
      @for (tone of tones; track tone) {
        <div class="tone">
          <span
            class="tag"
            [style.background]="'var(--p-app-tone-' + tone + '-background)'"
            [style.color]="'var(--p-app-tone-' + tone + '-color)'"
            >{{ tone }}</span
          >
          <span [class]="'app-dot app-dot--' + tone"></span>
          <span [class]="'app-meter app-meter--' + tone" style="--app-meter-value: 64%"></span>
        </div>
      }
    </section>
  `,
  styles: `
    section {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 1rem;
      margin: 1.5rem;
    }
    .tone {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
    }
    .tag {
      padding: 0.125rem 0.5rem;
      border-radius: var(--p-app-radius-tag);
      font-size: var(--p-app-text-sm);
      font-weight: 600;
    }
  `,
})
class FoundationTones {
  readonly tones = statusToneNames;
}

@Component({
  selector: 'holita-foundation-categories',
  template: `
    <section>
      @for (slot of slots; track slot) {
        <div class="category">
          <span class="swatch" [style.background]="'var(--p-app-category-' + slot + ')'"></span>
          <span><span [class]="'app-dot app-dot--' + slot"></span> Group {{ slot }}</span>
        </div>
      }
    </section>
  `,
  styles: `
    section {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 0.75rem;
      margin: 1.5rem;
    }
    .category {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
      font-size: var(--p-app-text-sm);
    }
    .swatch {
      block-size: 2rem;
      border-radius: var(--p-app-radius-control);
    }
  `,
})
class FoundationCategories {
  readonly slots = categorySlots;
}

@Component({
  selector: 'holita-foundation-breakpoints',
  template: `
    <section>
      @for (name of names; track name) {
        <div class="row">
          <code>{{ name }}</code>
          <span class="app-num">{{ width(name) }}</span>
          <span class="bar" [style.inline-size]="'calc(var(--app-bp-' + name + ') / 4)'"></span>
        </div>
      }
      <p class="viewport">
        Viewport: <span class="app-num">{{ viewport }}</span> px
      </p>
    </section>
  `,
  styles: `
    section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 1.5rem;
      padding: 1.25rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
    }
    .row {
      display: grid;
      grid-template-columns: 3rem 5rem 1fr;
      align-items: center;
      gap: 0.75rem;
    }
    .bar {
      display: block;
      block-size: 0.5rem;
      border-radius: 2px;
      background: var(--p-primary-color);
    }
    .viewport {
      color: var(--p-text-muted-color);
    }
  `,
})
class FoundationBreakpoints {
  readonly names = ['sm', 'md', 'lg', 'xl', 'xxl'];
  readonly viewport = window.innerWidth;
  width(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(`--app-bp-${name}`).trim();
  }
}

const meta: Meta = {
  title: 'Design System/Foundations',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

export const Colors: Story = {
  render: () => ({
    moduleMetadata: { imports: [FoundationColors] },
    template: '<holita-foundation-colors />',
  }),
  play: async ({ canvasElement }) => {
    // T1: app tokens resolve differently in the light and dark schemes.
    const [light, dark] = Array.from(canvasElement.querySelectorAll<HTMLElement>('.scheme'));
    if (!light || !dark) {
      throw new Error('Missing schemes.');
    }
    const chip = (scheme: HTMLElement) => {
      const element = scheme.querySelector('.chip');
      if (!element) {
        throw new Error('Missing swatch.');
      }
      return getComputedStyle(element).backgroundColor;
    };
    await expect(chip(light)).not.toBe(chip(dark));
  },
};

export const BrandVariants: Story = {
  name: 'Brand variants',
  render: () => ({
    moduleMetadata: { imports: [FoundationBrands] },
    template: '<holita-foundation-brands />',
  }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('.fail').length).toBe(0);
    // White on the rejected emerald-500 primary, for comparison.
    await expect(contrastRatio('#ffffff', primitiveHex('emerald', 500))).toBeLessThan(4.5);
  },
};

export const Typography: Story = {
  render: () => ({
    moduleMetadata: { imports: [FoundationTypography] },
    template: '<holita-foundation-typography />',
  }),
};

export const SpacingAndDensity: Story = {
  name: 'Spacing and density',
  render: () => ({
    moduleMetadata: { imports: [FoundationDensity] },
    template: '<holita-foundation-density />',
  }),
  play: async ({ canvasElement }) => {
    const style = getComputedStyle(document.documentElement);
    const rem = Number.parseFloat(style.fontSize);
    const target = (name: string) => Number.parseFloat(style.getPropertyValue(name)) * rem;
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-measure]').length).toBe(5));
    for (const element of Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[data-measure]'),
    )) {
      const expected = target(
        element.dataset['measure'] === 'row' ? '--p-app-row-height' : '--p-app-control-height',
      );
      const height = element.getBoundingClientRect().height;
      await expect(
        Math.abs(height - expected),
        `${element.tagName} ${String(height)}px`,
      ).toBeLessThanOrEqual(1);
    }
  },
};

export const RadiiAndBorders: Story = {
  name: 'Radii and borders',
  render: () => ({
    moduleMetadata: { imports: [FoundationShapes] },
    template: '<holita-foundation-shapes />',
  }),
};

export const StatusTones: Story = {
  name: 'Status tones',
  render: () => ({
    moduleMetadata: { imports: [FoundationTones] },
    template: '<holita-foundation-tones />',
  }),
};

export const CategoricalPalette: Story = {
  name: 'Categorical palette',
  render: () => ({
    moduleMetadata: { imports: [FoundationCategories] },
    template: '<holita-foundation-categories />',
  }),
};

export const Breakpoints: Story = {
  render: () => ({
    moduleMetadata: { imports: [FoundationBreakpoints] },
    template: '<holita-foundation-breakpoints />',
  }),
};
