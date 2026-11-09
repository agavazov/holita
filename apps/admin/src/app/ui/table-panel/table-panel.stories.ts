import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { onFrame } from '../../../storybook/story-config';
import { injectFleetFormat } from '../format/fleet-format';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
  type ListRecord,
} from '../list/list-actions';
import { RowActions } from '../row-actions/row-actions';
import {
  TablePanel,
  type TableColumn,
  type TableCursorPage,
  type TableMode,
  type TablePage,
} from './table-panel';
import type { TableView } from './table-view';

interface DemoRow {
  readonly id: string;
  readonly plate: string;
  readonly model: string;
  readonly status: { readonly label: string; readonly severity: 'success' | 'warn' | 'secondary' };
  readonly reported: string;
  readonly notes: string;
  readonly odometer: string;
  readonly problems: number;
}

const rows: readonly DemoRow[] = [
  {
    id: '1',
    plate: 'CB 1001 AX',
    model: 'MAN TGX 18.510',
    status: { label: 'Reporting', severity: 'success' },
    reported: '2026-11-06T10:34:00.000Z',
    notes: 'International routes; tachograph calibrated in September.',
    odometer: '412,330',
    problems: 0,
  },
  {
    id: '2',
    plate: 'CB 1002 AX',
    model: 'Volvo FH 500',
    status: { label: 'Connected', severity: 'success' },
    reported: '2026-11-06T10:30:00.000Z',
    notes:
      'Check wheel balance, suspension bushings and the propeller shaft before the next long trip.',
    odometer: '388,041',
    problems: 2,
  },
  {
    id: '3',
    plate: 'CB 1003 AX',
    model: 'DAF XF 480',
    status: { label: 'Reporting gap', severity: 'warn' },
    reported: '2026-11-06T09:20:00.000Z',
    notes: 'Gearbox repair at the Plovdiv workshop.',
    odometer: '501,920',
    problems: 1,
  },
  {
    id: '4',
    plate: 'CB 1004 AX',
    model: 'Scania R 450',
    status: { label: 'Reporting', severity: 'success' },
    reported: '2026-11-06T10:33:00.000Z',
    notes: '',
    odometer: '97,614',
    problems: 0,
  },
  {
    id: '5',
    plate: 'CB 1005 AX',
    model: 'Mercedes-Benz Sprinter',
    status: { label: 'Disconnected', severity: 'secondary' },
    reported: '2026-11-05T16:22:00.000Z',
    notes: 'Retired from the city fleet; waiting for sale.',
    odometer: '0',
    problems: 0,
  },
];

const columns: readonly TableColumn[] = [
  {
    id: 'identity',
    label: 'Vehicle',
    width: '15rem',
    kind: 'identity',
    className: 'app-col-identity',
  },
  { id: 'status', label: 'Connection', width: '11rem', kind: 'status' },
  { id: 'reported', label: 'Last report', width: '12rem', kind: 'date' },
  { id: 'problems', label: 'Problems', width: '9rem', kind: 'problems' },
  { id: 'notes', label: 'Notes', width: '16rem', className: 'app-col-secondary' },
  { id: 'odometer', label: 'Odometer, km', width: '10rem', kind: 'number', className: 'app-num' },
  {
    id: 'actions',
    label: 'Actions',
    width: '3.25rem',
    kind: 'actions',
    className: 'app-col-actions',
  },
];

type DemoAction = 'view' | 'deactivate' | 'delete';
const actions: readonly ListAction<DemoAction, DemoRow>[] = [
  { id: 'view', label: 'View vehicle' },
  {
    id: 'deactivate',
    label: 'Deactivate',
    bulk: true,
    appliesTo: (row) => row.status.label !== 'Disconnected',
    confirm: {
      title: 'Deactivate vehicles?',
      detail: 'They stay in reports and can be activated again.',
      accept: 'Deactivate',
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    bulk: true,
    danger: true,
    confirm: { title: 'Delete vehicles?', accept: 'Delete' },
  },
];

function recordOf(row: DemoRow): ListRecord<DemoAction> {
  return listRecord(actions, row, row.id, row.plate);
}

/** Same projected cells and declared widths for offset, cursor and finite snapshots. */
@Component({
  selector: 'discocan-table-panel-demo',
  imports: [TablePanel, TableModule, Tag, ButtonDirective, RowActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <discocan-table-panel
      #panel
      heading="Vehicles"
      [total]="view().kind === 'empty' ? 0 : mode() === 'local' ? rows.length : 46"
      [view]="view()"
      errorText="The list could not be loaded. Try again."
      [busy]="busy()"
      emptyTitle="No vehicles yet"
      emptyDescription="Add the first vehicle of this fleet."
      [actions]="actions"
      [selection]="records()"
      [selectionProgress]="progress()"
      [mode]="mode()"
      [page]="mode() === 'offset' ? page() : null"
      [pageSizes]="[5, 10, 20]"
      [cursorPage]="mode() === 'cursor' ? cursorPage() : null"
      [columns]="columns"
      tableMinWidth="76.25rem"
      [skeletonRows]="5"
      (pageChange)="paging.set($event)"
      (cursorChange)="changeCursor($event)"
      (action)="requested.set($event)"
    >
      <button emptyActions pButton type="button">New vehicle</button>
      <p-table
        class="app-responsive-table"
        [value]="shownRows()"
        dataKey="id"
        [rowTrackBy]="trackById"
        [selection]="selection()"
        [scrollable]="true"
        [lazy]="mode() === 'offset'"
        [lazyLoadOnInit]="false"
        [tableStyle]="{ 'min-width': 'var(--app-table-responsive-min-width)' }"
      >
        <ng-template #colgroup>
          <colgroup>
            @for (column of columns; track column.id) {
              <col
                [style.width]="
                  column.className === 'app-col-identity'
                    ? 'var(--app-table-identity-width, ' + column.width + ')'
                    : column.width
                "
                [class]="column.className ?? ''"
              />
            }
          </colgroup>
        </ng-template>
        <ng-template #header>
          <tr>
            @for (column of columns; track column.id) {
              @if (column.kind === 'actions') {
                <th scope="col" class="app-col-actions" pFrozenColumn alignFrozen="right">
                  <span class="app-visually-hidden">{{ column.label }}</span>
                </th>
              } @else {
                <th scope="col" [class]="column.className ?? ''">{{ column.label }}</th>
              }
            }
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td class="app-col-identity">
              <span class="app-cell-identity">
                <button
                  type="button"
                  class="app-link"
                  [attr.aria-label]="'View ' + row.plate"
                  (click)="panel.run('view', [recordOf(row)], $event.currentTarget)"
                >
                  <span class="app-plate">{{ row.plate }}</span>
                </button>
                <span [title]="row.model">{{ row.model }}</span>
              </span>
              <div class="app-table-mobile-actions">
                <discocan-row-actions
                  [actions]="actions"
                  [record]="recordOf(row)"
                  (choose)="panel.run($event.action, [recordOf(row)], $event.origin)"
                />
              </div>
            </td>
            <td>
              <span class="app-cell-status"
                ><p-tag [severity]="row.status.severity" [value]="row.status.label"
              /></span>
            </td>
            <td>
              <time class="app-cell-date" [title]="format.dateTimeCell(row.reported).title">{{
                format.dateTimeCell(row.reported).text
              }}</time>
            </td>
            <td>
              <span class="app-cell-problems">
                <p-tag
                  [severity]="row.problems ? 'warn' : 'secondary'"
                  [value]="'' + row.problems"
                />
                @if (row.problems) {
                  <button
                    type="button"
                    class="app-link"
                    (click)="panel.run('view', [recordOf(row)], $event.currentTarget)"
                  >
                    View
                  </button>
                }
              </span>
            </td>
            <td class="app-col-secondary">
              <span class="app-cell-truncate" [title]="row.notes">{{ row.notes || '—' }}</span>
            </td>
            <td class="app-num">
              <span class="app-cell-number">{{ row.odometer }}</span>
            </td>
            <td class="app-col-actions" pFrozenColumn alignFrozen="right">
              <discocan-row-actions
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
          Requested: {{ request.action }} {{ request.ids.join(', ') }}
        } @else {
          {{
            mode() === 'cursor'
              ? 'History · total unknown'
              : mode() === 'local'
                ? 'Finite snapshot'
                : 'Whole fleet'
          }}
        }
      </span>
    </discocan-table-panel>
  `,
})
class TablePanelDemo {
  protected readonly format = injectFleetFormat();
  readonly mode = input<TableMode>('offset');
  readonly view = input<TableView>({ kind: 'rows' });
  readonly busy = input(false);
  readonly selection = input<readonly DemoRow[]>([]);
  readonly progress = input<string | null>(null);
  readonly rows = rows;
  readonly columns = columns;
  readonly actions = actions;
  readonly trackById = trackById;
  readonly recordOf = recordOf;
  readonly requested = signal<ListActionRequest<DemoAction> | null>(null);
  readonly records = computed(() => this.selection().map(recordOf));
  readonly paging = signal({ page: 1, pageSize: 5 });
  readonly cursorStack = signal<readonly number[]>([0]);
  readonly page = computed<TablePage>(() => ({ ...this.paging(), total: 46 }));
  readonly cursorPage = computed<TableCursorPage>(() => ({
    page: this.cursorStack().length,
    hasPrevious: this.cursorStack().length > 1,
    hasNext: this.cursorStack().length < 3,
  }));
  readonly shownRows = computed(() => {
    const page = this.mode() === 'cursor' ? this.cursorStack().length : this.paging().page;
    return this.mode() === 'local'
      ? [...rows]
      : rows.map((row) => ({
          ...row,
          id: `${String(page)}-${row.id}`,
          plate: row.plate.replace('100', `${String(page)}00`),
        }));
  });

  changeCursor(direction: 'previous' | 'next'): void {
    this.cursorStack.update((stack) =>
      direction === 'previous' ? stack.slice(0, -1) : [...stack, stack.length],
    );
  }
}

const meta: Meta<TablePanelDemo> = {
  title: 'Design System/Tables',
  component: TablePanelDemo,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<TablePanelDemo>;

export const Offset: Story = {};
export const Cursor: Story = { args: { mode: 'cursor' } };
export const Local: Story = { args: { mode: 'local' } };
export const FirstLoad: Story = { args: { view: { kind: 'loading' } } };
export const Refreshing: Story = { args: { busy: true } };
export const Empty: Story = { args: { view: { kind: 'empty' } } };
export const FilteredEmpty: Story = { args: { view: { kind: 'no-results' } } };
export const ErrorState: Story = { name: 'Error', args: { view: { kind: 'error' } } };
export const Stale: Story = { args: { view: { kind: 'rows-error' } } };
export const CursorFirstLoad: Story = { args: { mode: 'cursor', view: { kind: 'loading' } } };
export const CursorRefreshing: Story = { args: { mode: 'cursor', busy: true } };
export const CursorEmpty: Story = { args: { mode: 'cursor', view: { kind: 'empty' } } };
export const CursorFilteredEmpty: Story = {
  args: { mode: 'cursor', view: { kind: 'no-results' } },
};
export const CursorError: Story = { args: { mode: 'cursor', view: { kind: 'error' } } };
export const CursorStale: Story = { args: { mode: 'cursor', view: { kind: 'rows-error' } } };
export const LocalFirstLoad: Story = { args: { mode: 'local', view: { kind: 'loading' } } };
export const LocalRefreshing: Story = { args: { mode: 'local', busy: true } };
export const LocalEmpty: Story = { args: { mode: 'local', view: { kind: 'empty' } } };
export const LocalFilteredEmpty: Story = { args: { mode: 'local', view: { kind: 'no-results' } } };
export const LocalError: Story = { args: { mode: 'local', view: { kind: 'error' } } };
export const LocalStale: Story = { args: { mode: 'local', view: { kind: 'rows-error' } } };
export const Mobile: Story = { globals: { viewport: { value: 'mobile375', isRotated: false } } };
export const SelectionWithProgress: Story = {
  args: { selection: rows.slice(0, 3), progress: 'Deleting: 1 of 3' },
};
