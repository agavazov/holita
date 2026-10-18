import { FormsModule } from '@angular/forms';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { expect, userEvent, within } from 'storybook/test';
import { onFrame } from '../../../storybook/story-config';
import { selectMultiplePt } from '../select-multiple';
import { FilterBar } from './filter-bar';

const meta: Meta<FilterBar> = {
  title: 'Design System/Patterns/FilterBar',
  component: FilterBar,
  decorators: [
    moduleMetadata({
      imports: [FormsModule, ButtonDirective, Select, SelectButton, ToggleSwitch],
    }),
    onFrame,
  ],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<FilterBar>;

const controls = `
  <p-selectbutton
    filterSegments
    [options]="[{ label: 'Отворени', value: 'open' }, { label: 'Потвърдени', value: 'ack' }, { label: 'Всички', value: 'all' }]"
    optionLabel="label"
    optionValue="value"
    [ngModel]="'open'"
    ariaLabelledBy="segment-label"
  />
  <span id="segment-label" class="app-visually-hidden">Статус на алармите</span>
  <p-select
    [multiple]="true"
    [pt]="selectMultiplePt"
    filterControls
    [options]="['Активно', 'В сервиз', 'Неактивно']"
    [ngModel]="statuses"
    placeholder="Статус"
    ariaLabel="Статус"
    appendTo="body"
    style="min-inline-size: 12rem"
  />
  <label filterControls style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: var(--p-app-text-sm)">
    <p-toggleswitch [ngModel]="false" inputId="no-device" />
    Без устройство
  </label>
  <button filterActions pButton type="button" severity="secondary" [text]="true" size="small">Нулирай сортирането</button>
`;

export const Empty: Story = {
  render: () => ({
    props: { statuses: [], selectMultiplePt },
    template: `<holita-filter-bar searchLabel="Търсене по номер, VIN или модел">${controls}</holita-filter-bar>`,
  }),
};

export const ActiveChips: Story = {
  name: 'Active chips',
  render: () => ({
    props: { statuses: ['В сервиз'], selectMultiplePt },
    template: `
      <holita-filter-bar
        searchLabel="Търсене по номер, VIN или модел"
        search="TGX"
        [chips]="[{ key: 'statuses', label: 'Статус: В сервиз' }, { key: 'groupIds', label: 'Група: Международни' }]"
        [activeCount]="2"
      >${controls}</holita-filter-bar>`,
  }),
};

export const SearchError: Story = {
  name: 'Search error',
  render: () => ({
    props: { statuses: [], selectMultiplePt },
    template: `
      <holita-filter-bar
        searchLabel="Търсене по номер, VIN или модел"
        search="един два три четири пет шест"
        searchError="Търсенето използва най-много пет думи."
      >${controls}</holita-filter-bar>`,
  }),
};

export const MobileCollapsed: Story = {
  name: 'Mobile collapsed',
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: () => ({
    props: { statuses: ['В сервиз'], selectMultiplePt },
    template: `
      <holita-filter-bar
        searchLabel="Търсене по номер, VIN или модел"
        [chips]="[{ key: 'statuses', label: 'Статус: В сервиз' }]"
        [activeCount]="1"
      >${controls}</holita-filter-bar>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: /Filters \(1\)/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  },
};
