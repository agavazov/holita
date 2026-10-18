import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { Plus } from '@primeicons/angular/plus';
import { Refresh } from '@primeicons/angular/refresh';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { onFrame } from '../../../storybook/story-config';
import { PageHeader } from './page-header';

const meta: Meta<PageHeader> = {
  title: 'Design System/Patterns/PageHeader',
  component: PageHeader,
  decorators: [moduleMetadata({ imports: [ButtonDirective, Tag, Plus, Refresh] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<PageHeader>;

export const List: Story = {
  render: () => ({
    template: `
      <holita-page-header
        eyebrow="Автопарк"
        title="Превозни средства"
        [count]="46"
        description="Влекачи, ремаркета и бусове на клон Discordia"
      >
        <span headerMeta class="app-muted" style="font-size: var(--p-app-text-sm)">Данни към 18.10.2026 09:30</span>
        <button headerActions pButton type="button" severity="secondary" [outlined]="true" aria-label="Обнови">
          <svg data-p-icon="refresh" aria-hidden="true"></svg>
        </button>
        <a headerActions pButton href="#new">
          <svg data-p-icon="plus" aria-hidden="true"></svg>
          Ново превозно средство
        </a>
      </holita-page-header>
    `,
  }),
};

export const DetailWithBackLink: Story = {
  name: 'Detail with back link',
  render: () => ({
    template: `
      <holita-page-header
        [backLink]="['/', 'bg']"
        backLabel="Превозни средства"
        eyebrow="Т-04 · Влекач · Международни"
        title="CB 1004 AX"
        description="MAN TGX 18.510 · 2021 · VIN WMA06XZZ1MP123456"
      >
        <p-tag headerMeta severity="success" value="Активно" />
        <button headerActions pButton type="button" severity="secondary" [outlined]="true">Редактирай</button>
      </holita-page-header>
    `,
  }),
};

export const LongTitle: Story = {
  name: 'Long title',
  render: () => ({
    template: `
      <holita-page-header
        eyebrow="Шофьори · Международни превози · Дългосрочни договори"
        title="Александър-Кристиян Петров-Стоянов Георгиев-Димитров Иванов"
        [count]="1234"
        description="Много дълго описание, което се съкращава в един ред, за да не измества действията и съдържанието под заглавието на страницата при тесни екрани."
      >
        <button headerActions pButton type="button">Действие</button>
      </holita-page-header>
    `,
  }),
};
