import { Component, computed, input, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../storybook/interactions';
import { onFrame } from '../../../storybook/story-config';
import {
  type ListAction,
  type ListActionRequest,
  type ListRecord,
  listRecord,
  trackById,
} from '../list/list-actions';
import { RowActions } from '../row-actions/row-actions';
import { TablePanel, type TableNotice, type TablePage } from './table-panel';
import type { TableView } from './table-view';

interface DemoRow {
  readonly id: string;
  readonly plate: string;
  readonly fleetNumber: string;
  readonly model: string;
  readonly status: { readonly label: string; readonly severity: 'success' | 'warn' | 'secondary' };
  readonly notes: string;
  readonly odometer: string;
}

const rows: readonly DemoRow[] = [
  {
    id: '1',
    plate: 'CB 1001 AX',
    fleetNumber: 'T-01',
    model: 'MAN TGX 18.510',
    status: { label: 'Active', severity: 'success' },
    notes: 'International routes; tachograph calibrated in September.',
    odometer: '412,330',
  },
  {
    id: '2',
    plate: 'CB 1002 AX',
    fleetNumber: 'T-02',
    model: 'Volvo FH 500',
    status: { label: 'Active', severity: 'success' },
    notes:
      'Driver reports vibration above 90 km/h. Check wheel balance, suspension bushings and the propeller shaft before the next long trip to Thessaloniki.',
    odometer: '388,041',
  },
  {
    id: '3',
    plate: 'CB 1003 AX',
    fleetNumber: 'T-03',
    model: 'DAF XF 480',
    status: { label: 'In service', severity: 'warn' },
    notes: 'Gearbox repair at the Plovdiv workshop.',
    odometer: '501,920',
  },
  {
    id: '4',
    plate: 'CB 1004 AX',
    fleetNumber: 'T-04',
    model: 'Scania R 450',
    status: { label: 'Active', severity: 'success' },
    notes: '',
    odometer: '97,614',
  },
  {
    id: '5',
    plate: 'CB 1005 AX',
    fleetNumber: 'V-01',
    model: 'Mercedes-Benz Sprinter',
    status: { label: 'Inactive', severity: 'secondary' },
    notes: 'Retired from the city fleet; waiting for sale.',
    odometer: '0',
  },
];

type DemoAction = 'edit' | 'duplicate' | 'deactivate' | 'delete';

/** One definition for the row menu and the bulk bar; Deactivate applies to active vehicles only. */
const actions: readonly ListAction<DemoAction, DemoRow>[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'duplicate', label: 'Duplicate' },
  {
    id: 'deactivate',
    label: 'Deactivate',
    bulk: true,
    appliesTo: (row) => row.status.label !== 'Inactive',
    confirm: {
      one: 'Deactivate {name}?',
      many: 'Deactivate {count} vehicles?',
      detail: 'They stay in reports and can be activated again.',
      accept: 'Deactivate',
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    bulk: true,
    danger: true,
    confirm: {
      one: 'Delete {name}?',
      many: 'Delete {count} vehicles?',
      detail: 'Their trips and history stay in reports.',
      accept: 'Delete',
    },
  },
];

function recordOf(row: DemoRow): ListRecord<DemoAction> {
  return listRecord(actions, row, row.id, row.plate);
}

/** A story host with a real p-table inside the panel, as list pages use it. */
@Component({
  selector: 'holita-table-panel-demo',
  imports: [TablePanel, TableModule, Tag, ButtonDirective, RowActions],
  template: `
    <holita-table-panel
      #panel
      heading="Vehicles"
      [total]="view().kind === 'rows' || view().kind === 'rows-error' ? page().total : null"
      [view]="view()"
      errorText="The gateway is not reachable. (fixture-AdminFleetVehicles)"
      [busy]="busy()"
      emptyTitle="No vehicles yet"
      emptyDescription="Add the first vehicle of this branch."
      [notice]="notice()"
      [actions]="actions"
      [selection]="records()"
      [selectionProgress]="progress()"
      [page]="page()"
      (action)="requested.set($event)"
    >
      <button
        panelActions
        pButton
        type="button"
        size="small"
        severity="secondary"
        [outlined]="true"
      >
        Columns
      </button>
      <button emptyActions pButton type="button">New vehicle</button>
      <p-table
        [value]="shownRows()"
        dataKey="id"
        [rowTrackBy]="trackById"
        [selection]="selection()"
        [scrollable]="true"
      >
        <ng-template #header>
          <tr>
            <th scope="col" class="app-col-check">
              <label class="app-visually-hidden" for="select-page">Select all on this page</label>
              <p-table-header-checkbox inputId="select-page" />
            </th>
            <th scope="col">Plate</th>
            <th scope="col">Model</th>
            <th scope="col">Status</th>
            <th scope="col" class="app-col-secondary">Notes</th>
            <th scope="col" class="app-num">Odometer, km</th>
            <th scope="col" class="app-col-actions">
              <span class="app-visually-hidden">Actions</span>
            </th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td><p-table-checkbox [value]="row" [ariaLabel]="'Select ' + row.plate" /></td>
            <td>
              <span class="app-cell-stack">
                <button
                  type="button"
                  class="app-link"
                  [attr.aria-label]="'Edit ' + row.plate"
                  (click)="panel.run('edit', [recordOf(row)], $event.currentTarget)"
                >
                  {{ row.plate }}
                </button>
                <span>{{ row.fleetNumber }}</span>
              </span>
            </td>
            <td>{{ row.model }}</td>
            <td><p-tag [severity]="row.status.severity" [value]="row.status.label" /></td>
            <td class="app-col-secondary">
              @if (row.notes) {
                <span class="app-cell-truncate" [title]="row.notes">{{ row.notes }}</span>
              } @else {
                <span class="app-muted">—</span>
              }
            </td>
            <td class="app-num">{{ row.odometer }}</td>
            <td class="app-col-actions">
              <holita-row-actions
                [actions]="actions"
                [record]="recordOf(row)"
                (choose)="panel.run($event.action, [recordOf(row)], $event.origin)"
              />
            </td>
          </tr>
        </ng-template>
      </p-table>
      <span panelFooter>
        @if (requested(); as request) {
          Last request: {{ request.action }} {{ request.ids.join(', ') }}
        } @else {
          Total distance: 1,399,905 km
        }
      </span>
    </holita-table-panel>
  `,
})
class TablePanelDemo {
  readonly view = input<TableView>({ kind: 'rows' });
  readonly busy = input(false);
  readonly notice = input<TableNotice | null>(null);
  readonly selection = input<readonly DemoRow[]>([]);
  readonly progress = input<string | null>(null);
  /** The list total: 46 pages through the rows, 5 fits on one page. */
  readonly total = input(46);
  readonly pageSize = input(20);
  readonly actions = actions;
  readonly trackById = trackById;
  readonly recordOf = recordOf;
  readonly requested = signal<ListActionRequest<DemoAction> | null>(null);
  readonly records = computed(() => this.selection().map(recordOf));
  readonly page = computed<TablePage>(() => ({
    page: 1,
    pageSize: this.pageSize(),
    total: this.total(),
  }));
  readonly shownRows = computed(() => rows.slice(0, Math.min(rows.length, this.total())));
}

const meta: Meta<TablePanelDemo> = {
  title: 'Design System/Patterns/TablePanel',
  component: TablePanelDemo,
  decorators: [onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<TablePanelDemo>;

export const Loading: Story = { args: { view: { kind: 'loading' } } };
export const Rows: Story = { args: { view: { kind: 'rows' } } };

/** Everything fits on one page: the range and the page size stay, the page links go. */
export const SinglePage: Story = {
  name: 'Single page',
  args: { view: { kind: 'rows' }, total: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1–5 of 5')).toBeVisible();
    await expect(canvasElement.querySelector('.p-paginator-pages')).toBeNull();
    await expect(canvasElement.querySelector('.p-paginator-rpp-dropdown')).not.toBeNull();
  },
};

/** A larger page size than the list: it can still be changed back. */
export const LargePageSize: Story = {
  name: 'Large page size',
  args: { view: { kind: 'rows' }, total: 46, pageSize: 100 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.p-paginator-rpp-dropdown')).not.toBeNull();
    await expect(canvasElement.querySelector('.p-paginator-pages')).toBeNull();
  },
};

/** A size outside the offered ones (e.g. from an old link) is added to them, so it shows. */
export const UnlistedPageSize: Story = {
  name: 'Unlisted page size',
  args: { view: { kind: 'rows' }, total: 46, pageSize: 25 },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('.p-paginator-rpp-dropdown')).toHaveTextContent('25'),
    );
  },
};

export const Busy: Story = { args: { view: { kind: 'rows' }, busy: true } };

/** No rows: no footer and no paging. */
export const Empty: Story = {
  args: { view: { kind: 'empty' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/of 46/)).toBeNull();
  },
};

export const NoResults: Story = {
  name: 'No results',
  args: { view: { kind: 'no-results' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/of 46/)).toBeNull();
  },
};

export const ErrorState: Story = { name: 'Error', args: { view: { kind: 'error' } } };
export const RowsError: Story = { name: 'Rows error', args: { view: { kind: 'rows-error' } } };

export const Notice: Story = {
  args: {
    view: { kind: 'rows' },
    notice: { severity: 'success', text: 'The vehicle was saved.' },
  },
};

/** The bulk bar floats over the bottom of the list; the rows and footer do not move. */
export const SelectionWithProgress: Story = {
  name: 'Selection with progress',
  args: {
    view: { kind: 'rows' },
    selection: rows.slice(0, 3),
    progress: 'Deleting: 1 of 3',
  },
};

/** The row menu: Deactivate is disabled for the inactive vehicle. */
export const RowActionsOpen: Story = {
  name: 'Row actions open',
  args: { view: { kind: 'rows' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for CB 1005 AX' }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Delete' })).toBeVisible());
    await expect(body.getByRole('menuitem', { name: 'Deactivate' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

/**
 * A row's Delete names the record in the question and describes it with the detail; Cancel
 * returns the focus to its "⋮".
 */
export const ConfirmFromRow: Story = {
  name: 'Confirm from a row',
  args: { view: { kind: 'rows' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions for CB 1002 AX' });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const dialog = await body.findByRole('alertdialog', { name: 'Delete CB 1002 AX?' });
    await waitFor(() =>
      expect(dialog).toHaveAccessibleDescription(/Their trips and history stay in reports\./),
    );
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus(),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/**
 * The bulk bar runs the same actions: the question counts the records it applies to, lists them
 * and says how many selected records it leaves unchanged, all part of the dialog's description.
 */
export const ConfirmSelection: Story = {
  name: 'Confirm a selection',
  args: { view: { kind: 'rows' }, selection: rows.slice(2, 5) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole('region', { name: 'Actions for selected records' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Deactivate' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Deactivate 2 vehicles?' });
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    // The dialog fades in: wait until its content is shown.
    await waitFor(() =>
      expect(
        within(dialog).getByText('Selected records it does not apply to are left unchanged: 1.'),
      ).toBeVisible(),
    );
    await expect(dialog).toHaveAccessibleDescription(/left unchanged: 1\./);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(canvas.getByText('Last request: deactivate 3, 4')).toBeVisible());
  },
};
