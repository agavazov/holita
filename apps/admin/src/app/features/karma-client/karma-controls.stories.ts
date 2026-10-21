import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { KarmaDateTime } from './date-time/karma-date-time';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { onFrame } from '../../../storybook/story-config';
import { karmaDateControl, karmaDateParameter } from './karma-date-time';
import { FormField } from '../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../ui/forms/focus';
import { karmaFilterErrors, type KarmaFilterErrors } from './filter-validation/karma-filter-errors';

/** Uses the same control contracts and CSS as the connected Karma account/history pages. */
@Component({
  selector: 'holita-karma-controls-demo',
  imports: [ReactiveFormsModule, ButtonDirective, KarmaDateTime, InputText, Select, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card karma-page" aria-label="Karma Client controls">
      <div class="page-heading">
        <div>
          <h1>Karma Client</h1>
          <p>Account search and message history</p>
        </div>
        <button pButton type="button" severity="secondary" [outlined]="true">Refresh</button>
      </div>
      <form
        class="karma-search"
        [formGroup]="searchForm"
        (ngSubmit)="search()"
        aria-label="Search: Users"
      >
        <div class="karma-field karma-search-field">
          <label for="karma-search-example">Search users</label>
          <input pInputText id="karma-search-example" formControlName="search" />
        </div>
        <button pButton type="submit">Search</button>
      </form>
      <form
        #filterForm
        class="karma-filters"
        [formGroup]="form"
        (ngSubmit)="apply()"
        aria-label="Message filters"
      >
        <holita-form-field
          class="karma-field"
          label="Page size"
          controlId="karma-size-example"
          [error]="fieldErrors().size?.message ?? null"
        >
          <p-select
            inputId="karma-size-example"
            [invalid]="!!fieldErrors().size"
            [pt]="{
              label: {
                'aria-invalid': fieldErrors().size ? 'true' : null,
                'aria-describedby': 'karma-size-example-error',
              },
            }"
            formControlName="size"
            [options]="[25, 50, 100]"
          />
        </holita-form-field>
        <holita-form-field
          class="karma-field"
          label="From (UTC)"
          controlId="karma-from-example"
          [error]="fieldErrors().from?.message ?? null"
        >
          <holita-karma-date-time
            inputId="karma-from-example"
            label="From (UTC)"
            [invalid]="!!fieldErrors().from"
            [invalidPart]="fieldErrors().from?.part ?? 'both'"
            describedBy="karma-from-example-error"
            formControlName="from"
          />
        </holita-form-field>
        <holita-form-field
          class="karma-field"
          label="To (UTC)"
          controlId="karma-to-example"
          [error]="fieldErrors().to?.message ?? null"
        >
          <holita-karma-date-time
            inputId="karma-to-example"
            label="To (UTC)"
            [invalid]="!!fieldErrors().to"
            [invalidPart]="fieldErrors().to?.part ?? 'both'"
            describedBy="karma-to-example-error"
            formControlName="to"
          />
        </holita-form-field>
        <holita-form-field
          class="karma-field"
          label="Parameter IDs"
          controlId="karma-parameters-example"
          [error]="fieldErrors().parameters?.message ?? null"
        >
          <input
            pInputText
            id="karma-parameters-example"
            [invalid]="!!fieldErrors().parameters"
            [attr.aria-invalid]="fieldErrors().parameters ? 'true' : null"
            aria-describedby="karma-parameters-example-error"
            formControlName="parameters"
            placeholder="1, 539"
          />
        </holita-form-field>
        <div class="page-actions karma-filter-actions">
          <button pButton type="submit">Apply filters</button>
          <button pButton type="button" severity="secondary" [outlined]="true" (click)="reset()">
            Clear filters
          </button>
        </div>
        <p class="filter-hint karma-filter-hint">Enter both UTC dates, or leave both empty.</p>
      </form>
      <p role="status">{{ result() }}</p>
    </section>
  `,
})
class KarmaControlsDemo {
  readonly searchForm = new FormGroup({ search: new FormControl('', { nonNullable: true }) });
  readonly form = new FormGroup({
    size: new FormControl(50, { nonNullable: true }),
    from: new FormControl(karmaDateControl('2026-01-01T08:15:30'), { nonNullable: true }),
    to: new FormControl(karmaDateControl('2026-01-02T09:45:00'), { nonNullable: true }),
    parameters: new FormControl('', { nonNullable: true }),
  });
  readonly result = signal('No filters applied.');
  readonly fieldErrors = signal<KarmaFilterErrors>({});
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('filterForm');

  search(): void {
    this.result.set(`Search: ${this.searchForm.getRawValue().search}`);
  }

  apply(): void {
    const value = this.form.getRawValue();
    const errors = karmaFilterErrors('edata', value, 'en');
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(
              form,
              [
                'size-example',
                'from-example',
                'from-example-time',
                'to-example',
                'to-example-time',
                'parameters-example',
              ],
              'karma-',
            );
          }
        },
        { injector: this.injector },
      );
      return;
    }
    this.result.set(`${karmaDateParameter(value.from)} / ${karmaDateParameter(value.to)}`);
  }

  reset(): void {
    this.form.reset({ size: 50, from: '', to: '', parameters: '' });
    this.apply();
  }
}

const meta: Meta<KarmaControlsDemo> = {
  title: 'Design System/Karma/Controls',
  component: KarmaControlsDemo,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<KarmaControlsDemo>;

export const Default: Story = {};
export const Mobile: Story = { globals: { viewport: { value: 'mobile375', isRotated: false } } };
export const Dark: Story = { globals: { theme: 'dark' } };

export const DateSelection: Story = {
  name: 'Date selection keeps API clock fields',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const from = canvas.getByRole('combobox', { name: 'From (UTC)' });
    await expect(from).toHaveValue('2026-01-01');
    await expect(canvas.getByRole('textbox', { name: 'From (UTC): time (HH:mm:ss)' })).toHaveValue(
      '08:15:30',
    );
    await userEvent.click(from);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('.p-datepicker-panel')).toBeVisible(),
    );
    const day = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '.p-datepicker-panel [data-date][tabindex="0"]',
    );
    if (!day) {
      throw new Error('Missing selected calendar day.');
    }
    await userEvent.click(day);
    await fireEvent.keyDown(from, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27 });
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('.p-datepicker-panel')).toBeNull(),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Apply filters' }));
    await expect(canvas.getByRole('status')).toHaveTextContent(
      '2026-01-01T08:15:30 / 2026-01-02T09:45:00',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }));
    await expect(from).toHaveValue('');
  },
};

export const InvalidFilters: Story = {
  name: 'Invalid clock focuses its field',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clock = canvas.getByRole('textbox', { name: 'From (UTC): time (HH:mm:ss)' });
    await userEvent.clear(clock);
    await userEvent.type(clock, '25:00:00');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(clock).toHaveFocus());
    await expect(clock).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() =>
      expect(
        canvas.getByText('Enter a valid time in HH:mm:ss format (00:00:00–23:59:59).'),
      ).toBeVisible(),
    );
    await expect(canvas.getByRole('combobox', { name: 'From (UTC)' })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
};
