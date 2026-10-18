import { afterNextRender, Component, input, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Timeline } from 'primeng/timeline';
import { expect, waitFor, within } from 'storybook/test';
import { FormField } from '../form-field/form-field';
import { RouteDrawer, type RouteDrawerState } from './route-drawer';

/** A drawer editor as feature drawers build it: sections, a field grid and a sticky footer. */
@Component({
  selector: 'holita-route-drawer-demo',
  imports: [
    RouteDrawer,
    ReactiveFormsModule,
    FormField,
    ButtonDirective,
    InputText,
    InputNumber,
    Select,
    Textarea,
    Tag,
    Timeline,
  ],
  template: `
    <holita-route-drawer
      [title]="readOnly() ? 'Аларма: критичен DTC код' : 'Редакция на CB 1004 AX'"
      [subtitle]="readOnly() ? 'CB 1004 AX · 18.10.2026 08:12' : 'Т-04 · Влекач'"
      [size]="readOnly() ? 'lg' : 'md'"
      [state]="state()"
      errorText="Няма връзка с gateway-а. (fixture-AdminFleetVehicle)"
      [saving]="saving()"
      [dirty]="dirty()"
      [closeLink]="['/']"
    >
      @if (readOnly()) {
        <p-tag drawerMeta severity="danger" value="Критична" />
      }
      @if (readOnly()) {
        <dl class="app-facts">
          <div>
            <dt>Превозно средство</dt>
            <dd>CB 1004 AX · Т-04</dd>
          </div>
          <div>
            <dt>Шофьор</dt>
            <dd>Иван Петров</dd>
          </div>
          <div>
            <dt>Код</dt>
            <dd class="app-mono">P0420</dd>
          </div>
          <div>
            <dt>Състояние</dt>
            <dd>Отворена</dd>
          </div>
          <div class="app-facts--wide">
            <dt>Описание</dt>
            <dd>Ефективността на катализатора е под прага (банка 1).</dd>
          </div>
        </dl>
        <section class="app-form-section">
          <h3>История</h3>
          <p-timeline [value]="events">
            <ng-template #content let-event>
              <div class="app-timeline-event">
                <span class="app-timeline-event__title">{{ event.title }}</span>
                <span class="app-timeline-event__meta">{{ event.meta }}</span>
              </div>
            </ng-template>
          </p-timeline>
        </section>
      } @else {
        <form [formGroup]="form" (submit)="$event.preventDefault()">
          <section class="app-form-section">
            <h3>Идентификация</h3>
            <div class="app-form-grid">
              <holita-form-field
                label="Регистрационен номер"
                controlId="plate"
                [required]="true"
                [error]="errors() ? 'Номерът вече се използва в клона.' : null"
              >
                <input
                  pInputText
                  id="plate"
                  formControlName="plate"
                  [invalid]="errors()"
                  [attr.aria-invalid]="errors() ? 'true' : null"
                  aria-describedby="plate-hint plate-error"
                />
              </holita-form-field>
              <holita-form-field
                label="Пореден номер"
                controlId="fleetNumber"
                hint="Вътрешен номер в автопарка"
              >
                <input
                  pInputText
                  id="fleetNumber"
                  formControlName="fleetNumber"
                  aria-describedby="fleetNumber-hint fleetNumber-error"
                />
              </holita-form-field>
              <holita-form-field
                class="app-form-grid--wide"
                label="VIN"
                controlId="vin"
                hint="17 знака, без I, O и Q"
                [error]="errors() ? 'Този VIN вече се използва в клона.' : null"
              >
                <input
                  pInputText
                  id="vin"
                  formControlName="vin"
                  class="app-mono"
                  [invalid]="errors()"
                  [attr.aria-invalid]="errors() ? 'true' : null"
                  aria-describedby="vin-hint vin-error"
                />
              </holita-form-field>
            </div>
          </section>
          <section class="app-form-section">
            <h3>Експлоатация</h3>
            <div class="app-form-grid">
              <holita-form-field label="Статус" controlId="status">
                <p-select
                  inputId="status"
                  formControlName="status"
                  [options]="statuses"
                  appendTo="body"
                  ariaLabel="Статус"
                />
              </holita-form-field>
              <holita-form-field label="Резервоар, л" controlId="tank">
                <p-inputnumber inputId="tank" formControlName="tank" [min]="0" [max]="1500" />
              </holita-form-field>
              <holita-form-field
                class="app-form-grid--wide"
                label="Бележки"
                controlId="notes"
                [counter]="{ length: 46, max: 2000 }"
              >
                <textarea
                  pTextarea
                  id="notes"
                  formControlName="notes"
                  rows="3"
                  aria-describedby="notes-hint notes-error"
                ></textarea>
              </holita-form-field>
            </div>
          </section>
        </form>
      }
      <div drawerFooter class="app-drawer-actions">
        <button pButton type="button" severity="secondary" [outlined]="true" [disabled]="saving()">
          Отказ
        </button>
        @if (!readOnly()) {
          <button pButton type="button" [loading]="saving()" [disabled]="saving()">Запази</button>
        }
      </div>
    </holita-route-drawer>
  `,
})
class RouteDrawerDemo {
  readonly state = input<RouteDrawerState>('ready');
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly errors = input(false);
  readonly readOnly = input(false);
  /** Shows the discard confirmation the leave guard opens for a dirty draft. */
  readonly confirmOnOpen = input(false);
  readonly drawer = viewChild.required(RouteDrawer);

  constructor() {
    afterNextRender(() => {
      if (this.confirmOnOpen()) void this.drawer().confirmLeave(this.dirty());
    });
  }
  readonly statuses = ['Активно', 'В сервиз', 'Неактивно'];
  readonly form = new FormGroup({
    plate: new FormControl('CB 1004 AX'),
    fleetNumber: new FormControl('Т-04'),
    vin: new FormControl('WMA06XZZ1MP123456'),
    status: new FormControl('Активно'),
    tank: new FormControl<number | null>(650),
    notes: new FormControl('Влекач за международни превози.'),
  });
  readonly events = [
    { title: 'Отворена', meta: '18.10.2026 08:12 · системно' },
    { title: 'Потвърдена', meta: '18.10.2026 08:40 · М. Георгиева' },
  ];
}

const meta: Meta<RouteDrawerDemo> = {
  title: 'Design System/Patterns/RouteDrawer',
  component: RouteDrawerDemo,
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<RouteDrawerDemo>;

export const Loading: Story = { args: { state: 'loading' } };
export const Ready: Story = { args: { state: 'ready' } };
export const Saving: Story = { args: { state: 'ready', saving: true } };
export const NotFound: Story = { name: 'Not found', args: { state: 'not-found' } };
export const ErrorState: Story = { name: 'Error', args: { state: 'error' } };
export const ServerFieldErrors: Story = { name: 'Server field errors', args: { errors: true } };
export const ReadOnly: Story = { name: 'Read-only', args: { readOnly: true } };

export const DirtyWithConfirm: Story = {
  name: 'Dirty with confirm',
  args: { dirty: true, confirmOnOpen: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('button', { name: 'Keep editing' })).toBeVisible(),
    );
    await expect(body.getByRole('button', { name: 'Discard changes' })).toBeVisible();
  },
};
