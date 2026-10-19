import { Theme } from '@primeuix/themes';
import { brands } from './brands';
import { densities } from './densities';
import { holitaPreset, registeredComponents } from './holita-preset';
import { holitaThemeOptions } from './provide-holita-theme';
import { brandNames, densityNames, type ThemeChoice } from './theme-choice';

function emitted(choice: ThemeChoice) {
  Theme.setTheme({ preset: holitaPreset(choice), options: holitaThemeOptions });
  const common = Theme.getCommon('common', {});
  return {
    primitive: common.primitive.css ?? '',
    semantic: common.semantic.css ?? '',
    app: common.global.css ?? '',
    style: common.style ?? '',
    component: (name: string) => Theme.getComponent(name, {}).css ?? '',
  };
}

const choices = brandNames.flatMap((brand) =>
  densityNames.map((density): ThemeChoice => ({ brand, density })),
);

describe('holita preset', () => {
  afterAll(() => {
    Theme.clearLoadedStyleNames();
  });

  it('registers exactly the rendered PrimeNG controls and their internal dependencies', () => {
    expect(Object.keys(registeredComponents).sort()).toEqual([
      'autocomplete',
      'avatar',
      'badge',
      'button',
      'checkbox',
      'chip',
      'confirmdialog',
      'datatable',
      'datepicker',
      'dialog',
      'drawer',
      'iconfield',
      'inputnumber',
      'inputtext',
      'listbox',
      'menu',
      'message',
      'metergroup',
      'paginator',
      'popover',
      'select',
      'selectbutton',
      'skeleton',
      'tabs',
      'tag',
      'textarea',
      'timeline',
      'toast',
      'togglebutton',
      'toggleswitch',
      'tooltip',
      'virtualscroller',
    ]);
  });

  it.each(choices)('builds $brand / $density with its brand ramps and density tokens', (choice) => {
    const brand = brands[choice.brand];
    const density = densities[choice.density];
    const css = emitted(choice);
    const { light, dark } = brand;
    expect(css.semantic).toContain(`--p-primary-500:var(--p-${brand.primary}-500)`);
    expect(css.semantic).toContain(
      `--p-primary-color:light-dark(var(--p-primary-${String(light.color)}), var(--p-primary-${String(dark.color)}))`,
    );
    expect(css.semantic).toContain(
      `--p-primary-hover-color:light-dark(var(--p-primary-${String(light.hover)}), var(--p-primary-${String(dark.hover)}))`,
    );
    expect(css.semantic).toContain(`--p-surface-100:var(--p-${brand.neutral}-100)`);
    expect(css.semantic).toContain(`--p-surface-950:var(--p-${brand.neutral}-950)`);
    expect(css.semantic).toContain(`--p-form-field-padding-y:${density.formField.paddingY}`);
    expect(css.semantic).toContain('--p-focus-ring-width:2px');
    expect(css.app).toContain(`--p-app-row-height:${density.app.rowHeight}`);
    expect(css.app).toContain(`--p-app-control-height:${density.app.controlHeight}`);
    expect(css.app).toContain(`--p-app-topbar-height:${density.app.topbarHeight}`);
    expect(css.app).toContain(`--p-app-text-title:${density.app.titleSize}`);
    expect(css.component('datatable')).toContain(
      `--p-datatable-body-cell-padding:${density.table.bodyCellPadding}`,
    );
    expect(css.component('datatable')).toContain(
      `--p-datatable-column-title-font-size:${density.table.columnTitleFontSize}`,
    );
    expect(css.component('button')).toContain(`--p-button-padding-y:${density.button.paddingY}`);
    expect(css.component('drawer')).toContain(
      `--p-drawer-content-padding:${density.drawerContentPadding}`,
    );
    expect(css.component('tag')).toContain(
      `--p-tag-primary-color:light-dark(var(--p-primary-${String(brand.emphasis)}), var(--p-primary-300))`,
    );
  });

  it('emits switching app tokens, status tones and the central CSS', () => {
    const css = emitted({ brand: 'cobalt', density: 'compact' });
    for (const token of [
      '--p-app-canvas-background:light-dark(var(--p-surface-100), var(--p-surface-950))',
      '--p-app-canvas-muted-color:light-dark(var(--p-surface-600), var(--p-surface-400))',
      '--p-app-frame-background:light-dark(var(--p-surface-0), var(--p-surface-900))',
      '--p-app-frame-radius:var(--p-app-radius-frame)',
      '--p-app-radius-frame:var(--p-border-radius-xl)',
      '--p-app-sidebar-width:15.5rem',
      '--p-app-sidebar-rail-width:4rem',
      '--p-app-content-max-width:100rem',
      '--p-app-gutter-narrow:1rem',
      '--p-app-panel-header-background:light-dark(var(--p-surface-50), var(--p-surface-900))',
      '--p-app-drawer-width-md:35rem',
      '--p-app-drawer-width-lg:45rem',
      '--p-app-kpi-min-width:10.5rem',
      '--p-app-space-4:1rem',
      '--p-app-tone-success-color:light-dark(var(--p-green-800), var(--p-green-200))',
      '--p-app-tone-warn-solid:light-dark(var(--p-amber-600), var(--p-amber-400))',
      '--p-app-tone-neutral-background:light-dark(var(--p-surface-100), var(--p-surface-800))',
      '--p-app-category-c6:light-dark(var(--p-lime-700), var(--p-lime-400))',
    ])
      expect(css.app).toContain(token);
    expect(css.app).toContain('.app-dark{color-scheme:dark}');
    expect(css.app).toMatch(/^@layer primeng\{/);
    expect(css.component('tag')).toContain(
      '--p-tag-warn-color:light-dark(var(--p-amber-800), var(--p-amber-200))',
    );
    expect(css.component('message')).toContain(
      '--p-message-error-color:light-dark(var(--p-red-700), var(--p-red-300))',
    );
    expect(css.component('toast')).toContain(
      '--p-toast-warn-color:light-dark(var(--p-amber-700), var(--p-amber-300))',
    );
    expect(css.component('toast')).toContain('--p-toast-error-shadow:var(--p-app-shadow-floating)');
    expect(css.component('button')).toContain(
      '--p-button-danger-background:light-dark(var(--p-red-600), var(--p-red-400))',
    );
    expect(css.style).toContain('text-transform: uppercase');
    expect(css.style).toContain('height: var(--p-app-row-height)');
    expect(Theme.getLayerOrderCSS()).toBe('@layer holita-reset, primeng, holita');
  });
});
