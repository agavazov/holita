import { afterNextRender, Component, input, linkedSignal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { FormField } from '../form-field/form-field';
import { lockWhileSaving } from '../forms/saving';
import { RouteDrawer, type RouteDrawerState } from './route-drawer';

/**
 * The three drawer modes:
 * - `edit`: a row opens straight into its form (the default for simple records);
 * - `view`: a read-only record (e.g. a trip or a log entry);
 * - `view-edit`: the record opens read-only and Edit switches the same drawer to its form.
 */
type DrawerMode = 'edit' | 'view' | 'view-edit';

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
  ],
  template: `
    <holita-route-drawer
      [title]="editing() ? (mode() === 'edit' ? 'Edit CB 1004 AX' : 'Edit vehicle') : 'CB 1004 AX'"
      subtitle="T-04 · Tractor unit · Scania R 450"
      [state]="state()"
      errorText="The gateway is not reachable. (fixture-AdminFleetVehicle)"
      [saving]="saving()"
      [dirty]="dirty()"
      [closeLink]="null"
    >
      @if (!editing()) {
        <p-tag drawerMeta severity="success" value="Active" />
      }
      @if (!editing()) {
        <dl class="app-facts">
          <div>
            <dt>Plate</dt>
            <dd>CB 1004 AX</dd>
          </div>
          <div>
            <dt>Fleet number</dt>
            <dd>T-04</dd>
          </div>
          <div>
            <dt>VIN</dt>
            <dd class="app-mono">WMA06XZZ1MP123456</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>International</dd>
          </div>
          <div>
            <dt>Fuel tank</dt>
            <dd>650 L</dd>
          </div>
          <div>
            <dt>Current driver</dt>
            <dd>Ivan Petrov</dd>
          </div>
          <div class="app-facts--wide">
            <dt>Notes</dt>
            <dd>Tractor unit for international routes. Next tachograph check in March.</dd>
          </div>
        </dl>
      } @else {
        <form [formGroup]="form" (submit)="$event.preventDefault()">
          <section class="app-form-section">
            <h3>Identification</h3>
            <div class="app-form-grid">
              <holita-form-field
                label="License plate"
                controlId="plate"
                [required]="true"
                [error]="errors() ? 'This plate is already used in the branch.' : null"
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
                label="Fleet number"
                controlId="fleetNumber"
                hint="Internal number"
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
                hint="17 characters, without I, O and Q"
                [error]="errors() ? 'This VIN is already used in the branch.' : null"
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
            <h3>Operation</h3>
            <div class="app-form-grid">
              <holita-form-field label="Status" controlId="status">
                <p-select
                  inputId="status"
                  formControlName="status"
                  [options]="statuses"
                  appendTo="body"
                  ariaLabel="Status"
                />
              </holita-form-field>
              <holita-form-field label="Fuel tank, L" controlId="tank">
                <p-inputnumber inputId="tank" formControlName="tank" [min]="0" [max]="1500" />
              </holita-form-field>
              <holita-form-field
                class="app-form-grid--wide"
                label="Notes"
                controlId="notes"
                [counter]="{ length: 69, max: 2000 }"
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
        @if (editing()) {
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="saving()"
            (click)="cancel()"
          >
            Cancel
          </button>
          <button pButton type="button" [loading]="saving()" [disabled]="saving()">Save</button>
        } @else {
          <button pButton type="button" severity="secondary" [outlined]="true">Close</button>
          @if (mode() === 'view-edit') {
            <button pButton type="button" (click)="editing.set(true)">Edit</button>
          }
        }
      </div>
    </holita-route-drawer>
  `,
})
class RouteDrawerDemo {
  readonly mode = input<DrawerMode>('edit');
  readonly state = input<RouteDrawerState>('ready');
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly errors = input(false);
  /** Shows the discard confirmation the leave guard opens for a dirty draft. */
  readonly confirmOnOpen = input(false);
  /** `edit` opens on the form; the other modes open on the read-only record. */
  readonly editing = linkedSignal(() => this.mode() === 'edit');
  readonly drawer = viewChild.required(RouteDrawer);

  constructor() {
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.drawer().keepFocusInside();
      },
    );
    afterNextRender(() => {
      if (this.confirmOnOpen()) {
        void this.drawer().confirmLeave(this.dirty());
      }
    });
  }

  cancel(): void {
    // In view-edit, Cancel returns to the record; a direct editor would close instead.
    if (this.mode() === 'view-edit') {
      this.editing.set(false);
    }
  }

  readonly statuses = ['Active', 'In service', 'Inactive'];
  readonly form = new FormGroup({
    plate: new FormControl('CB 1004 AX'),
    fleetNumber: new FormControl('T-04'),
    vin: new FormControl('WMA06XZZ1MP123456'),
    status: new FormControl('Active'),
    tank: new FormControl<number | null>(650),
    notes: new FormControl(
      'Tractor unit for international routes. Next tachograph check in March.',
    ),
  });
}

const meta: Meta<RouteDrawerDemo> = {
  title: 'Design System/Patterns/Drawer',
  component: RouteDrawerDemo,
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<RouteDrawerDemo>;

/** The default: a row opens straight into its form. */
export const Edit: Story = { args: { mode: 'edit' } };

/** A read-only record. */
export const View: Story = { args: { mode: 'view' } };

/** The mixed case: the record opens read-only and Edit switches the drawer to the form. */
export const ViewThenEdit: Story = {
  name: 'View then edit',
  args: { mode: 'view-edit' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('button', { name: 'Edit' })).toBeVisible());
    await userEvent.click(body.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(body.getByRole('textbox', { name: /License plate/ })).toBeVisible());
  },
};

export const Loading: Story = { args: { state: 'loading' } };
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('textbox', { name: /License plate/ })).toBeDisabled(),
    );
    await expect(body.getByRole('spinbutton', { name: 'Fuel tank, L' })).toBeDisabled();
    await expect(body.getByRole('button', { name: /^Close$/ })).toBeDisabled();
    await expect(body.getByRole('button', { name: /^Cancel$/ })).toBeDisabled();
  },
};
export const NotFound: Story = { name: 'Not found', args: { state: 'not-found' } };
export const ErrorState: Story = { name: 'Error', args: { state: 'error' } };
export const ServerFieldErrors: Story = { name: 'Server field errors', args: { errors: true } };

export const DirtyWithConfirm: Story = {
  name: 'Dirty with confirm',
  args: { dirty: true, confirmOnOpen: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('button', { name: 'Keep editing' })).toBeVisible());
    await expect(body.getByRole('button', { name: 'Discard changes' })).toBeVisible();
  },
};
