import { HttpBackend } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, effect, inject, input, type ApplicationConfig } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { appConfig } from '../app/app.config';
import { resetFleetFixtures } from './fleet-fixtures';
import {
  type FixtureFailure,
  FixtureHttpBackend,
  type FixtureScenario,
  useFixtureScenario,
} from './graphql-fixtures';
import { clearSession, defaultBranchId, seedSession } from './session-fixtures';

/** Per-story fixture options, passed as `parameters.holita`. */
export interface StoryFixtures {
  /** Stories start signed in to the default Branch unless this is false. */
  readonly signedIn?: boolean;
  /** Starts the default Branch without vehicles. */
  readonly emptyFleet?: boolean;
  readonly scenario?: FixtureScenario;
}

/** The real application providers with a fixture transport and an in-memory location. */
export function storybookApplicationConfig(): ApplicationConfig {
  return {
    providers: [
      ...appConfig({ graphqlUrl: '/graphql', fleetEnabled: true }).providers,
      { provide: HttpBackend, useClass: FixtureHttpBackend },
      provideLocationMocks(),
    ],
  };
}

const failures: readonly FixtureFailure[] = ['network', 'graphql', 'pending'];

function readScenario(value: unknown): FixtureScenario {
  if (typeof value !== 'object' || value === null) return {};
  const latencyMs =
    'latencyMs' in value && typeof value.latencyMs === 'number' ? value.latencyMs : 0;
  const forced: Record<string, FixtureFailure> = {};
  if ('failures' in value && typeof value.failures === 'object' && value.failures !== null)
    for (const [operation, failure] of Object.entries(value.failures)) {
      const known = failures.find((candidate) => candidate === failure);
      if (known) forced[operation] = known;
    }
  return { latencyMs, failures: forced };
}

/**
 * Resets every piece of browser and fixture state a story depends on, before the application
 * bootstraps: fixture data, forced failures, the stored session, theme and document language.
 */
export function prepareStory(fixtures: unknown, theme: unknown, locale: unknown): void {
  const options = typeof fixtures === 'object' && fixtures !== null ? fixtures : {};
  resetFleetFixtures({ empty: 'emptyFleet' in options && options.emptyFleet === true });
  useFixtureScenario(readScenario('scenario' in options ? options.scenario : undefined));
  if ('signedIn' in options && options.signedIn === false) clearSession();
  else seedSession(defaultBranchId);

  const dark = theme === 'dark';
  try {
    localStorage.setItem('holita.admin.theme', dark ? 'dark' : 'light');
  } catch {
    /* The class below still applies the theme. */
  }
  document.documentElement.classList.toggle('app-dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.lang = locale === 'en' ? 'en' : 'bg';
}

/** Story render function that opens a language-prefixed application path in `StoryApp`. */
export function routeAt(path: string) {
  return (_args: unknown, context: { readonly globals: Readonly<Record<string, unknown>> }) => ({
    props: { url: `/${context.globals['locale'] === 'en' ? 'en' : 'bg'}/${path}` },
  });
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
