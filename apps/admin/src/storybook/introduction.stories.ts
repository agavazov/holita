import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { UI_LANGUAGE } from '../app/ui/ui-language';
import bg from './introduction.bg.json';
import en from './introduction.en.json';

/** Guide to the design-system catalogue. */
@Component({
  selector: 'discocan-storybook-introduction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.lang]': 'language()' },
  template: `
    <main class="intro">
      <p class="intro__eyebrow">discocan admin · Storybook</p>
      <h1>{{ text().title }}</h1>
      <p>{{ text().intro }}</p>
      <p>{{ text().review }}</p>
      <h2>{{ text().reportTitle }}</h2>
      <p>{{ text().report }}</p>
      <h2>{{ text().buildingBlocks }}</h2>
      <p>
        {{ text().buildingBlocksNote }}
        <a [href]="link('design-system-tables--offset')" target="_top">{{ text().patternsLink }}</a>
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
    a {
      color: var(--p-primary-color);
      font-weight: 600;
    }
  `,
})
class StorybookIntroduction {
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
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
