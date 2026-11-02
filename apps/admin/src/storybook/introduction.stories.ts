import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { UI_LANGUAGE } from '../app/ui/ui-language';
import { adminNavigation } from '../app/workspace/admin-navigation';
import bg from './introduction.bg.json';
import en from './introduction.en.json';

type EntryId = keyof typeof en.entries;
const entries: Record<EntryId, { story: string; source: 'karma' | 'demo' | 'stored' }> = {
  overview: { story: 'admin-monitoring-overview--default', source: 'demo' },
  alerts: { story: 'admin-monitoring-alerts--default', source: 'demo' },
  trips: { story: 'admin-monitoring-trip-log--default', source: 'demo' },
  vehicles: { story: 'admin-fleet-vehicles--default', source: 'demo' },
  drivers: { story: 'admin-fleet-drivers--default', source: 'demo' },
  devices: { story: 'admin-fleet-devices--default', source: 'demo' },
  maintenance: { story: 'admin-fleet-maintenance--default', source: 'demo' },
  'karma-monitoring': { story: 'admin-karma-client-monitoring-trucks--default', source: 'stored' },
  'karma-settings': { story: 'admin-karma-client-settings--default', source: 'stored' },
  'karma-cars': { story: 'admin-karma-client-trucks--default', source: 'karma' },
  'karma-administration': {
    story: 'admin-karma-client-administration-users--default',
    source: 'karma',
  },
  'vehicle-groups': { story: 'admin-settings-vehicle-groups--default', source: 'demo' },
  general: { story: 'admin-settings-general--default', source: 'demo' },
};

/** Owner's guide, using the same menu and language as the admin. */
@Component({
  selector: 'holita-storybook-introduction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.lang]': 'language()' },
  template: `
    <main class="intro">
      <p class="intro__eyebrow">holita admin · Storybook</p>
      <h1>{{ text().title }}</h1>
      <p>{{ text().intro }}</p>
      <p>{{ text().review }}</p>
      <h2>{{ text().sourcesTitle }}</h2>
      <p>{{ text().sourcesNote }}</p>
      @for (group of navigation(); track group.id) {
        <h3>{{ group.label }}</h3>
        <ul class="intro__list">
          @for (item of group.items; track item.id) {
            @if (entry(item.id); as detail) {
              <li>
                <a [href]="link(detail.story)" target="_top">{{ item.label }}</a>
                <span class="intro__badge">{{ text()[detail.source] }}</span>
                <p>{{ description(item.id) }}</p>
              </li>
            }
          }
        </ul>
      }
      <h2>{{ text().statusTitle }}</h2>
      <h3>{{ text().provenTitle }}</h3>
      <ul>
        @for (fact of text().proven; track fact) {
          <li>{{ fact }}</li>
        }
      </ul>
      <h3>{{ text().unprovenTitle }}</h3>
      <ul>
        @for (fact of text().unproven; track fact) {
          <li>{{ fact }}</li>
        }
      </ul>
      <p>{{ text().logger }}</p>
      <p>
        <a
          [href]="link('admin-karma-client-trucks-truck-device-settings--default')"
          target="_top"
          >{{ text().settingsLink }}</a
        >
      </p>
      <p>
        <a
          [href]="link('admin-karma-client-trucks-truck-diagnostics--source-reports')"
          target="_top"
          >{{ text().diagnosticsLink }}</a
        >
      </p>
      <h2>{{ text().reportTitle }}</h2>
      <p>{{ text().report }}</p>
      <h2>{{ text().buildingBlocks }}</h2>
      <p>
        {{ text().buildingBlocksNote }}
        <a [href]="link('design-system-patterns-tablepanel--rows')" target="_top">{{
          text().patternsLink
        }}</a>
      </p>
    </main>
  `,
  styles: `
    .intro {
      max-inline-size: 56rem;
      margin-inline: auto;
      padding: var(--p-app-gutter);
      color: var(--p-text-color);
      font-size: var(--p-app-text-base);
      line-height: 1.6;
    }
    .intro__eyebrow {
      color: var(--p-text-muted-color);
    }
    h1 {
      font-size: 2rem;
      line-height: 1.2;
    }
    h2 {
      margin-block-start: 2rem;
      font-size: 1.4rem;
    }
    h3 {
      font-size: var(--p-app-text-md);
    }
    .intro__list {
      padding: 0;
      list-style: none;
    }
    .intro__list li {
      padding-block: 0.75rem;
      border-block-end: 1px solid var(--p-content-border-color);
    }
    .intro__list p {
      margin-block: 0.5rem 0;
    }
    a {
      color: var(--p-primary-color);
      font-weight: 600;
    }
    .intro__badge {
      display: inline-block;
      margin-inline-start: 0.75rem;
      padding: 0.125rem 0.5rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
      font-size: var(--p-app-text-xs);
    }
  `,
})
class StorybookIntroduction {
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly navigation = computed(() =>
    adminNavigation(this.language(), 'storybook', true),
  );

  protected entry(id: string) {
    return Object.entries(entries).find(([key]) => key === id)?.[1];
  }

  protected description(id: string): string {
    return Object.entries(this.text().entries).find(([key]) => key === id)?.[1] ?? '';
  }

  protected link(story: string): string {
    return `./?path=/story/${story}&globals=language:${this.language()}`;
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
