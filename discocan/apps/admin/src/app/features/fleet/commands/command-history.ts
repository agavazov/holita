import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { Language } from '../../../i18n/messages';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../../ui/list/list-actions';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { injectSortReady, listQuery, type ListQuery } from '../../../ui/list/list-query';
import { ListSortMenu } from '../../../ui/list/list-sort-menu';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import {
  commandOutcome,
  commandPurpose,
  commandSeverity,
  commandState,
  commandText,
  type CommandRequest,
} from './command-presentation';

@Component({
  selector: 'discocan-command-history',
  imports: [ButtonDirective, RouterLink, TableModule, Tag, TablePanel, RowActions, ListSortMenu],
  templateUrl: './command-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class CommandHistory {
  readonly requests = input.required<readonly CommandRequest[]>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** With both, links to the device's complete history in the Branch command queue. */
  readonly branchId = input<string | null>(null);
  readonly deviceId = input<string | null>(null);
  readonly inspect = output<CommandRequest>();
  readonly retry = output();
  protected readonly text = computed(() => commandText[this.language()]);
  protected readonly format = injectFleetFormat();
  protected readonly trackById = trackById;
  protected readonly tableMinWidth = '69rem';
  protected readonly fullHistoryLink = computed(() => {
    const branchId = this.branchId();
    return branchId && this.deviceId()
      ? ['/', this.language(), branchId, 'fleet', 'command-queue']
      : null;
  });
  protected readonly state = signal<ListQuery>({
    search: '',
    conditions: [],
    sort: { field: 'requested', direction: 'desc' },
    page: 1,
    pageSize: 20,
  });
  private readonly sortReady = injectSortReady();
  protected readonly page = computed(() => ({
    page: this.state().page,
    pageSize: this.state().pageSize,
    total: this.requests().length,
  }));
  protected readonly sortFields = computed(() =>
    this.columns()
      .filter((column) => column.kind !== 'actions' && column.id !== 'target')
      .map((column) => ({ field: column.id, label: column.label })),
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'purpose',
      label: this.text().purpose,
      width: '18rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'target', label: this.text().target, width: '12rem' },
    { id: 'requested', label: this.text().requested, width: '11rem', kind: 'date' },
    { id: 'status', label: this.text().status, width: '12rem', kind: 'status' },
    { id: 'outcome', label: this.text().outcome, width: '12rem', className: 'app-col-secondary' },
    {
      id: 'actions',
      label: this.text().actions,
      width: '4rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly actions = computed<readonly ListAction<'details', CommandRequest>[]>(() => [
    { id: 'details', label: this.text().details },
  ]);
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.requests().length,
      filtered: false,
    }),
  );
  protected readonly rows = computed(() => {
    const state = this.state();
    const rows = this.requests().map((request) => ({
      id: request.id,
      request,
      purpose: commandPurpose(request, this.language()),
      requested: this.format.dateTimeCell(request.requestedAt),
      status: this.text().states[commandState(request)],
      severity: commandSeverity(request),
      outcome: commandOutcome(request, this.language()),
      record: listRecord(
        this.actions(),
        request,
        request.id,
        commandPurpose(request, this.language()),
      ),
    }));
    rows.sort((left, right) => {
      const field = state.sort?.field;
      const compared =
        field === 'purpose'
          ? left.purpose.localeCompare(right.purpose, this.language())
          : field === 'status'
            ? left.status.localeCompare(right.status, this.language())
            : field === 'outcome'
              ? left.outcome.localeCompare(right.outcome, this.language())
              : Date.parse(left.request.requestedAt) - Date.parse(right.request.requestedAt);
      return (
        (state.sort?.direction === 'asc' ? compared : -compared) || left.id.localeCompare(right.id)
      );
    });
    const start = (state.page - 1) * state.pageSize;
    return rows.slice(start, start + state.pageSize);
  });

  protected changePage(page: { page: number; pageSize: number }): void {
    this.state.update((state) => listQuery.page(state, page));
  }

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    this.state.update((state) => ({ ...state, sort, page: 1 }));
  }

  protected sort(event: TableLazyLoadEvent): void {
    if (this.sortReady()) {
      const next = listQuery.sorted(this.state(), event);
      if (next) {
        this.state.set(next);
      }
    }
  }

  protected run(event: ListActionRequest<'details'>): void {
    const request = this.requests().find((row) => row.id === event.ids[0]);
    if (request) {
      this.inspect.emit(request);
    }
  }
}
