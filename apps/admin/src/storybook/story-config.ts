import { HttpBackend } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import {
  Component,
  effect,
  inject,
  InjectionToken,
  input,
  provideAppInitializer,
  signal,
  type ApplicationConfig,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { componentWrapperDecorator } from '@storybook/angular-vite';
import { MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';
import { appConfig } from '../app/app.config';
import { readLocalAdminConfig } from '../app/core/config/admin-config';
import type { Language } from '../app/i18n/messages';
import { appTheme, brandNames, densityNames, type ThemeChoice } from '../app/theme/theme-choice';
import { WALL_CLOCK } from '../app/ui/clock';
import { UI_LANGUAGE } from '../app/ui/ui-language';
import { primeNgTranslation } from '../app/workspace/primeng-translation';
import {
  type FixtureFailure,
  FixtureHttpBackend,
  type FixtureScenario,
  fixtureFailures,
  useFixtureScenario,
} from './graphql-fixtures';
import { clearSession, defaultBranchId, seedSession } from './session-fixtures';
import './general-settings-fixtures';
import './karma-fixtures';
import './device-configuration-fixtures';

/** Per-story fixture options, passed as `parameters.holita`. */
export interface StoryFixtures {
  /** Stories start signed in to the default Branch unless this is false. */
  readonly signedIn?: boolean;
  /** Fleet availability in the runtime configuration; default true. */
  readonly fleetEnabled?: boolean;
  /** The wall clock (`WALL_CLOCK`); default `2026-10-18T07:00:00.000Z`. */
  readonly now?: string;
  readonly scenario?: FixtureScenario;
}

export const defaultStoryNow = '2026-10-18T07:00:00.000Z';
let now = Date.parse(defaultStoryNow);
/** Storybook shows one language; the product's languages live in the application catalogs. */
const storyLanguage: Language = 'en';

/** The story's fixed wall clock in epoch milliseconds. */
export function storyNow(): number {
  return now;
}

/**
 * Toolbar globals that change the bootstrapped application. A change re-bootstraps the story
 * (the renderer compares module metadata), so providers built from the globals apply.
 */
export const STORY_GLOBALS = new InjectionToken<string>('story globals');

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The brand and density selected in the Storybook toolbar (the app itself uses `appTheme`). */
export function storyThemeChoice(globals: Readonly<Record<string, unknown>>): ThemeChoice {
  return {
    brand: brandNames.find((brand) => brand === globals['brand']) ?? appTheme.brand,
    density: densityNames.find((density) => density === globals['density']) ?? appTheme.density,
  };
}

/** The real application providers with a fixture transport, an in-memory location, the story
 * language and the story clock. */
export function storybookApplicationConfig(
  choice: ThemeChoice = appTheme,
  options: { readonly fleetEnabled?: boolean; readonly primeUiLicense?: string } = {},
): ApplicationConfig {
  return {
    providers: [
      ...appConfig(
        {
          graphqlUrl: '/graphql',
          fleetEnabled: options.fleetEnabled ?? true,
          ...(options.primeUiLicense ? { primeUiLicense: options.primeUiLicense } : {}),
        },
        choice,
      ).providers,
      { provide: HttpBackend, useClass: FixtureHttpBackend },
      MessageService,
      { provide: UI_LANGUAGE, useValue: signal(storyLanguage).asReadonly() },
      { provide: WALL_CLOCK, useValue: () => storyNow() },
      provideLocationMocks(),
      // Pattern stories render without AdminWorkspace, which sets these texts in the app.
      provideAppInitializer(() => {
        const primeNG = inject(PrimeNG);
        primeNG.setTranslation(primeNgTranslation(storyLanguage, primeNG.translation.aria));
      }),
    ],
  };
}

/**
 * The developer's PrimeUI key from the Git-ignored `public/config.local.json`, which Vite serves to
 * the interactive Storybook. Missing or invalid means no key.
 */
export async function loadStoryLicense(): Promise<string | undefined> {
  try {
    const response = await fetch('/config.local.json');
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return undefined;
    }
    return readLocalAdminConfig(await response.json()).primeUiLicense;
  } catch {
    return undefined;
  }
}

function readScenario(value: unknown): FixtureScenario {
  if (!isRecord(value)) {
    return {};
  }
  const latencyMs = typeof value['latencyMs'] === 'number' ? value['latencyMs'] : 0;
  const forced: Record<string, FixtureFailure> = {};
  const failures = value['failures'];
  if (isRecord(failures)) {
    for (const [operation, failure] of Object.entries(failures)) {
      const known = fixtureFailures.find((candidate) => candidate === failure);
      if (known) {
        forced[operation] = known;
      }
    }
  }
  return { latencyMs, failures: forced };
}

/** Reads `parameters.holita` with runtime checks. */
export function readStoryFixtures(value: unknown): StoryFixtures {
  if (!isRecord(value)) {
    return {};
  }
  return {
    ...(value['signedIn'] === false ? { signedIn: false } : {}),
    ...(value['fleetEnabled'] === false ? { fleetEnabled: false } : {}),
    ...(typeof value['now'] === 'string' ? { now: value['now'] } : {}),
    scenario: readScenario(value['scenario']),
  };
}

/** Applies the theme global and the story language to the document (and the stored theme). */
export function applyStoryGlobals(globals: Readonly<Record<string, unknown>>): void {
  const dark = globals['theme'] === 'dark';
  try {
    localStorage.setItem('holita.admin.theme', dark ? 'dark' : 'light');
  } catch {
    /* The class below still applies the theme. */
  }
  document.documentElement.classList.toggle('app-dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.lang = storyLanguage;
}

/**
 * Resets every piece of browser and fixture state a story depends on, before the application
 * bootstraps: forced failures, the clock, the stored session and the theme.
 */
export function prepareStory(fixtures: unknown, globals: Readonly<Record<string, unknown>>): void {
  const options = readStoryFixtures(fixtures);
  useFixtureScenario(options.scenario);
  const instant = Date.parse(options.now ?? defaultStoryNow);
  now = Number.isNaN(instant) ? Date.parse(defaultStoryNow) : instant;
  if (options.signedIn === false) {
    clearSession();
  } else {
    seedSession(defaultBranchId);
  }
  applyStoryGlobals(globals);
}

/** Shows a design-system pattern on the frame surface with page padding, as it appears in a page. */
export const onFrame = componentWrapperDecorator(
  (story) =>
    `<div style="min-block-size: 100dvh; padding: var(--p-app-gutter); background: var(--p-app-frame-background); color: var(--p-text-color)"><div style="display: flex; flex-direction: column; gap: var(--p-app-stack-gap); max-inline-size: var(--p-app-content-max-width); margin-inline: auto">${story}</div></div>`,
);

/** Story render function that opens an application path in the story language in `StoryApp`. */
export function routeAt(path: string) {
  return () => ({ props: { url: `/${storyLanguage}/${path}` } });
}

/** Renders the real application routes at a URL, for screen and flow stories. */
@Component({
  selector: 'holita-story-app',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class StoryApp {
  readonly url = input.required<string>();
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      void this.router.navigateByUrl(this.url());
    });
  }
}
