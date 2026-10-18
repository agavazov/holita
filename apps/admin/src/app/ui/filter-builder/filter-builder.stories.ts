import { Component, input, linkedSignal, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { onFrame } from '../../../storybook/story-config';
import { FilterBuilder } from './filter-builder';
import type { FilterCondition, FilterField } from './filter-model';

/** The columns a Vehicles list could offer, each with the conditions its backend supports. */
const fields: readonly FilterField[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['isAnyOf', 'isNoneOf'],
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'IN_WORKSHOP', label: 'In service' },
      { value: 'INACTIVE', label: 'Inactive' },
    ],
  },
  {
    key: 'group',
    label: 'Group',
    type: 'enum',
    operators: ['isAnyOf', 'isNoneOf', 'isEmpty'],
    options: [
      { value: 'intl', label: 'International' },
      { value: 'domestic', label: 'Domestic' },
      { value: 'city', label: 'City' },
    ],
  },
  { key: 'model', label: 'Model', type: 'text', operators: ['contains', 'equals', 'startsWith'] },
  {
    key: 'odometer',
    label: 'Odometer',
    type: 'number',
    unit: 'km',
    operators: ['gt', 'lt', 'between'],
  },
  { key: 'createdAt', label: 'Added', type: 'date', operators: ['after', 'before', 'between'] },
  { key: 'hasDevice', label: 'Has a tracker', type: 'boolean', operators: ['isTrue', 'isFalse'] },
];

const someConditions: readonly FilterCondition[] = [
  { id: 'a', field: 'status', operator: 'isAnyOf', values: ['ACTIVE', 'IN_WORKSHOP'] },
  { id: 'b', field: 'odometer', operator: 'between', values: ['100000', '400000'] },
  { id: 'c', field: 'createdAt', operator: 'after', values: ['2026-01-01'] },
  { id: 'd', field: 'hasDevice', operator: 'isFalse', values: [] },
];

/** Keeps search and conditions in local state, as a list page keeps them in its URL. */
@Component({
  selector: 'holita-filter-builder-demo',
  imports: [FilterBuilder],
  template: `
    <holita-filter-builder
      searchLabel="Search plate, model or notes"
      [search]="search()"
      [fields]="fields"
      [conditions]="conditions()"
      (searchChange)="search.set($event)"
      (conditionsChange)="conditions.set($event)"
    />
    <p class="app-muted" style="margin-block-start: 1rem; font-size: 0.8125rem">
      Search: “{{ search() }}” · {{ conditions().length }} condition(s)
    </p>
  `,
})
class FilterBuilderDemo {
  readonly initial = input<readonly FilterCondition[]>([]);
  readonly fields = fields;
  readonly search = signal('');
  readonly conditions = linkedSignal<readonly FilterCondition[]>(() => this.initial());
}

const meta: Meta<FilterBuilderDemo> = {
  title: 'Design System/Patterns/FilterBuilder',
  component: FilterBuilderDemo,
  decorators: [onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<FilterBuilderDemo>;

/** The fastest filter: just type. */
export const QuickSearch: Story = { name: 'Quick search' };

export const WithConditions: Story = {
  name: 'With conditions',
  args: { initial: someConditions },
};

/** Add filter → column → condition → value → Apply. */
export const AddCondition: Story = {
  name: 'Add a condition',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Add filter' }));
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: 'Filter condition' })).toBeVisible(),
    );
    await expect(body.getByRole('button', { name: 'Apply' })).toBeDisabled();
  },
};

export const EditCondition: Story = {
  name: 'Edit a condition',
  args: { initial: someConditions },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Edit filter: Odometer between/ }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('button', { name: 'Update' })).toBeEnabled());
  },
};

export const Mobile: Story = {
  args: { initial: someConditions },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
