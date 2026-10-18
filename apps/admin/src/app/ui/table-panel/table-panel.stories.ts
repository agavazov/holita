import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { onFrame } from '../../../storybook/story-config';
import { TablePanel, type TableNotice } from './table-panel';
import type { TableView } from './table-view';

interface DemoRow {
  readonly id: string;
  readonly plate: string;
  readonly fleetNumber: string;
  readonly model: string;
  readonly status: { readonly label: string; readonly severity: 'success' | 'warn' | 'secondary' };
  readonly odometer: string;
  readonly group: { readonly name: string; readonly slot: string } | null;
}

const rows: readonly DemoRow[] = [
  {
    id: '1',
    plate: 'CB 1001 AX',
    fleetNumber: 'Т-01',
    model: 'MAN TGX 18.510',
    status: { label: 'Активно', severity: 'success' },
    odometer: '412 330',
    group: { name: 'Международни', slot: 'c1' },
  },
  {
    id: '2',
    plate: 'CB 1002 AX',
    fleetNumber: 'Т-02',
    model: 'Volvo FH 500',
    status: { label: 'Активно', severity: 'success' },
    odometer: '388 041',
    group: { name: 'Международни', slot: 'c1' },
  },
  {
    id: '3',
    plate: 'CB 1003 AX',
    fleetNumber: 'Т-03',
    model: 'DAF XF 480',
    status: { label: 'В сервиз', severity: 'warn' },
    odometer: '501 920',
    group: { name: 'Вътрешни', slot: 'c2' },
  },
  {
    id: '4',
    plate: 'CB 1004 AX',
    fleetNumber: 'Т-04',
    model: 'Scania R 450',
    status: { label: 'Активно', severity: 'success' },
    odometer: '97 614',
    group: null,
  },
  {
    id: '5',
    plate: 'CB 1005 AX',
    fleetNumber: 'Б-01',
    model: 'Mercedes-Benz Sprinter',
    status: { label: 'Неактивно', severity: 'secondary' },
    odometer: '0',
    group: { name: 'Градски', slot: 'c3' },
  },
];

/** A story host with a real p-table inside the panel, as list pages use it. */
@Component({
  selector: 'holita-table-panel-demo',
  imports: [TablePanel, TableModule, Tag, ButtonDirective, RouterLink],
  template: `
    <holita-table-panel
      heading="Превозни средства"
      [total]="view().kind === 'rows' || view().kind === 'rows-error' ? 46 : null"
      [view]="view()"
      errorText="Няма връзка с gateway-а. (fixture-AdminFleetVehicles)"
      [busy]="busy()"
      emptyTitle="Все още няма превозни средства"
      emptyDescription="Добавете първото превозно средство на клона."
      [notice]="notice()"
      [selectedCount]="selection().length"
      [selectionProgress]="progress()"
      [page]="{ page: 1, pageSize: 20, total: 46 }"
    >
      <button
        panelActions
        pButton
        type="button"
        size="small"
        severity="secondary"
        [outlined]="true"
      >
        Колони
      </button>
      <a emptyActions pButton [routerLink]="['/', 'bg']">Ново превозно средство</a>
      <button bulkActions pButton type="button" size="small" severity="danger" [outlined]="true">
        Изтрий
      </button>
      <button bulkActions pButton type="button" size="small" severity="secondary" [outlined]="true">
        Деактивирай
      </button>
      <p-table [value]="rows" dataKey="id" [selection]="selection()" [scrollable]="true">
        <ng-template #header>
          <tr>
            <th scope="col" style="inline-size: 3rem">
              <label class="app-visually-hidden" for="select-page"
                >Избери всички на страницата</label
              >
              <p-table-header-checkbox inputId="select-page" />
            </th>
            <th scope="col">Номер</th>
            <th scope="col">Модел</th>
            <th scope="col">Статус</th>
            <th scope="col" class="app-col-secondary">Група</th>
            <th scope="col" class="app-num">Пробег, км</th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td><p-table-checkbox [value]="row" [ariaLabel]="'Избери ' + row.plate" /></td>
            <td>
              <span class="app-cell-stack">
                <a class="app-link" [routerLink]="['/', 'bg']">{{ row.plate }}</a>
                <span>{{ row.fleetNumber }}</span>
              </span>
            </td>
            <td>{{ row.model }}</td>
            <td><p-tag [severity]="row.status.severity" [value]="row.status.label" /></td>
            <td class="app-col-secondary">
              @if (row.group; as group) {
                <span style="display: inline-flex; align-items: center; gap: 0.5rem">
                  <span [class]="'app-dot app-dot--' + group.slot"></span>{{ group.name }}
                </span>
              } @else {
                <span class="app-muted">—</span>
              }
            </td>
            <td class="app-num">{{ row.odometer }}</td>
          </tr>
        </ng-template>
      </p-table>
      <span panelFooter>Σ пробег: 1 399 905 км</span>
    </holita-table-panel>
  `,
})
class TablePanelDemo {
  readonly view = input<TableView>({ kind: 'rows' });
  readonly busy = input(false);
  readonly notice = input<TableNotice | null>(null);
  readonly selection = input<readonly DemoRow[]>([]);
  readonly progress = input<string | null>(null);
  readonly rows = [...rows];
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
export const Busy: Story = { args: { view: { kind: 'rows' }, busy: true } };
export const Empty: Story = { args: { view: { kind: 'empty' } } };
export const NoResults: Story = { name: 'No results', args: { view: { kind: 'no-results' } } };
export const ErrorState: Story = { name: 'Error', args: { view: { kind: 'error' } } };
export const RowsError: Story = { name: 'Rows error', args: { view: { kind: 'rows-error' } } };
export const Notice: Story = {
  args: {
    view: { kind: 'rows' },
    notice: { severity: 'success', text: 'Превозното средство е запазено.' },
  },
};
export const SelectionWithProgress: Story = {
  name: 'Selection with progress',
  args: {
    view: { kind: 'rows' },
    selection: rows.slice(0, 3),
    progress: 'Изтриване: 1 от 3',
  },
};
