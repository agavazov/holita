# Admin design system

The holita admin (`apps/admin`) has one centrally controlled design system shared by both domains.
It is built on PrimeNG 22 styled mode with `@primeuix/themes` 3 tokens and `@primeicons/angular`.
This document describes the implemented system; the decision record is
[ADR 0004](architecture/decisions/0004-admin-design-system.md) and the focused procedure for
contributors is the [admin design-system skill](../.agents/skills/holita-admin-design-system/SKILL.md).
[Extending](#extending) says where each kind of addition goes.

## Where presentation lives

| Place                            | Content                                                                                                                                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/theme/`                 | `appTheme`, brands, densities, status tones, the preset, the PrimeNG provider, contrast checks, light/dark `Appearance`, `aura-base.d.ts` (restores the value exports of `@primeuix/themes/aura/base` that its 3.0.1 typings omit) and the "Foundations" and "PrimeNG coverage" stories |
| `src/styles/` + `styles.scss`    | Global CSS: the layer order, the Lato faces, breakpoints, reset, base, shell, patterns and the Karma legacy rules                                                                                                                                                                       |
| `src/app/ui/`                    | Domain-neutral components, CSS-pattern consumers and helpers (patterns below), their BG/EN catalog and Storybook stories                                                                                                                                                                |
| `src/app/layout/`                | The shell: `AdminShell`, `AdminSidebar`, `AdminTopbar`, the navigation model (`NavGroup`, `NavItem`, `NavIconName`, `PageContext`, `navigationContext`) and `PageRecord`/`injectPageRecord`                                                                                             |
| `src/app/workspace/`             | Composition: the navigation groups, the topbar page context, the document title, `UI_LANGUAGE` and PrimeNG texts                                                                                                                                                                        |
| `src/app/i18n/`                  | The application BG/EN catalogs and the shared catalog parity check                                                                                                                                                                                                                      |
| `src/storybook/` + `.storybook/` | Storybook configuration, fixtures, interaction helpers and the story-only example app                                                                                                                                                                                                   |

Colours, the spacing scale, radius and shadow tokens and breakpoints are defined only in `theme/`
and `styles/`. Component styles use `var(--p-*)` tokens (including `--p-app-*`), the global pattern
classes and the breakpoint mixins for colours, spacing-scale steps, the radius and shadow tokens and
breakpoints; global and component SCSS contain no `.app-dark` selectors and no literal colours.
The story-only components of the Foundations, PrimeNG coverage and Start here stories use
literal spacing in their inline styles.
Component-specific values stay literal, for example icon boxes, chart and header heights, popup,
card and text maximum widths, small gaps, paddings and offsets (`2px`, `0.125rem`, `-0.25rem`), the
3 px corners of chart columns and the KPI tone marker, the login card's type sizes, hairlines, pill
and round shapes (`999px`, `50%`) and pattern-local custom properties (`--app-meter-value`,
`--app-truncate-width`). The Karma Client component CSS uses literal spacing and sizes and
keeps Sakai-era `@media (max-width: 575px)` and `(max-width: 1100px)` queries.

## Theme

`holitaPreset(choice)` (`theme/holita-preset.ts`) is `definePreset` over standard Aura
(`@primeuix/themes/aura/base` plus the registered component presets) with:

- `semantic`: the brand's primary ramp with `color`, `hoverColor` and `activeColor` from the brand
  steps and `contrastColor` white (surface 950 in dark); `surface` = white at 0 plus the brand's
  neutral ramp in both schemes (Aura's slate/zinc split is replaced); `highlight.color` = the
  brand's emphasis step (white 87 % in dark) and `highlight.focusColor` one step darker, on Aura's
  primary 50 highlight background; `content` radius `{border.radius.lg}` (8 px instead of Aura's
  6 px) and border surface 200/800; focus ring 2 px solid primary, offset 2 px, no shadow;
  form-field density paddings, a border of a 50 % sRGB mix of surface 500 and 400 (500 in dark)
  and a hover border of 500 (400 in dark); the density list option padding; a 0.15 s transition;
- `components`: density paddings for Button, DataTable (plus body and column-title font sizes) and
  Drawer content; DataTable header cells on the panel header background with muted 600-weight
  titles and a surface 50/800 row hover; Drawer header 1rem 1.25rem, title 1.125rem/600, footer
  0.75rem 1.25rem; Tag 0.75rem/600, padding 0.125rem 0.5rem, `radius-tag`; status tones for Tag
  (`primary` = accent, `secondary` = neutral), Message (`error` = danger), Badge (`secondary`
  surface 200/700) and Button solid, outlined and text (`secondary` surface 600/300); unselected
  ToggleButton and SelectButton labels and icons surface 600/400; tooltip surface 800 with white
  text (surface 100 with 900 text in dark);
- `extend.app`: the holita tokens, emitted as `--p-app-*` (below);
- `css`: central rules tokens cannot express: uppercase 11–12 px column titles with 0.06em letter
  spacing for every DataTable header cell, the density row height, the tab-bar gap, single-sided
  `p-timeline` events (an empty opposite side is hidden), no transition on select and autocomplete options,
  table rows and header cells, and disabled DatePicker days in the muted text colour at full
  opacity (PrimeNG dims them below AA contrast).

The `.app-num` pattern in `styles/_patterns.scss` owns tabular numbers, no-wrap and end
alignment in the `holita` layer.

`provideHolitaTheme(choice, license?)` (`theme/provide-holita-theme.ts`) calls `providePrimeNG`
with `ripple: false`, `theme: holitaTheme(choice)`, the global pass-through
`pt: { table: { tableContainer: { tabindex: '0' } } }` and `license` only when it is non-empty.
The pass-through makes every table's scroll container a tab stop (cells never wrap, so a wide
table scrolls sideways). `holitaTheme(choice)` is
`{ preset: holitaPreset(choice), options: holitaThemeOptions }`; `holitaThemeOptions` holds
`darkModeSelector: '.app-dark'` and
`cssLayer: { name: 'primeng', order: 'holita-reset, primeng, holita' }`, which must match
`styles/_layers.scss`. `appConfig(config, theme = appTheme)` in `app.config.ts` passes the choice
(Storybook passes the toolbar choice) and `config.primeUiLicense`.

The tracked `public/config.json` holds no license; a developer with a key puts
`{ "primeUiLicense": "…" }` into the Git-ignored `apps/admin/public/config.local.json`, which
`main.ts` merges over `config.json` (a 404 or a non-JSON fallback page means none; any other
failure or unknown key is a configuration error). `readLocalAdminConfig` accepts only
`primeUiLicense`, as a string; it is trimmed and empty means none. Without a license PrimeNG shows
its "Invalid PrimeUI License" notice, which is accepted and is not hidden. The `build` target
excludes `config.local.json` from its base `public/` assets. Its `development` configuration
copies it: `ng serve` serves the output from memory, while `admin:build:development` writes it
into `apps/admin/dist/browser` and the Nx cache; never publish or share that development output.
The production build excludes the file, so compiled-app browser fixtures run without a key.
Storybook reads the same local file through `loadStoryLicense()`. Its Vite root is `apps/admin`,
so `public/` is Vite's public directory: the interactive Storybook and the story tests serve
`config.local.json`. For `build-storybook`, `.storybook/main.ts` sets `build.copyPublicDir: false`
and copies only `public/fonts` through `staticDirs`. The static stories and their visual captures
therefore run without a key and show the notice.

### The configured choice

```ts
// theme/theme-choice.ts
export const appTheme: ThemeChoice = { brand: 'cobalt', density: 'compact' };
```

`appTheme` is the only place the application chooses its look. `ThemeChoice` is
`{ brand: BrandName; density: DensityName }`, and `brandNames`/`densityNames` in the same file list
every name. Storybook switches brand and density per story through toolbar globals; the
application never reads them.

### Brands

A `Brand` (`theme/brands.ts`) has a `name`, a `title` (the Storybook toolbar label), a `primary`
Aura palette (`AccentPalette`: blue, orange or teal), a `neutral` palette for `surface`
(`NeutralPalette`: slate, zinc or stone), `light` and `dark` `BrandSteps` (`color`, `hover`,
`active`) and `emphasis`, the light step for selected-row and accent-tag text. Ramps reference all
11 `paletteSteps` (50–950) of both palettes as primitives (`{blue.600}`), never hex copies; a brand
on another Aura palette first extends `AccentPalette` or `NeutralPalette`.

| Brand              | Primary | Neutral | Light primary / hover / active | Dark primary / hover / active | Selected-row and accent-tag text |
| ------------------ | ------- | ------- | ------------------------------ | ----------------------------- | -------------------------------- |
| `cobalt` (default) | blue    | slate   | 600 / 700 / 800                | 400 / 300 / 200               | 700                              |
| `ember`            | orange  | zinc    | 700 / 800 / 900                | 400 / 300 / 200               | 800                              |
| `pine`             | teal    | stone   | 700 / 800 / 900                | 400 / 300 / 200               | 800                              |

`cobalt` is the default because an orange primary sits next to amber `warn` and red `danger`
statuses. Contrast (WCAG 2.x) computed from the Aura primitives:

| Brand    | White on primary / hover | Primary on surface 0 / 50 / 100 | Dark: primary on 900 / 950 | Dark: 950 on primary / hover |
| -------- | ------------------------ | ------------------------------- | -------------------------- | ---------------------------- |
| `cobalt` | 5.17 / 6.70              | 5.17 / 4.94 / 4.72              | 7.02 / 7.93                | 7.93 / 11.19                 |
| `ember`  | 5.18 / 7.31              | 5.18 / 4.96 / 4.71              | 7.83 / 8.79                | 8.79 / 11.80                 |
| `pine`   | 5.47 / 7.58              | 5.47 / 5.24 / 5.02              | 9.39 / 10.61               | 10.61 / 13.35                |

The checked pairs are defined in `theme/contrast.ts`: `brandContrastChecks(brand)` (white on
primary and hover, primary on surface 0/50/100, selected and accent-tag text, focus ring, the dark
primary pairs, text, muted and canvas muted text, form-field borders ≥ 3:1) and
`toneContrastChecks(brand)` (tags, messages, solid and outlined/text buttons and solid marks of the
four status families, the neutral tag, secondary outlined/text buttons, segment labels and the
categorical palette on surface 0 and, in dark, surface 900). Each `ContrastCheck` has `name`,
`foreground`, `background`, `ratio` and `minimum` (4.5 for text, 3 for non-text); `primitiveHex`,
`relativeLuminance`, `contrastRatio` and `mixSrgb` compute them from the Aura primitives.
`theme/contrast.spec.ts` asserts every check for each name in `brandNames`. Not checked: the
neutral and accent solid marks, the dark accent tag, the hover and active steps of solid status
buttons and the topbar's unread badge. "Foundations/Colors" lists the ratio and minimum of both
sets for the toolbar brand without marking failures; "Foundations/Brand variants" lists the brand
checks of all brands, marks failures and fails its play function on any ratio below its minimum.

### Densities

| Token                                                            | `compact` (default)               | `comfortable`                 |
| ---------------------------------------------------------------- | --------------------------------- | ----------------------------- |
| Form field padding Y / X                                         | 0.375rem / 0.625rem               | 0.5rem / 0.75rem              |
| List option padding                                              | 0.375rem 0.625rem                 | 0.5rem 0.75rem                |
| Button padding Y / X                                             | 0.375rem / 0.75rem                | 0.5rem / 0.875rem             |
| DataTable header cell / body cell padding                        | 0.5rem 0.75rem / 0.375rem 0.75rem | 0.625rem 1rem / 0.625rem 1rem |
| Table body text / column title                                   | 13 px / 11 px                     | 14 px / 12 px                 |
| Drawer content padding                                           | 0 1.25rem 1.25rem                 | 0 1.5rem 1.5rem               |
| `--p-app-row-height` / `--p-app-control-height`                  | 48 px / 34 px                     | 56 px / 40 px                 |
| `--p-app-topbar-height`                                          | 52 px                             | 56 px                         |
| `--p-app-gutter` / `--p-app-panel-padding` / `--p-app-stack-gap` | 1.25 / 1 / 1rem                   | 1.5 / 1.25 / 1.25rem          |
| `--p-app-text-title` (page h1)                                   | 1.375rem                          | 1.5rem                        |

The "Foundations/Spacing and density" story measures an input, a button, a select and a table
row and fails when a height differs from the control or row token by more than 1 px.

### Tokens (`--p-app-*`)

| Group             | Tokens                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography        | `font-family` (local Lato, then system UI), `font-numeric` (`tabular-nums`); `text-xs` 0.6875rem (eyebrows, navigation group and KPI labels), `text-sm` 0.75rem, `text-table` (density), `text-base` 0.875rem (body), `text-md` 1rem (h3, card titles), `text-lg` 1.125rem (h2), `text-title` (density, h1), `text-kpi` 1.625rem                                                         |
| Space and shape   | `space-1` 0.25rem, `space-2` 0.5rem, `space-3` 0.75rem, `space-4` 1rem, `space-5` 1.25rem, `space-6` 1.5rem, `space-8` 2rem, `space-10` 2.5rem (there is no `space-7` or `space-9`); `radius-frame` 12 px, `radius-panel` 8 px, `radius-control` 6 px, `radius-tag` 4 px; `shadow-floating` (floating surfaces only: the TablePanel bulk bar, route drawers, toasts and `.app-save-bar`) |
| Surfaces          | `canvas-background` (surface 100/950), `canvas-muted-color` (600/400), `frame-background` (surface 0/900), `frame-border-color`, `panel-background`, `panel-border-color`, `panel-header-background` (surface 50/900), `panel-padding` (density), `panel-radius`                                                                                                                         |
| Shell             | `frame-gap` 0.5rem, `frame-radius` (= `radius-frame`), `sidebar-width` 15.5rem, `sidebar-rail-width` 4rem, `sidebar-item-{color,muted-color,hover-background,active-background,active-color,indicator}`, `topbar-height` (density), `content-max-width` 100rem, `gutter` (density), `gutter-narrow` 1rem                                                                                 |
| Layout            | `stack-gap`, `control-height` and `row-height` (density), `drawer-width-md` 35rem, `drawer-width-lg` 45rem, `kpi-min-width` 10.5rem                                                                                                                                                                                                                                                      |
| Status and series | `tone-{success,info,warn,danger,neutral,accent}-{color,background,solid}` (e.g. `--p-app-tone-warn-solid`), `category-c1` … `category-c8`                                                                                                                                                                                                                                                |

A key under `extend.app` in `appTokens()` (`theme/holita-preset.ts`) is emitted as `--p-app-` plus
its path in kebab case (`sidebar.item.hoverBackground` → `--p-app-sidebar-item-hover-background`);
tokens reference each other as `{app.radius.frame}` and Aura tokens as `{surface.100}`. DataTable
column titles use the density's `--p-datatable-column-title-font-size`, not `text-xs`.

The muted text colour fails AA on surface 100, so the canvas uses `canvas-muted-color` (600 in
light) and table and panel headers use surface 50.

### Status tones and categories

`theme/status-tones.ts` declares the families once (`statusTones`): success → green, info → sky,
warn → amber, danger → red, plus `neutral` (surface) and `accent` (primary). It exports
`statusTones`, `StatusFamilyTone`, `StatusTone`, `statusToneNames`, `categoryPalette`,
`CategorySlot`, `categorySlots` and the token builders the preset uses.

| Use (four status families)                    | Light                              | Dark                  |
| --------------------------------------------- | ---------------------------------- | --------------------- |
| `tone-<family>-color` and tag text            | 800                                | 200                   |
| `tone-<family>-background` and tag background | 100                                | a 16 % tint of 400    |
| `tone-<family>-solid` (dots, meters, bars)    | 600                                | 400                   |
| Message text / background                     | 700 on 50                          | 300 on the tint       |
| Solid button and badge                        | danger 600, others 700; white text | 400; surface 950 text |
| Outlined and text button                      | 700                                | 300                   |

`neutral` uses surface 700/200 (color), 100/800 (background) and 500/400 (solid); `accent` uses the
brand's emphasis step/primary 300, primary 100/a 16 % primary tint and `{primary.color}`. Severity
names that differ from tone names: Tag `primary` is the accent tone and `secondary` the neutral
tone, Message `error` is danger, Badge `secondary` is surface 200 with 800 text (700 with 100 in
dark), and outlined/text Button `secondary` is surface 600 (300 in dark). `toneSeverity(tone)`
(`ui/tones.ts`) returns the `p-tag` severity: `neutral` → `secondary`, `accent` → none (the default
primary tag), each family → the same name; there is no status-tag wrapper.

Vehicle groups and chart series use the eight categorical slots (`categoryPalette`): c1 blue 600,
c2 teal 600, c3 amber 600, c4 violet 600, c5 rose 600, c6 lime 700, c7 cyan 700, c8 fuchsia 600;
every slot is 400 in dark. Colour is never the only carrier of meaning: dots sit next to labels,
column and stacked-bar charts carry a visually hidden table, and a sparkline's accessible name
states its value range and last value.

### Light and dark

`Appearance` (`theme/appearance.ts`, a root service) exposes the `dark` and `persistenceFailed`
signals and `toggle()`. It toggles `.app-dark` and the inline `color-scheme` on `<html>` and
persists `holita.admin.theme` (`dark` or `light`). Only a stored `dark` restores dark mode, so the
default is light and the operating system preference is not read. A failed storage read or write
sets `persistenceFailed`, which shows a warning `p-message` in the shell and on the login page; a
later successful write clears it. The account menu and the login page switch the theme. Aura 3
and the holita tokens express every scheme difference as `light-dark()`, and the preset emits
`.app-dark { color-scheme: dark }`, so one class switches PrimeNG and holita tokens for its subtree
(the Foundations and PrimeNG coverage stories render a nested `.app-dark` section this way).

## Global styles, layers and breakpoints

`styles.scss` loads, in order: `_layers` (`@layer holita-reset, primeng, holita;`), `_fonts`,
`_breakpoint-properties`, `_reset`, `_base`, `_shell`, `_patterns` and `_legacy-karma`. `_reset` is
the `holita-reset` layer; `_base`, `_shell`, `_patterns` and `_legacy-karma` are in `holita`; the
`@font-face` rules and `--app-bp-*` are unlayered. Holita rules override PrimeNG without
`!important`; only the reduced-motion rule uses it, so it also beats unlayered component styles.
Component stylesheets are unlayered.

- `_reset`: box sizing, text-size adjust, no body margin, inherited fonts and colours in form
  controls, links that inherit their colour without underline, no margins on headings, `p`,
  `figure`, `blockquote`, `dl` and `dd`, and `ul`/`ol` with `role="list"` without bullets or
  padding.
- `_base`: the browser's 16 px root (`font-size: 100%`); the body font, `text-base` size, line
  height 1.5 and canvas background; h1–h3 at `text-title`/`text-lg`/`text-md`, weight 600; `small`
  at `text-sm`; the focus ring on `a`, `button` and `summary` via `:focus-visible`; no outline on
  `[tabindex="-1"]` programmatic focus targets (page title, `<main>`, drawer title);
  `.app-skip-link`; `.app-visually-hidden`; reduced motion.
- `_fonts`: Lato 2.015 (SIL OFL 1.1) in weights 400, 500, 600, 700 and 800, normal style only,
  `font-display: swap`, from `/fonts/lato/Lato-{Regular,Medium,SemiBold,Bold,ExtraBold}.woff`
  (`apps/admin/public/fonts/lato` with `OFL.txt`; attribution in
  [`apps/admin/THIRD_PARTY_NOTICES.md`](../apps/admin/THIRD_PARTY_NOTICES.md)). There are no
  italic or other weights. Vite's public directory serves them to the interactive Storybook and
  the story tests; the static build copies `public/fonts` to `fonts`.
- `_shell`: only the shell components' own classes (`.app-shell`, `.app-shell--rail`,
  `.app-topbar*`, `.app-breadcrumb*`, `.app-sidebar*`, `.app-nav*`, `.app-main`,
  `.p-drawer.app-nav-drawer`) and the host display of `holita-admin-shell`, `-topbar` and
  `-sidebar`; feature code does not use them. `.app-page` is the content column around the routed
  view: centred up to `content-max-width`, padded by `gutter` (`gutter-narrow` below `md`), with
  `stack-gap` between blocks.
- `_patterns`: the CSS patterns and the global DataTable rules (below).
- `_legacy-karma`: the pre-design-system classes (below).

`styles/_breakpoints.scss` declares the breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280,
`xxl` 1536 px) and the mixins `below($name)` (`max-width: <value> − 0.02px`) and `from($name)`
(`min-width: <value>`), so the two never overlap. It emits no CSS; component stylesheets write
`@use 'breakpoints' as bp;` and `@include bp.below(md)`. The include path `src/styles` is set in
the `build`, `storybook` and `build-storybook` targets of `apps/admin/angular.json` (the `test`
target builds through `build:development`) and as `loadPaths` in `.storybook/vitest.config.mts`.
`_breakpoint-properties.scss` emits `--app-bp-*` on `:root`; `ui/media.ts` exports
`BreakpointName`, `breakpointWidth(name)` (throws "Global styles are not loaded" without the
properties) and `below(name)`, a readonly `matchMedia` signal created in an injection context that
stops listening when the context is destroyed, so TypeScript and CSS switch at the same pixel
(there is no TypeScript `from`). In unit tests `src/test-setup.ts` restates the five values (it
must change with the Sass map), provides a deterministic `matchMedia` driven by `window.innerWidth`
(specs set `innerWidth` and dispatch `resize`) that always matches
`prefers-reduced-motion: reduce` so PrimeNG overlays close without animations, and no-op
`ResizeObserver` and `Element.scrollIntoView`.

| Width  | Behaviour                                                                                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `< sm` | Topbar: the logo mark only (word visually hidden), no breadcrumb, the language code instead of its name, the Branch name at most 9rem, tighter spacing; FilterBuilder's quick search takes its own row; drawer actions stack with the primary action on top |
| `< md` | Full-width route drawers, the `gutter-narrow` page padding, `.app-col-secondary` hidden, no group crumb, KPI tiles two per row, the page-header row wraps, smaller legacy `.card` padding                                                                   |
| `< lg` | The sidebar becomes the navigation drawer and the topbar shows the logo; the frame becomes full-bleed (no gap, border or radius)                                                                                                                            |
| `≥ sm` | Form grids two columns                                                                                                                                                                                                                                      |
| `≥ md` | Card grids two columns (three from `xl`)                                                                                                                                                                                                                    |
| `≥ lg` | Settings sections show the title and hint beside the fields (1:2)                                                                                                                                                                                           |

`_legacy-karma.scss` is the only place the pre-design-system classes `.card`, `.page-heading`,
`.page-actions` and `.content-link` and the Sakai aliases `--surface-border`, `--surface-card`,
`--text-color`, `--text-color-secondary`, `--primary-color` and `--content-border-radius` survive,
mapped to the new tokens. Karma Client pages still read them. All connected Fleet screens
use the shared views and drawer patterns. Remove the legacy rules only after their remaining
consumers are gone.

## Shell

`AdminShell` (`holita-admin-shell`) renders the skip link, the canvas, the sidebar (full width or a
64 px rail on desktop, a modal `p-drawer` below `lg`), the sticky topbar and the framed
`<main id="main-content">` with the projected page. Inputs: `branches` (required,
`{ id, name }[]`), `branchId`, `language` (required), `languages` (`LanguageOption[]`: `code` and
a `label` in its own language), `loading` (Branch discovery in progress), `tenantName`, `account`
(`ShellAccount`: `name`, `detail`), `notifications` (`ShellNotification[]`: `id`, `title`,
`detail`, `at` (ISO instant), `unread`; `null` hides the bell), `navigation: readonly NavGroup[]`
and `context: PageContext | null`; outputs `languageChange`, `branchSelected`, `notificationOpen`
(id), `notificationsRead` and `signOut`. It imports no feature code and reads no business data;
navigation has no counts.

- The document scrolls; the sidebar is sticky on the canvas and the topbar sticks inside the frame.
  Page content is centred up to `content-max-width` with the density gutter.
- Navigation model (`layout/navigation.ts`): `NavItem` is `{ id, label, icon, link }` and
  `NavGroup` is `{ id, label, note?, items }`. `navigationContext(navigation, path)` picks the
  item whose link equals the path or is followed in it by `/`; the longest link wins, so
  `/vehicles-archive` does not match `/vehicles`. Icons are a closed set (`NavIconName`): a new
  icon needs its name in that union, its `@primeicons/angular` import in `admin-sidebar.ts` and a
  `@case` in `admin-sidebar.html`.
- The sidebar groups the links under `<h2>` headings (`role="group"` labelled by the heading); a
  group's optional `note` is a small tag after its label. The footer reads `holita · <tenant>`.
  From `lg` the logo heads the sidebar.
- The rail keeps link names, group labels and notes (as "(note)") as visually hidden text, turns
  group labels into 1 px separators, hides the footer, shows only the logo mark and shows link
  names as tooltips on hover and focus. The choice persists in `localStorage`
  `holita.admin.sidebar` (`rail` or `full`; a storage failure only loses the preference). Below
  `lg` a second sidebar instance (`idPrefix="mobile-nav"`) fills the navigation drawer, which is as
  wide as the sidebar (at most 90vw), shows a decorative logo in its header and keeps the footer.
- The topbar is one row at every width: the menu button, the logo (below `lg` only), the
  breadcrumb, then the Branch, language, notifications and account menus. The logo links to
  `/<language>/<Branch>/fleet`, or `/<language>` without a Branch; the Fleet root redirects to
  Overview and the signed-in language root opens Overview for the selected Branch. The four
  menus are `holita-menu-button` popups (below), not form selects; each
  button's name starts with a visually hidden "Branch:", "Language:", "Notifications" or
  "Account:".
- Breadcrumb (`<nav>` with an `<ol>`, `aria-current="page"` on the last crumb): the navigation
  group is a plain label (groups are not pages) and the page is the current crumb. A record page
  registers its name with `injectPageRecord(() => name)` (`layout/page-record.ts`); while it is
  registered the page becomes a link back to its list and the record name is the current crumb.
  One record is shown at a time: a newer registration replaces it, and only the page that
  registered last clears it when destroyed, so a page leaving late keeps the next page's record.
  When no navigation item matches the path, the context is `null` and there is no breadcrumb.
  Crumbs stay on one line: the group and the list-page link of a record page are at most 12rem
  each; when space runs out every crumb shrinks and ends with its own ellipsis (full text in
  `title`), while the current crumb keeps at least `min(8rem, 40%)`. The list keeps room for the
  focus ring of the back link. Below `md` the group is hidden, below `sm` the whole breadcrumb (the
  page heading names the page).
- Branch menu (`app-menu-scroll`): the active Branch name (at most 16rem, 9rem below `sm`) with a
  check on the current option; choosing the current Branch again changes nothing, and
  `chooseBranch` accepts only a known, different Branch. Without Branches the button is disabled
  and says "Loading branches…" or "No branches available."; when Branches are loaded but
  `branchId` matches none (an unknown Branch in the URL) it says "Choose a branch" and no option is
  checked.
- Language menu: shown only when `languages` has more than one entry. The button shows the
  current language's own name (its code below `sm`); each option carries its `lang`, the current
  one is checked, and choosing another emits `languageChange`.
- Notifications (`app-menu-wide app-menu-scroll`): a bell with an unread badge (the count is in
  the button name). Each item shows the title, `detail` as its description and the relative time
  against `WALL_CLOCK`, taken when the bell opens, as a note; unread items carry an info dot with a
  hidden "Unread". Choosing an item emits `notificationOpen(id)`; "Mark all as read", shown while
  something is unread, emits `notificationsRead`. An empty list shows "No new notifications" as
  the menu's heading, which also names the menu. The shell keeps no read state: the composer
  updates `unread` and decides what opening an item does.
- Account menu: the initials (first letters of the first two words of the name, upper-cased for
  the UI language), the name and detail as the menu's heading, "Use dark theme" or "Use light
  theme" (toggles `Appearance`) and, after a separator, Sign out (`signOut`). The name is
  `account.name`, else `tenantName`, else `holita`.
- Accessibility: skip link first, `<header>`, labelled `<aside>` with `<nav>`, group headings,
  `aria-current="page"` on the active item. The menu button's `aria-expanded` is true for the full
  desktop sidebar or an open drawer and false for the rail; its `aria-controls` is
  `desktop-navigation` or `mobile-navigation`. The modal navigation drawer takes focus on its close
  button, closes on navigation and at `lg`, and returns focus to the menu button when closed with
  Escape, the backdrop or its close button and when the window reaches `lg`. After a page change
  the shell focuses `#page-title`, or `<main>` when the page has no title. A page change is a
  `NavigationEnd` whose route-config chain differs, ignoring routes with `data.drawer === true` or
  `data.tab === true`; focus does not move on the initial navigation or when focus is already
  inside `<main>`.
- Signed out, the workspace shows `holita-login` without the shell: a canvas page with a top-right
  link to the other language (named in that language, with `lang`) and an icon button for the
  theme ("Use dark theme"/"Use light theme"). A frame card (at most 26rem) holds the logo mark and
  word, the `h1` "Demo sign in", the labelled Tenant and Branch `p-select`s (Branch is disabled
  until the chosen tenant's Branches load), loading, empty and error messages with Retry, the Sign
  in button (`data-testid="demo-login"`) and the theme-persistence warning.
- `AdminWorkspace` (`workspace/admin-workspace.ts`) is the composer. Signed in, it passes
  `branches` (`BranchContext.branches() ?? []`), `branchId` (`BranchContext.selectedId()`),
  `loading` (`BranchContext.loading()`), `language` (the `:language` route parameter through
  `readLanguage`), `languages` (`Български`, `English`), `tenantName` (the demo session's tenant),
  `navigation` and `context`.
  It binds `languageChange` (only `bg`/`en`: the current URL with its first segment replaced, so
  path, query and fragment are kept), `branchSelected` (`BranchContext.choose`: on Branch routes it
  preserves the supported Fleet section without its record/list query; on routes with
  `data.requiresBranch: false` it only remembers the Branch) and `signOut` (pauses the default
  Branch navigation and navigates to `/<language>` through the route guards; only if that succeeds
  does it clear the Branches and end the demo session). The account menu shows the tenant name.
  `notificationsUnavailable` exposes the Demo bell with an explicit provider-unavailable heading,
  no feed and no unread badge.
  `adminNavigation(language, branchId, fleetEnabled)` returns Monitoring (Overview, Alerts, Trip log),
  Fleet (Vehicles, Drivers, Devices), Service (Maintenance) and Settings (Vehicle groups, General)
  only when a Branch is selected and Fleet is enabled, followed by the Karma
  Client group with the note "temporary" (Trucks, Users, Roles, Projects, Time zones, API
  information). On a route that requires a Branch, while discovery is loading, empty or failed,
  the workspace projects a status card with Retry (`data-testid="refresh-branches"`) and renders
  the router outlet only once Branches are available. The context is the longest matching
  navigation link plus the registered `PageRecord`. `document.title` is `<page> · holita` (the
  navigation item, never the record), `holita` when no item matches and `Вход · holita` /
  `Sign in · holita` on login; `<html lang>` follows the language. The workspace provides
  `UI_LANGUAGE` and sets the PrimeNG texts (`workspace/primeng-translation.ts`: the catalog's
  `primeng` date names and overlay messages, `dd.mm.yy`, Monday first, selection messages, and
  section and paginator aria labels merged over PrimeNG's own).

### Texts and languages

Application texts live in `src/app/i18n/{bg,en}.json` (`messages[language]`, typed by `en.json`);
`primeng` holds the PrimeNG date names and overlay messages. Routes start with `/bg` or `/en`; any
other value redirects to `/bg`, and `readLanguage` maps every value other than `en` to `bg`.
`i18n/catalog-parity.ts` (`catalogParityProblems`, `expectCatalogParity`) checks a BG/EN pair for
identical key trees and array lengths, non-empty texts and identical `{placeholder}` sets;
`i18n/messages.spec.ts` and `ui/i18n/messages.spec.ts` use it. Every connected Fleet feature has
BG/EN catalogs and a parity spec under its `i18n` directory. Storybook renders English while
using the same presentation components.

## Patterns (`src/app/ui`)

Components exist only where structure, state or behaviour repeats; single PrimeNG controls
(`p-tag`, `p-selectbutton`, `p-select`, `p-autocomplete`, `p-datepicker`, `p-inputnumber`,
`p-toggleswitch`, `p-tabs`, `p-timeline`, `p-metergroup`, `p-avatar`, `p-skeleton`) are used
directly. Every component is standalone, `OnPush`, uses signal inputs and outputs, the `holita-`
prefix and texts from `uiMessages[inject(UI_LANGUAGE)()]`.

| Pattern                                                           | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `holita-page-header`                                              | `title` (the page's only `<h1 id="page-title" tabindex="-1">`), `eyebrow`, `count`, one-line `description`, `backLink`/`backLabel`; slots `[headerMeta]`, `[headerActions]`; `focusTitle()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `holita-kpi-strip` + `holita-kpi-tile`                            | Strip: a `role="group"` named by `label`, `loading` (every tile shows a skeleton), `error` + `retry`. Tile: `label`, pre-formatted `value` (`null` → "—"), `unit` (only next to a value), `secondary`, `footnote`, `delta` (`KpiDelta`: `text`, `trend` `up`/`down`/`flat`, `sentiment` `good`/`bad`/`neutral`), `tone` marker, `explanation` popover, `link` (router commands; the label becomes the link) + `queryParams`, `loading`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `holita-filter-builder` + `filter-model.ts`                       | Always-visible quick search: `searchLabel` (hidden label and placeholder), `search`, `searchError`, `searchChange` (the raw text on every input, `maxlength` 200). "Add filter" (shown when `fields` is non-empty): `fields` (`FilterField`: `key`, `label`, `type` `text`/`enum`/`number`/`date`/`boolean`, `operators` from `filterOperators` with the first preselected, `options` for `enum`, `unit` for `number`) build `conditions` (`FilterCondition`: `id`, `field`, `operator`, `values` as strings: decimal text, `YYYY-MM-DD`, enum values), emitted by `conditionsChange`. Apply is enabled only when `isComplete` (a range needs from ≤ to). Conditions are chips (`describeCondition`) that reopen the editor or remove the condition; "Clear all" emits `[]`; all apply together (AND). Focus opens on Column; Apply, Cancel and Escape return to the opener. Outside clicks retain their target's focus. The popover is non-modal, selects have explicit labels, and the first Escape closes an open calendar before a second Escape closes the editor. Removing a chip focuses the next chip, else the previous chip, else Add filter; Clear all focuses Add filter. Hosts preserve condition IDs. Slot `[filterActions]`. `filter-model.ts` also exports `operandsOf` (`none`, `one`, `range`, `set`)                                                                                                                                                                               |
| `holita-table-panel` + `tableView()`                              | `heading`, `headingLevel` (2 default or 3; the heading is the focus target), `total` (hidden while `loading` or `error`), `view` (`TableView` from `tableView()`), `errorText`, `busy` (`aria-busy`; a 2 px decorative bar while rows are shown), `emptyTitle`/`emptyDescription` and `[emptyActions]` (the `empty` state only), `actions` (`ListActionBase[]`), `selection` (the selected `ListRecord`s of the shown page), `selectionProgress`, `page` (`TablePage`: 1-based `page`, `pageSize`, `total`), `pageSizes` (default 10, 20, 50, 100), `skeletonRows` (default min(page size, 8)). Outputs: `action` (`ListActionRequest`), `pageChange` (`{ page, pageSize }`, 1-based), `retry` (the Retry of `error` and `rows-error`), `clearFilters` (the Clear filters of `no-results`), `clearSelection`. Slots: default (the `p-table`), `[panelActions]` (header), `[panelFooter]` (footer start), `[emptyActions]`. Methods: `run(actionId, records, origin, source = 'row')`, the one way to start an action (below), and `focusHeading()`. It provides its own `ConfirmationService` and `p-confirmdialog`. The footer and paginator show whenever rows are shown, whatever the page size; page links only when the rows do not fit on one page; the current page size is always among the options. The bulk bar lists the `bulk` actions, each disabled when no selected record applies; it sits below the panel and sticks to the viewport bottom, so selecting never moves rows or footer |
| `holita-row-actions`                                              | The "⋮" menu of a row: `actions` (the list's actions), `record` (`ListRecord`: accessible name "Actions for <label>", and its `unavailable` actions are disabled), output `choose` (`RowChoice`: `{ action, origin }`) which the host passes to `TablePanel.run`. Destructive actions come last after a separator (MenuButton orders them). Lists never show a direct Delete button in a row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `holita-menu-button`                                              | A button that opens a `p-menu` popup: the row menu and the topbar menus. `options` (`MenuOption`: `id`, `label`, `selected` (check and a hidden "current choice"), `disabled`, `danger` (moved last after a separator), `lang`, `description`, `note`, `marker` (`{ tone, label }`: a dot with hidden text), `separated`), `variant` (`icon`, `text` with a chevron), `ariaLabel` (else the projected content names the trigger), `header` (`MenuHeader`: `title`, `detail`; names the popup, else the trigger does), `disabled` (stays focusable, does not open), `buttonClass`, `menuClass` (`app-menu-scroll`, `app-menu-wide`); outputs `choose` (`MenuChoice`: `{ id, origin }`, emitted after focus is back on the trigger) and `opened`. Keyboard focus opens on the current choice, else the first enabled option, and the focused option is scrolled into view; `aria-expanded` follows the popup's visibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `holita-route-drawer`                                             | `title`, `subtitle`, `[drawerMeta]`, `size` (`md`/`lg`), `state` (`RouteDrawerState`: `loading` skeleton; `not-found` and `invalid-id` an empty state with Close; `error` shows `errorText` with Retry → `retry`; the body and the sticky `[drawerFooter]` render only in `ready`), `saving` (sets `aria-busy` only), `dirty` (also blocks page unload), `closeLink` (`readonly unknown[] \| null`, default `['..']`); outputs `retry`, `closeRequest`; methods `close()`, `confirmLeave(dirty)` (concurrent calls share one dialog), `focusTitle()` and `keepFocusInside()`. A modal `role="dialog"` labelled by its h2; it focuses the title when shown unless focus is already inside, ignores an Escape another control handled, and provides its own `ConfirmationService` and `p-confirmdialog`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `holita-form-field`                                               | `label` (`#<id>-label`), `controlId`, `hint` (`#<id>-hint`), `error` (in `#<id>-error`, which is always rendered), `required` (a visual asterisk plus a hidden "(required)"), `counter` (`FieldCounter`: `length` in code points, `max`; warning tone above 90 %). The projected control sets its `id`, `[attr.aria-describedby]="'<id>-hint <id>-error'"`, `aria-invalid` and `[invalid]`; a group control without one input (select button) uses `ariaLabelledBy="<id>-label"`; PrimeNG controls with an inner input use `innerInputPt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `holita-empty-state`                                              | `kind` (`EmptyStateKind`: `empty`, `no-results`, `error`, `not-found`, `disabled`, `no-telemetry`, `done`; each with its own icon), `title`, `description`, `compact`, `[emptyActions]`; `error` and `not-found` are `role="alert"`, the other kinds `role="status"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `holita-column-series`, `holita-stacked-bars`, `holita-sparkline` | `holita-column-series` (`label`, `points: SeriesPoint[]` with `key`, `label`, `value` (`null` = gap, `0` = hairline) and `valueText`, `highlightLast` = true; axis labels thinned to about seven, counted back from the latest) and `holita-stacked-bars` (`label`, `rows: StackedRow[]`, `legend: StackedLegendItem[]`, `max` = a shared scale, default the largest total; segment tones `BarTone` = status tone, category slot or `muted`, via `barColor`) are `role="figure"` with a visually hidden data table. `holita-sparkline` (`label`, `points: SparkPoint[]` with epoch-ms `at` and `value`, `from`, `to`, `unit`, `min`, `max`; `null` breaks the line) is an SVG `role="img"` whose name states the min–max range and the last value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`tableView({ loading, error, rows, filtered })` (`rows`: the number of rows on screen, `null` before
the first answer) returns `rows-error` or `rows` when rows are present, else `error` when an error
is set, else `loading` while loading or before the first answer, else `no-results` when `filtered`,
otherwise `empty`.

CSS patterns (`styles/_patterns.scss`):

- Layout: `.app-view` (a page view's host class: header, KPIs, filters and panels stacked inside
  the shell's `.app-page`), `.app-card` with optional `.app-card__header` and `.app-card__title`,
  `.app-card-grid`, `.app-stack`, `.app-settings-section` (a settings card whose
  `> header > h2 + p` sits beside the fields from `lg`) and `.app-save-bar` (Discard and Save of a
  page form, sticky while there are changes).
- Records and forms: `.app-facts` on a `<dl>` whose `<div>`s hold `<dt>` + `<dd>` (auto-fill
  columns of at least 11rem; `.app-facts--wide` spans a row), `.app-form-section` (a `> h3` title
  and an optional `> p` hint), `.app-form-grid` with `.app-form-grid--wide` on a direct child,
  `.app-drawer-actions`.
- Values: `.app-dot` plus `.app-dot--<tone>` or `.app-dot--c1` … `--c8` (the base class is
  required; colours from `tone-*-solid` and `category-*`), `.app-num` (tabular, unwrapped and
  right-aligned in `th`/`td`), `.app-mono`, `.app-muted`, `.app-inline` (a value with its dot or
  tag on one line), `.app-meter` (reads `--app-meter-value`, 0–100 %, and `--app-meter-color`, set
  by `.app-meter--<tone>`, default primary), `.app-meter-cell` (meter plus value).
- Table cells: `.app-cell-stack`, `.app-cell-truncate` (one line with an ellipsis, width
  `--app-truncate-width`, default 28rem; full text in `title`), `.app-col-secondary`,
  `.app-col-check` (3rem), `.app-col-actions` (3.25rem), `.app-link` (`button.app-link` is a
  row's record link that opens its drawer).
- Other: `.app-timeline-event` with `__title`, `__meta` and `__body` (keeps line breaks),
  `.app-icon-button`, `.app-logo` with `.app-logo__mark` (the `.app-logo__word` span has no
  pattern rule; the topbar hides it below `sm`), and the popup menu classes `.app-menu-scroll`
  (a long list scrolls) and `.app-menu-wide`.
- Global rules: every DataTable header and body cell is `nowrap`; the focusable scroll container
  shows an inset focus ring; inputs, textareas, `p-select`, `p-autocomplete`, `p-inputnumber` and
  `p-datepicker` projected directly into `holita-form-field` fill its width.
- Set by components, not by hand: `.p-drawer.app-route-drawer` (`--md`/`--lg` from RouteDrawer
  `size`) and `.app-menu-danger` (from `MenuOption.danger`).

Helpers:

- `list/list-actions.ts`: `ListActionBase<A>` (`id`, `label`, `bulk`, `danger`, `confirm`), the
  type TablePanel and RowActions take; `ListAction<A, Row>` adds the optional `appliesTo(row)`
  (without it the action applies to every row); `ActionConfirm` (`title`, optional `detail`,
  `accept`); `ListRecord` (`id`, `label`, `unavailable`);
  `listRecord(actions, row, id, label)`; `ListActionRequest` (`action`, `ids`); `trackById` for
  `p-table [rowTrackBy]`.
- `list/list-query.ts`: `ListQuery` (`search`, `conditions`,
  `sort: { field, direction: 'asc' | 'desc' } | null`, 1-based `page`, `pageSize`) and the
  transitions `listQuery.search`, `.conditions`, `.page`, `.cleared` (search and conditions
  emptied), `.sorted` (from a `p-table` lazy-load event; `null` when the sort did not change;
  `sortOrder` 1 is `asc`) and `.filtered` (search or conditions present); every transition except
  `page` returns to page 1. `injectSortReady()` (in an injection context) reports whether the
  first render is done.
- `list/list-sort-menu.ts`: `ListSortMenu` (`fields: { field, label }[]`, current `sort`,
  `sortChange`) renders a shared field/direction menu in the TablePanel `panelActions` slot.
  It offers fields without visible table columns alongside the existing header sorts; hosts
  return to page one and clear selection when sorting changes. Choosing the current field or
  direction emits nothing and preserves the page and selection.
- `list/list-state.ts` and `list/url-list-state.ts`: URL state ([below](#list-url-state)).
- `list/sequential.ts`: `runSequential(items, action, options)` with
  `options = { isCurrent, progress(done, total), errorText(error, item) }` sends one write per item
  in order, sends nothing more once `isCurrent()` is false and resolves to
  `{ succeeded, failures: { item, message }[], stopped }`.
- `forms/field-errors.ts`: `errorCode(error)` returns the first known `extensions.code`
  (`ErrorCode`: `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`,
  `UNAUTHENTICATED`) or `null`; `fieldErrors(error, fields)` returns the first message per listed
  path from `extensions.fieldErrors` (at most 30 entries, messages up to 300 characters).
- `forms/validators.ts`: `textValidator(max, { required })` (trimmed, counted in code points, NUL
  rejected), `patternValidator(pattern, { transform: 'upper' | 'none' })`,
  `integerValidator(min, max, { required })`, `decimalValidator(min, max, step)`, `dateOnlyValidator(min, max)`
  (`YYYY-MM-DD` or a DatePicker `Date`; bounds as values or functions) and
  `requireOneOf(first, second)` (a group validator whose error shows on `first`). Empty values
  pass all except a required `textValidator` or `integerValidator`. `validationMessage(errors, language)` turns the
  first error key (`required`, `unsupported`, `maxLength`, `pattern`, `integer`, `decimal`, `min`,
  `max`, `step`, `date`, `dateMin`, `dateMax`, `requireOneOf`) into catalog text with numbers and
  dates formatted.
- `forms/saving.ts`: `lockWhileSaving(form, saving, settled)` disables a form only when saving
  starts and enables it when saving ends, preserving its raw draft and dirty/touched state.
  Call it in an injection context, only for forms without independently disabled controls.
  `settled` runs after rendering a surviving editor, for server-field focus or focus recovery.
- `forms/focus.ts`: `focusFirstInvalid(form, order, prefix)` focuses the first `#<prefix><name>`
  in `order` with `aria-invalid="true"`. `forms/inner-input-pt.ts`:
  `innerInputPt(controlId, invalid)` links the hint and error and sets `aria-invalid` on the inner
  input of `p-inputnumber` and `p-datepicker`. The new reading/completion drawers use
  `datePickerInputPt` for DatePicker: selection stays on its grid cell, with the duplicate
  unsupported `aria-selected` removed from the child day span.
- `remote-options.ts`: `new RemoteOptions(load)` in an injection context, where `load(search, ids)`
  returns an Observable of options, for `p-autocomplete`; signals `options`, `loading` and
  `error`; `search(text)` after 250 ms of quiet input, `hydrate(ids)` at once; the latest request
  wins.
- `confirm.ts`: `confirmAction(confirmation, language, { header, message?, acceptLabel, danger, signal? })`
  and `confirmDiscard(confirmation, language)` (Keep editing / Discard changes) resolve `true` on
  accept; Cancel or Keep editing has the initial focus and Escape rejects. ConfirmDialog renders
  `message` as HTML, so it never carries record data; hosts that name records use a `#message`
  template. `confirmDialogPt(language, describedBy?)` (PrimeNG usage rules).
- `select-multiple.ts`: `selectMultiplePt` (PrimeNG usage rules).
- `format/format.ts`: `emptyValue` "—" for null, undefined and non-finite values (0 stays a number),
  `localeOf` (`bg-BG`/`en-GB`), `formatNumber(value, language, { fraction })`,
  `formatDistanceKm`, `formatSpeed`, `formatLitres`, `formatVolts`, `formatPercent`,
  `formatTemperature`, `formatMoneyCents` (EUR from integer cents),
  `formatDateTime(iso, language, timeZone, seconds = false)`, `formatDateOnly` (no zone conversion),
  `formatRelative(iso, reference, language)` against an explicit reference and
  `formatDuration(seconds, language)`. `format/format.pipes.ts`:
  `holitaNumber[:fraction]`, `holitaDateTime[:timeZone][:seconds]` (the Fleet Branch's configured
  zone, or `Europe/Sofia` outside Fleet; an explicit zone overrides it, with optional seconds for
  precise reading bounds), `holitaDate`, `holitaRelative:reference`, `holitaDuration` and `holitaMoney`,
  all reading `UI_LANGUAGE`. `format/zoned-time.ts`: `isoToZonedParts`, `zonedWallTimeToIso`
  (DST-aware: a spring-gap time resolves after the gap, an ambiguous autumn time to its first
  occurrence), `toDateOnly`/`fromDateOnly` between a DatePicker `Date` and `YYYY-MM-DD`.
- `format/fleet-format.ts`: `FLEET_DISPLAY` is a signal supplied by the verified Fleet workspace;
  standalone examples keep Sofia/KM/LITRE defaults. `injectFleetFormat()` converts read values
  and chart labels between km/mi, km/h/mph and litres/US gallons, preserving null and zero.
  API storage remains km, km/h and litres. Typed editors and filters retain their explicitly
  labelled canonical entry units; they do not round-trip displayed rounded conversions.
- `clock.ts`: `WALL_CLOCK` (`() => number`, `Date.now` by default; stories fix it).
  `ui-language.ts`: `UI_LANGUAGE` (`Signal<Language>`, `bg` by default; AdminWorkspace provides the
  route language and Storybook `en`). `media.ts`: `below(name)` and `breakpointWidth(name)`
  (breakpoints above). `tones.ts`: `toneSeverity` and the `StatusTone` and `CategorySlot` types.
- `i18n/`: `uiMessages` from `ui/i18n/{bg,en}.json` (the pattern texts, checked by
  `messages.spec.ts` with `expectCatalogParity`) and `interpolate(text, values)`, which fills
  `{name}` placeholders and leaves unknown ones as written.

### Table conventions

Hosts project a `p-table` into `holita-table-panel` with `[lazy]`, `[lazyLoadOnInit]="false"`
(the host loads the first page itself), `[sortField]`/`[sortOrder]` from the `ListQuery` and
`(onLazyLoad)` mapped through `listQuery.sorted` behind `injectSortReady()` (PrimeNG 22 reports
an intermediate ascending sort while applying its inputs on the first render), `dataKey="id"`,
`[scrollable]="true"` (required by the frozen actions column; the panel scrolls sideways) and no
`emptymessage` template (the panel renders every state). A selection header cell contains a
visually hidden `<label for>` and `p-table-header-checkbox [inputId]` (PrimeNG names the header
checkbox only after its value changes); row checkboxes use `[ariaLabel]`. Secondary columns carry
`.app-col-secondary`; numeric columns `.app-num`. Header and body cells never wrap (a wide table
scrolls sideways, and `provideHolitaTheme` makes every table's scroll container a tab stop so the
keyboard can scroll it); long free text (notes, descriptions) is one line with
`.app-cell-truncate` and the full text in `title`. Row actions are a last `.app-col-actions`
column with `holita-row-actions`, frozen to the right (`pFrozenColumn alignFrozen="right"` on its
`th` and `td`) so the menu stays reachable while scrolling. `p-sort-icon` is the sort indicator
element. List tables with row actions set `[rowTrackBy]="trackById"`, so a refresh keeps the rows'
DOM and the focused "⋮" button.

Actions: a list defines its actions once, as `ListAction<Id, Row>[]` with an `Id` union (for
example `'edit' | 'activate' | 'deactivate' | 'delete'`), the label, `bulk` for quick changes that
also apply to a selection (opening or editing one record is never bulk), `danger`, `confirm`
(`title`, optional `detail`, `accept`) and `appliesTo(row)` as
the only rule for which rows it applies to. `listRecord(actions, row, id, label)` turns a row into
the `ListRecord` the panel and row menu use (`label` is how people recognise the record, e.g. a
plate or "<kind> on <plate>"). The record link, the row menu and the bulk bar all call
`TablePanel.run`, which leaves out records the action does not apply to, asks the confirmation
(the same action title, count and record list for one or many, with a line for the selected
records left unchanged), emits `action` with the remaining IDs and
moves focus: back to the origin after Cancel or a confirmed non-destructive row action, to the
panel heading after a destructive or bulk action, or when a row action took its row out of the
list (for example a filter no longer matches it). The dialog's description (`aria-describedby`)
is the record count and list, the detail and the left-unchanged line. All applicable records are
listed in a bounded, keyboard-scrollable area; each label stays on one line, with its full text
in `title`. The host handles every action in
one `action` handler, whatever started it. The bulk bar and the confirmation only ever see the
selected records among the shown rows. Selection is state of the view and its host, not of the
panel: the view maps the selected rows to `ListRecord`s for `[selection]` and emits an empty
selection with every query change (search, filters, sort, page, page size); after an action the
host removes only the records it changed from the selection, and the other selected records stay
(a row action on an unselected row keeps the selection).

Bind TablePanel's `actionContext` to the current query identity, as `VehiclesView` does with its
`state` input. A context change or component destruction retires pending confirmations and
their callbacks, so an obsolete answer cannot emit an action or restore focus into another
query. The panel aborts its confirmation controller and clears the pending record list.
`confirmAction` also accepts an optional `AbortSignal`; aborting closes the dialog and resolves
`false`, and an already-aborted signal returns `false` without opening it.

### Operation feedback

`ui/operation-toast.ts` provides the shared `holita-operation-toast` presentation. `AdminWorkspace`
installs one outlet and one component-scoped `MessageService` above its login and signed-in
content. Connected Fleet lists, drawers and General settings use that provider. Workspace
changes clear displayed messages, and retired write callbacks cannot publish into another workspace. Storybook's shared
decorator installs the same component with its own provider for pattern and sample stories; real
routed stories use the provider inside `AdminWorkspace`.

The outlet sits at the top right below the topbar, fits the viewport width and shows up to three
messages as separate cards; `src/styles/_toast.scss` owns its responsive spacing. A completed
batch publishes one summary, with failed record labels and messages when needed.
Only successful IDs leave the selection; failed records stay available for retry. Success
messages close after five seconds; warning/error operation summaries stay until dismissed.
The outlet floats above the page, so results do not change table height or move its controls.

TablePanel has no result-message input or dismissal output. Its loading/error states and Retry
remain local to the list; field validation, save errors beside an editable draft and contextual
warnings also remain inline. The message pass-through in `ui/operation-toast.ts` announces
success with `role="status"`/`aria-live="polite"` and other severities with
`role="alert"`/`aria-live="assertive"`. Its headless content uses the standard toast classes and
icons with a normal close button: PrimeNG's default close button has native `autofocus`, which
can steal focus when an initiating save button disappears. PrimeNG still owns the message
lifecycle, stacking and dismissal.

All connected Fleet screens use this workspace feedback flow. Karma retains its temporary legacy
feedback presentation.

### PrimeNG usage rules

Registered component presets (`registeredComponents`, 31): autocomplete, avatar, badge, button,
checkbox, chip, confirmdialog, datatable, datepicker, dialog, drawer, iconfield, inputnumber,
inputtext, menu, message, metergroup, paginator, popover, select, selectbutton, skeleton, tabs,
tag, textarea, timeline, toast, togglebutton,
toggleswitch, tooltip and virtualscroller. Adding a control means adding its preset there (and
those of the controls it renders internally), to the sorted list in `holita-preset.spec.ts` and to
the "PrimeNG coverage" story (`primeng-coverage.html` and the count its play function asserts).
Because stories run axe with violations as failures, and lint rejects deprecated APIs:

- every `<p-confirmdialog>` uses `[pt]="confirmDialogPt(language)"` (names its close button and
  makes the `p-dialog` host presentational); with a `#message` template it passes the message's
  ID as the second argument, which becomes the dialog's `aria-describedby`;
- `p-popover` gets `ariaLabel` (FilterBuilder sets the root `aria-label` through `[pt]`
  instead), `p-drawer` `ariaCloseLabel`, `p-dialog` `closeAriaLabel`,
  `p-autocomplete [dropdown]` `dropdownAriaLabel`, `p-metergroup` an `aria-label`;
- multiple choice uses `p-select [multiple]="true" [pt]="selectMultiplePt"`
  (`ui/select-multiple.ts`: Select puts `aria-multiselectable` on its combobox, which axe rejects;
  the overlay listbox keeps it); PrimeNG 22 deprecates `p-multiselect`; applied filters are
  FilterBuilder chips;
- `p-progressbar` is not used (it renders an `aria-level` attribute progress bars may not carry);
  TablePanel draws its own decorative refresh bar;
- `p-autocomplete [forceSelection]` clears unmatched text only when its overlay is closed at the
  input's `change` event; leaving the field while "no results" is shown keeps the typed text and
  the previous value, so a single-value picker reconciles its text with the selected option when
  focus leaves it.

## List URL state

List views with search, sort or paging (`features/fleet/*/*-view.ts` for vehicles, drivers, devices,
maintenance, alerts and trips) take a `ListQuery` input (`state`) and emit `stateChange` with the
next query (`listQuery` transitions); their hosts keep the query and map it to their own query
variables. The groups view has no query (only `rows` and `view`). In that flow
FilterBuilder search applies on every input, and sorting goes through `listQuery.sorted`.
The live `VehiclesPage` uses `UrlListState` and a `ListDefinition` in `vehicle-query.ts` to keep
search, AND conditions, sort, page and page size in the query string. Its `conditions` parameter
contains the validated JSON condition array, mapped explicitly to the generated Fleet filter
input. Created-date conditions use the configured Branch's calendar dates. Summary counts cover the whole
Branch and do not depend on the list query. The displayed data time comes from the server;
an absent clock is formatted as unknown rather than replaced with the browser's current time.
The other example hosts keep their `ListQuery` in local signals.

`FilterField` can declare numeric `min`/`max`/`integer`, trimmed Unicode `maxLength` and
selection `maxValues`. FilterBuilder blocks Apply and shows a localized explanation when a
draft exceeds these bounds; numeric native hints preserve the invalid draft for correction.
Its optional `maxConditions` limits new conditions while allowing existing ones to be edited
or cleared. Vehicles uses the backend limits: 50 conditions, 100 selected values per condition,
year 1950–2100 as an integer, odometer 0–10,000,000 km and make up to 64 code points.

A `ListDefinition<F, S>` declares `pageSizes` and `defaultPageSize`, `sorts` (`{ param, field }`:
URL parameter to API sort field), `defaultSort` and optional `viewDefaultSorts` (`{ param, sorts }`:
a filter parameter whose value selects another default sort), `filters` (one `FilterCodec` per
key) and an optional pure `normalizeFilter` applied after reading and before writing. `codecs`:
`enumList(values)` and `idList(max)` (comma-separated, trimmed, deduplicated, unknown values
dropped, at most 100; IDs are UUIDs, lower-cased), `boolean()` (`true`/`false`), `dateOnly()` (a
real `YYYY-MM-DD` date), `choice(values, fallback)` (the fallback is never written),
`integer(min, max)` and `number(min, max, step)` (rounded to `step`); scalar codecs read the first
comma-separated value. Pure helpers: `readListState`, `listStateParams` (defaults written as
`null`), `sameListState`, `defaultSortOf`, `activeFilterCount` (filters other than the per-view
parameter), `normalizeSearch`, `searchTokens`, `searchApplies`, `maxSearchLength` (200) and
`maxSearchWords` (5).

| Parameter          | Rules                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`           | Trimmed, NUL removed, at most 200 code points; more than five words is not applied (FilterBuilder error)                                                                          |
| `sort`, `order`    | Sort parameter from the definition and `asc`/`desc`; `order` absent means the default direction for the default field and ascending for any other (`ListState` uses `ASC`/`DESC`) |
| `page`, `pageSize` | Digits only, clamped to 1 … ⌊2147483647 / pageSize⌋ + 1 and corrected to the last page once totals arrive; an allowed size                                                        |
| filter fields      | Comma-separated, validated by the codec; unknown values are dropped                                                                                                               |

`new UrlListState(definition)` in a field initializer (it injects `ActivatedRoute`, `Router` and
`DestroyRef`) exposes `state` (a signal), `changes` (distinct states), `searchDraft` and
`searchError` (`'searchTooManyWords'`, a `uiMessages` key the host translates for FilterBuilder
`searchError`). `editSearch(value)` applies after 300 ms unless the text has more than five words;
`cancelPending()` drops a pending search. `patchFilter(changes)`, `setSort(field, direction)` and
`resetSort()` return to page 1. `sortFromTable(event)` takes `{ field, order }` from `p-table`
`(onSort)`, where `field` is a sort parameter of the definition, and applies the last event of a
burst. `setPage({ page, pageSize })` returns to page 1 when the size changes. `clearFilters()`
clears the search and every filter except the per-view parameter. `correctPage(lastPage)` moves a
past-the-end page back. User changes push a history entry; invalid or non-normalised URLs and page
corrections are rewritten with `replaceUrl`. Query parameters are merged and the fragment is kept.
`UrlListState` never fetches: pages map the state to their own query variables.

## Route drawers

`holita-route-drawer` closes in one of two ways; in both, "keep editing" in `confirmLeave(dirty)`
leaves the drawer open, and a dirty drawer also guards page unload.

- Host-controlled (`[closeLink]="null"`): the close button, Escape and the backdrop emit
  `closeRequest`; the component that renders the drawer awaits `confirmLeave(dirty)` and only on
  `true` emits its own `closed` output, after which its page removes it. Sample Fleet hosts use
  this mode (the read-only trip drawer closes without asking).
- Routed (`closeLink`, default `['..']`): closing navigates relative to the drawer's route with
  the query and fragment preserved. A child route with
  `data: { drawer: true, mode, recordParam?, fixedVehicleParam? }` and
  `canDeactivate: [leaveDrawer]` asks the component's `canLeave()`, which calls
  `confirmLeave(dirty)`; `leaveDrawer` allows leaving when no drawer component is mounted.
  `drawerRouteData(route)` validates that data (`mode` `create`, `edit` or `view`;
  `recordParam` `recordId`, `vehicleId` or `driverId`, required except in `create`;
  `fixedVehicleParam` `vehicleId`) and `drawerParam(route, name)` reads a parameter from the route
  or its ancestors. The host renders `<router-outlet [routerOutletData]="drawerHost" />`, and
  `injectDrawerHost()` reads that `DrawerHost` from `ROUTER_OUTLET_DATA` (a no-op host when
  absent) so a drawer can report `saved({ message, recordId })` while it is alive. Live Vehicles
  uses this mode: `/new` and `/:recordId/edit` are child routes over the retained list.
  `VehicleEditorPage` supplies the absolute list `closeLink` to `VehicleDrawer`; the route guard
  asks once before discarding a dirty draft. A saved drawer clears its dirty state, notifies its
  list host and closes while preserving the list query and fragment. Its own scoped API client
  loads the record and group/driver choices; loading, invalid ID, missing record and read failure
  use the shared drawer states.

Editing Fleet drawers lock their form while saving, reject duplicate submits and ignore close
and route-leave attempts until the operation settles. A failed save retains the draft and
focuses the first server-invalid field, or calls `keepFocusInside()` to restore a lost focus to
the drawer title. Story hosts delegate `canLeave()` through the existing `leaveDrawer` guard,
so sidebar navigation protects open drafts too. General settings guards navigation and unload,
locks its fields, and restores its page title if focus was lost or its draft was discarded.

On destroy the drawer returns focus to the element that was focused when it was created, or
`#page-title`.

## General settings and Fleet preferences

`GeneralSettingsPage` at `/fleet/settings/general` reuses the full-page
`GeneralSettingsView`: titled cards, typed Reactive Forms and a sticky dirty/save bar. Server
field errors focus the first affected control even after a synchronous failure. The form
guards navigation and unload, locks during submission, retains rejected drafts and restores
the saved baseline on Discard. Notification controls are visibly labelled Demo/unavailable,
disabled in the live page and excluded from persistence. The speed limit is a stored reference;
changing it does not create or change speeding alerts.

`FleetWorkspace` gates business views on its captured `FleetPreferences` read. Loading and
read failure/Retry appear before business queries; unknown/disabled Branches issue neither
preferences nor business reads. The same workspace supplies display units and time zone.
General's separate write client saves Fleet preferences first, then conditionally renames the
Core Branch. These writes are not atomic. A failed rename leaves the saved Fleet values in
effect, keeps the name draft editable and reports a partial-save warning. Discard restores
the actual persisted values. Full success clears the draft and refreshes Branch discovery
after a rename; retired callbacks cannot apply preferences or announce results in a new scope.

## Storybook review

The admin Storybook (`npm run storybook:admin`, port 11001) renders the real Angular components
([development](development.md#admin-storybook)). It opens on "Start here" (what to review and links
to every example), then Examples and Design System. It is English only; the product's languages
live in the application catalogs, and the example shell's language menu lists sample languages
that change nothing. Pattern stories render `app/ui` components with story inputs. The Shell
stories use the real navigation, and the routed ones (Fleet disabled, Unknown Branch, Branch
discovery loading and error) answer `AdminBranches` through `FixtureHttpBackend`. The Fleet
examples use no GraphQL: `ExampleApp`
(`src/storybook/samples/example-app.ts`) renders the real shell with the sample navigation, account
and notifications, and the story-only hosts in `src/storybook/samples/pages` feed the
presentation-only `features/fleet/*` views and drawers. The hosts use deterministic samples
(`samples/fleet-samples.ts`: 4 groups `g1`–`g4`, 22 drivers `d01`–`d22`, 46 vehicles `v01`–`v46`,
64 trips `t001`–`t064`, 38 alerts, 30 service tasks and the devices, generated from fixed seeds
relative to `sampleNow`, which equals the default story clock), the story-only list engine
`runSampleList` (search, AND conditions, sort with unknown values last in either direction,
contract secondary keys and final ID ordering, paging) and simulated saves (`saveDelayMs`, 700 ms).
Devices and General settings examples use visible PrimeNG Demo labels and Storybook
`prototype` tags. The live Devices screen supports stock and stored connection facts; signal,
voltage, firmware policy and Restart remain unavailable/Demo. The General sample host remains
a product demonstration; the live General page persists regional preferences/thresholds and
the Core Branch name, while notification delivery remains explicitly unavailable. Existing prototype filters/sorts stay
available; the shared sort menus also expose all sort fields in the current contracts. Sample
sort timestamps are deterministic fixture facts. Vehicle saves and deactivation both set
`updatedAt` to the fixed sample clock, so modification sorting reflects those writes.

Live Fleet containers render the same presentation components inside `FleetWorkspace`:
Vehicles/profile/odometer, Devices, Drivers/scorecard, Overview, Alerts, Trip log, Maintenance
and Vehicle groups/General settings ([Discocan Fleet](discocan/fleet.md#angular-foundation)). Their `Admin/...`
stories exercise real routes, APIs and captured Apollo clients using typed deterministic
`src/storybook/*-fixtures.ts` responses. These immutable snapshots exercise rendering, errors,
forms, save/close and partial actions; backend persistence, filtering and derived facts are
verified by database and real-Gateway browser checks. The sample `Examples/...` hosts remain
separate and demonstrate the presentation components without importing into the app.

`Admin/Fleet/Device configuration` renders the durable eData settings workflow through the
same routed container. Its compact parameter table keeps interval actions frozen at the right;
native disclosures retain raw definitions and operation metadata. Stories cover reads, writes,
confirmation, retained drafts and historical snapshots; see the [focused device checks](discocan/testing.md#background-device-configuration-read-checks).

`Examples/Authentication/Login` renders the existing application `Login` without a shell.
`storybook/login-fixtures.ts` answers its `AdminTenants`, `AdminDemoLogin` and `AdminBranches`
operations through the same fixture HTTP transport. It covers Tenant changes, sequential Branch
discovery, loading, empty, errors and retry; successful submission opens the sample Fleet with
the selected Tenant and Branch. The shell passes the selected Branch name through native
`RouterOutlet` data to the sample page headers and General settings' initial name. The synthetic
datasets remain shared fixtures; this does not load or switch real Branch data.
Sign out returns this authentication example to a fresh Login; it checks the active page's
unsaved draft first. It never activates a real application session.

The vehicle profile counts only OPEN alerts, consumes the fuel classification (including stale
fuel), and preserves unknown values separately from zero. Its optional vehicle specifications
can be cleared. The service tab opens the existing Maintenance drawer: PLANNED tasks are editable
and DONE tasks show their completion history. Profile editing uses the same fleet-number/VIN
uniqueness and inactive-vehicle/assigned-driver checks as the Vehicles sample; errors retain the
draft and focus the affected field. `acknowledged-alerts` demonstrates that acknowledged alerts
are absent from the open count, and `save-error` also covers profile editing and retry.

The Drivers drawer edits separate first and last names (required, 64 characters each),
optional employee number and identification key (32 each), phone (20), email (254), licence
number (32), the ten API licence categories, tachograph-card number (16), optional document
expiry dates, status and notes. Its record view shows all assigned vehicles and created/updated
timestamps. Empty document dates remain null and an empty category list stays empty. Document
flags use the supplied business date and the 30-day window; a document expiring today is shown
as due in zero days. The licence-category filter matches any selected category. Drivers and
scorecards share `SampleDrivers`; other feature hosts own isolated local sample datasets that
reset when their page is recreated. They do not synchronize mutations across features.

The vehicle profile opens `OdometerDrawer` for non-INACTIVE vehicles. It shows the previous
reading and source, accepts a finite odometer from 0 to 9,999,999.9 km and a Europe/Sofia
timestamp, and rounds distance to one decimal before comparing it with the previous reading.
The timestamp must be strictly later than the previous reading and no later than the supplied
minimum of now and the Branch data clock. During the autumn clock overlap, the default preserves
the exact supplied instant, including seconds and milliseconds; an edited repeated time resolves
to the earliest occurrence inside that permitted interval. Without a data clock the host supplies now. The sample
host uses its fixed clock and updates only the odometer and its service-distance display;
activity and the data clock stay unchanged. Failed saves retain the draft and can be retried.

Maintenance plans tasks with a service type from the API enum, an optional title (120 code
points), a workshop (128), notes (2,000), and a due date, odometer or both. Service dates are
2000-01-01 through 2100-12-31; due odometers are whole kilometres from 0 to 9,999,999. New tasks
offer vehicles that are not INACTIVE; an existing task keeps its vehicle. Planned costs are not
editable: actual EUR costs belong to completion. Saving locks the planning form and preserves
the draft on failure. Cancel service retains the plan as a read-only CANCELLED record.
Status and urgency are separate: only PLANNED tasks have OVERDUE,
DUE_SOON, UNKNOWN_ODOMETER or UPCOMING urgency. The `no-odometer` scenario shows unknown vehicle
odometers without inventing remaining kilometres. Summary costs include completions in the
30 calendar days ending at the fixture business date; planned urgency counts exclude INACTIVE vehicles.
The Sort menu includes completion date and creation time, with deterministic fixture dates.

Maintenance completes one PLANNED task through `ServiceCompletionDrawer`, with a business date,
optional service odometer, EUR cost, workshop, replaced parts and notes. Costs accept whole cents
from 0 through 1,000,000 EUR, with decimal-grid validation that rejects fractional cents without
rejecting valid amounts because of binary floating-point rounding. Providing a next date
and/or odometer schedules the same service on the same vehicle in the same simulated save;
the next date must follow completion and the next odometer must exceed a supplied completion
odometer. The sample's odometer floor comes only from services completed on earlier dates,
not telemetry or same-day completions. Completion does not update vehicle telemetry. Completed
services can be opened read-only; they cannot be edited or deleted. There is no bulk completion
or Done switch in the planning form. The completion stories also cover failure and retry,
invalid next schedules and earlier-service odometer errors; the planning stories cover an
optional title, cancellation and its retained record, and searching the saved workshop.
Historical completion is allowed for INACTIVE vehicles, but scheduling a next service requires a
non-INACTIVE Vehicle. The odometer floor continues to use only services completed on earlier dates.

Drivers open `DriverScorecardView` from a row action or their view drawer. Its 7/30/90-day
windows show the data clock and exact interval, distance-weighted driving and eco scores,
scored-trip coverage, the backend low-confidence flag and all nine maneuver categories split
by intensity 1/2/3/unknown. Zero scores and counts remain distinct from missing values;
no trips, unscored trips and no telemetry have separate scenarios. The view receives all
aggregates; deterministic sample values belong only to `DriverScorecardPage`. It derives no
rating bands, rankings, trends or per-category scores.
The list and scorecard share `samples/sample-drivers.ts` state scoped to `ExampleApp`, so a
created or edited driver survives navigation between them. A new driver has no trip history,
zero maneuver counts and unavailable averages; recreating the example app resets its sample state.

Example stories open a page with `exampleAt('<path>?<query>')`; the query belongs to the example
app's route, not to the Storybook URL. `save-error` fails the first save only, an unknown value
means the default, and closing a drawer removes `drawer` and `edit` from the route.
`storybook/interactions.ts` includes `enterNumber(input, value)` for numeric controls: paste,
Tab and an assertion of the committed numeric value. This exercises InputNumber's supported
paste handler instead of synthetic keypresses without the legacy key codes it expects.

| Path                     | `scenario`                                                                               | `drawer`                       | Other                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `overview`               | `loading`, `error`, `calm` (nothing to handle)                                           | —                              | —                                                                             |
| `alerts`                 | `loading`, `empty`, `error`, `save-error`                                                | `<id>`                         | Opens with the "not resolved" filter chip                                     |
| `trips`                  | `loading`, `empty`, `error`                                                              | `<id>`                         | —                                                                             |
| `vehicles`               | `loading`, `empty`, `error`, `save-error`                                                | `<id>`, `new`                  | —                                                                             |
| `vehicles/<id>`          | `loading`, `error`, `save-error`, `no-odometer`                                          | `edit`, `odometer`             | `tab=overview`, `trips`, `alerts` or `service`; an unknown ID shows not found |
| `drivers`                | `loading`, `empty`, `error`, `save-error`                                                | `<id>`, `new`                  | `edit=1` opens the record in its form                                         |
| `drivers/<id>/scorecard` | `loading`, `error`, `empty`, `no-telemetry`, `low-confidence`, `unscored`, `zero-scores` | —                              | `days=7`, `30` (default) or `90`; an unknown ID shows not found               |
| `devices`                | `loading`, `empty`, `error`, `save-error`                                                | `<id>`, `new`                  | —                                                                             |
| `maintenance`            | `loading`, `empty`, `error`, `save-error`, `completion-error`, `earlier-service`         | `<id>`, `new`, `complete-<id>` | Complete opens the per-record form; completed records open read-only          |
| `settings/groups`        | `loading`, `empty`, `error`                                                              | `<id>`, `new`                  | —                                                                             |
| `settings/general`       | `save-error`                                                                             | —                              | —                                                                             |

Toolbar globals: theme, brand and density; viewports `desktop1440`, `desktop1024` (the narrowest
desktop with the sidebar), `tablet768`, `mobile375`. A brand or density change re-bootstraps the
story with `provideHolitaTheme(choice)` and leaves no stale theme styles. `parameters.holita`
(`StoryFixtures`) controls the session (`signedIn`), Fleet availability (`fleetEnabled`), the story
clock (`now`, default `2026-10-18T07:00:00.000Z`) and the fixture `scenario` (`latencyMs` and
`failures` per operation or `<Operation>:<id>`).

| Title                          | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design System/Foundations      | Colors (the canvas, frame and panel colour tokens, the sidebar hover and active backgrounds and indicator, the tone and category tokens, the semantic colour tokens and the primary and surface ramps in both schemes; the contrast checks of the toolbar brand), Brand variants, Typography, Spacing and density (measured), Radii and borders, Status tones, Categorical palette, Breakpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Design System/Patterns         | PageHeader, KpiStrip, FilterBuilder, TablePanel (states, paging with one page, a large and an unlisted page size, selection, row actions, confirmation from a row and for a selection), Drawer (edit, view, view then edit, loading, saving, not found, error, server field errors, dirty with confirm), FormField, EmptyState, Charts, CSS patterns, Notifications (success, warning, error, long message, stacked); MenuButton and RowActions have no stories of their own (TablePanel, the Shell menus and the examples show them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Design System/PrimeNG coverage | Every registered control in both schemes, non-modal overlays and the confirm dialog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Design System/Shell            | Desktop, Rail, Mobile with navigation open, Fleet disabled, Unknown Branch, Branch discovery loading/error, theme-persistence warning, Branch menu, Notifications, Account menu, No notifications, Long names (desktop, narrow desktop and phone)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Examples                       | Fleet example pages inside the shell with sample data (no GraphQL); the sidebar switches between them and Examples/Tour visits every navigation entry. Overview: KPI tiles that open their lists, items that need attention, distance and activity charts, latest trips that open their record. Vehicles: quick search, filters, sorting, row and bulk actions, direct edit in the drawer, all states. Drivers: document expiry flags, scores and the mixed drawer (view, then Edit). Trips: a read-only list and view drawer, including ongoing trips and unknown end/metrics without a fabricated arrival. Alerts: a default filter chip, row actions by status, Acknowledge as the only bulk action (Resolve opens the record drawer), and a view drawer with workflow actions (acknowledge, resolve with an optional remark, reopen). Vehicle profile: a full record page with back link, the plate as the breadcrumb's last crumb, Edit (the vehicle drawer), KPIs and tabs (overview with facts and a chart, trips, alerts, service plan), loading, not found and error. Maintenance: urgency by date or odometer, money, and a drawer form that needs a date or an odometer reading. Devices: connection, signal and firmware, Restart for online devices (also in bulk, after a confirmation), and a drawer with read-only diagnostics above the installation form. Settings: a short groups list without search or paging (groups in use cannot be deleted; the others are deleted after a confirmation that names them) and the General page form with titled cards and a sticky save bar |

`npm run test:storybook:admin` runs every story in Chromium through `@storybook/addon-vitest`:
rendering, play functions and axe with `a11y.test: 'error'` (the PrimeUI license notice
`#p-license-host` is excluded). A violation is fixed in the token, component or story markup,
never by lowering the level. `npm run test:visual:admin` captures the reviewed stories
([testing](testing.md#storybook-visual-review)).

## Changing the design centrally

1. Brand or density for the application: change `appTheme` in `theme/theme-choice.ts`; nothing
   else changes.
2. A token: change it in `theme/` (brand, density, status tone or `appTokens`); when a colour pair
   changes, add or adjust the pair in `brandContrastChecks` or `toneContrastChecks`
   (`theme/contrast.ts`); update the emitted values `theme/holita-preset.spec.ts` asserts (a fixed
   list such as `--p-app-sidebar-width:15.5rem`); review Foundations, Patterns and a screen story
   in both schemes.
3. A new brand or density: add its name to the `BrandName`/`DensityName` union and to the
   `brandNames`/`densityNames` arrays in `theme/theme-choice.ts`, and its record to `brands.ts` or
   `densities.ts`; a brand on a new Aura palette also extends `AccentPalette`/`NeutralPalette`.
   The Storybook toolbar lists the records, while the preset spec, the contrast spec and the
   toolbar's choice reader iterate the arrays, so a name missing there is silently skipped. Update
   the brand, contrast and density tables in this document.
4. A pattern: change the component or CSS pattern once; every screen using it follows. Update its
   stories (`ui/css-patterns.stories.ts` for CSS patterns) and spec in the same change.
5. Breakpoints: change the Sass map in `styles/_breakpoints.scss`, the restatement in
   `src/test-setup.ts`, the `BreakpointName` union in `ui/media.ts`, the names in the Foundations
   "Breakpoints" story and the width table above.
6. Layer order: change `styles/_layers.scss` and `holitaThemeOptions.cssLayer.order` together; the
   preset spec asserts the emitted order.
7. A PrimeNG control: see [PrimeNG usage rules](#primeng-usage-rules).
8. A font weight: add its WOFF file to `public/fonts/lato` and an entry to `$weights` in
   `styles/_fonts.scss`.

Checks for such a change: `npm run test:admin -- --include="app/theme/**/*.spec.ts"
--include="app/ui/**/*.spec.ts" --include="app/layout/**/*.spec.ts" --skip-nx-cache` (add
`--include="app/workspace/**/*.spec.ts" --include="app/i18n/**/*.spec.ts"` for shell or catalog
changes), `npm run test:storybook:admin`, `npm run test:visual:admin` (candidates for review) and
the shell smoke (`npm run test:smoke:admin -- angular-shell.smoke.spec.mts`; see
[browser smoke checks](testing.md#real-federation-and-browser-smoke-checks)).

## Extending

- A token, brand, density, breakpoint or font weight:
  [Changing the design centrally](#changing-the-design-centrally) and the token table under
  [Theme](#theme).
- A CSS pattern: `styles/_patterns.scss` (the CSS patterns list under
  [Patterns](#patterns-srcappui)) and `ui/css-patterns.stories.ts`; a component pattern: a
  standalone `holita-` component in `src/app/ui/` with its spec, stories under
  `Design System/Patterns` and texts in `ui/i18n/{bg,en}.json`.
- A list page with actions: [Patterns](#patterns-srcappui) for the page header, KPI strip,
  FilterBuilder and TablePanel, [Table conventions](#table-conventions) for the `p-table` and the
  action model, and [List URL state](#list-url-state) for the query.
- A drawer: [Route drawers](#route-drawers) and the `holita-form-field` and form helpers under
  [Patterns](#patterns-srcappui).
- A navigation item or shell change: [Shell](#shell).
- A story: [Storybook review](#storybook-review); the
  [design-system skill](../.agents/skills/holita-admin-design-system/SKILL.md) has the procedure
  for an example page.
