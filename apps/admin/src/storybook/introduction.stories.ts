import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';

interface Entry {
  readonly story: string;
  readonly title: string;
  readonly shows: string;
}

const examples: readonly Entry[] = [
  {
    story: 'examples-tour--all-pages',
    title: 'Tour',
    shows: 'Every example page in one app; switch pages in the sidebar.',
  },
  {
    story: 'examples-monitoring-overview--default',
    title: 'Overview',
    shows: 'Dashboard: KPI tiles that open their lists, items that need attention, charts.',
  },
  {
    story: 'examples-fleet-vehicles--default',
    title: 'Vehicles',
    shows:
      'The full list: quick search, "Add filter", sorting, paging, "⋮" row actions, bulk actions and direct edit in the drawer.',
  },
  {
    story: 'examples-fleet-vehicle-profile--overview',
    title: 'Vehicle profile',
    shows: 'A record page with tabs, a back link and Edit in the drawer.',
  },
  {
    story: 'examples-fleet-drivers--view',
    title: 'Drivers',
    shows: 'The mixed drawer: a record opens read-only and Edit switches to the form.',
  },
  {
    story: 'examples-monitoring-trips--trip-drawer',
    title: 'Trips',
    shows: 'A read-only list and a view drawer with a timeline.',
  },
  {
    story: 'examples-monitoring-alerts--open-alert',
    title: 'Alerts',
    shows: 'A default filter chip and a view drawer with workflow actions.',
  },
  {
    story: 'examples-service-maintenance--default',
    title: 'Maintenance',
    shows: 'Due by date or odometer, money, and a form with "one of two" validation.',
  },
  {
    story: 'examples-fleet-devices--edit',
    title: 'Devices',
    shows: 'Direct edit with read-only diagnostics above the form.',
  },
  {
    story: 'examples-settings--general-unsaved',
    title: 'Settings',
    shows: 'A page form with a sticky save bar, and a short list of vehicle groups.',
  },
];

const foundations: readonly Entry[] = [
  {
    story: 'design-system-foundations--colors',
    title: 'Foundations',
    shows: 'Colours with live contrast, brands, typography, spacing, radii, tones, breakpoints.',
  },
  {
    story: 'design-system-patterns-tablepanel--rows',
    title: 'Patterns',
    shows: 'The building blocks of every page, each with its states.',
  },
  {
    story: 'design-system-primeng-coverage--controls',
    title: 'PrimeNG coverage',
    shows: 'Every PrimeNG control the admin uses, in the holita theme.',
  },
  {
    story: 'design-system-shell--desktop',
    title: 'Shell',
    shows: 'Sidebar, rail, topbar and mobile navigation.',
  },
];

/** The Storybook landing page: what to review and how. English only, like all stories. */
@Component({
  selector: 'holita-storybook-introduction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="intro">
      <p class="intro__eyebrow">holita admin</p>
      <h1>Design system and example pages</h1>
      <p class="intro__lead">
        Every page of the admin is built from the same patterns, so a change here changes it
        everywhere. The examples use sample data only; nothing talks to a backend.
      </p>

      <h2>Start with the examples</h2>
      <ul class="intro__list">
        @for (entry of examples; track entry.story) {
          <li>
            <a [href]="link(entry)" target="_top">{{ entry.title }}</a>
            <span>{{ entry.shows }}</span>
          </li>
        }
      </ul>

      <h2>How to review</h2>
      <ul class="intro__bullets">
        <li>
          Toolbar: <strong>Theme</strong> (light, dark), <strong>Brand</strong>,
          <strong>Density</strong> and the viewport (desktop 1440, tablet 768, mobile 375).
        </li>
        <li>
          Each example has stories for its states: loading, empty, no results, error, save errors,
          mobile and dark.
        </li>
        <li>
          The language menu in the topbar lists sample languages only; Storybook stays in English.
          The product's languages live in the application catalogs.
        </li>
        <li>The Accessibility panel runs axe on every story; story tests fail on violations.</li>
      </ul>

      <h2>Design system</h2>
      <ul class="intro__list">
        @for (entry of foundations; track entry.story) {
          <li>
            <a [href]="link(entry)" target="_top">{{ entry.title }}</a>
            <span>{{ entry.shows }}</span>
          </li>
        }
      </ul>
    </main>
  `,
  styles: `
    .intro {
      max-inline-size: 52rem;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
      color: var(--p-text-color);
      font-size: var(--p-app-text-base);
      line-height: 1.55;
    }
    .intro__eyebrow {
      margin: 0;
      font-size: var(--p-app-text-xs);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--p-app-canvas-muted-color);
    }
    h1 {
      margin: 0.25rem 0 0.75rem;
      font-size: 1.75rem;
      line-height: 1.2;
    }
    h2 {
      margin: 2rem 0 0.75rem;
      font-size: var(--p-app-text-md);
    }
    .intro__lead {
      margin: 0;
      color: var(--p-app-canvas-muted-color);
    }
    .intro__list {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .intro__list li {
      display: grid;
      grid-template-columns: minmax(8rem, 10rem) 1fr;
      gap: 1rem;
      padding: 0.5rem 0;
      border-block-end: 1px solid var(--p-content-border-color);
    }
    .intro__list a {
      color: var(--p-primary-color);
      font-weight: 600;
    }
    .intro__bullets {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding-inline-start: 1.25rem;
    }
    @media (max-width: 40rem) {
      .intro__list li {
        grid-template-columns: 1fr;
        gap: 0.125rem;
      }
    }
  `,
})
class StorybookIntroduction {
  protected readonly examples = examples;
  protected readonly foundations = foundations;

  /** A link to a story in the Storybook manager (the page above this iframe). */
  protected link(entry: Entry): string {
    return `./?path=/story/${entry.story}`;
  }
}

const meta: Meta<StorybookIntroduction> = {
  title: 'Start here',
  component: StorybookIntroduction,
  tags: ['!autodocs'],
  parameters: { controls: { disable: true }, options: { showPanel: false } },
};

export default meta;

export const Introduction: StoryObj<StorybookIntroduction> = {};
