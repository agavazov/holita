import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { AdminUserDetailsFragment } from '../../../generated/graphql/operations';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { interpolate } from '../../ui/i18n/messages';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
  type ListRecord,
} from '../../ui/list/list-actions';
import { PageHeader } from '../../ui/page-header/page-header';
import { injectSortReady, listQuery, type ListQuery } from '../../ui/list/list-query';
import { ListSortMenu } from '../../ui/list/list-sort-menu';
import { RowActions } from '../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn } from '../../ui/table-panel/table-panel';
import type { TableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { usersText } from './i18n/messages';

export type UserActionId = 'edit' | 'deactivate' | 'reactivate';

@Component({
  selector: 'discocan-users-view',
  imports: [ButtonDirective, TableModule, Tag, PageHeader, RowActions, TablePanel, ListSortMenu],
  templateUrl: './users-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class UsersView {
  readonly rows = input.required<readonly AdminUserDetailsFragment[]>();
  readonly view = input.required<TableView>();
  readonly busy = input(false);
  readonly canManage = input(false);
  readonly errorText = input<string | null>(null);
  readonly actionContext = input<unknown>(null);
  readonly create = output();
  readonly action = output<ListActionRequest<UserActionId>>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => usersText(this.language()));
  protected readonly format = injectFleetFormat();
  protected readonly severity = toneSeverity;
  protected readonly trackById = trackById;
  protected readonly state = signal<ListQuery>({
    search: '',
    conditions: [],
    sort: { field: 'name', direction: 'asc' },
    page: 1,
    pageSize: 20,
  });
  private readonly sortReady = injectSortReady();
  protected readonly page = computed(() => ({
    page: this.state().page,
    pageSize: this.state().pageSize,
    total: this.rows().length,
  }));
  protected readonly sortFields = computed(() =>
    this.columns()
      .filter((column) => column.kind !== 'actions')
      .map((column) => ({ field: column.id, label: column.label })),
  );
  protected readonly tableRows = computed(() => {
    const state = this.state();
    const rows = [...this.rows()].sort((left, right) => {
      const field = state.sort?.field;
      if (field === 'lastSignIn' && (!left.lastSignInAt || !right.lastSignInAt)) {
        if (left.lastSignInAt !== right.lastSignInAt) {
          return left.lastSignInAt ? -1 : 1;
        }
      }
      const compared =
        field === 'email'
          ? left.email.localeCompare(right.email, this.language())
          : field === 'role'
            ? this.roleLabel(left).localeCompare(this.roleLabel(right), this.language())
            : field === 'status'
              ? Number(left.active) - Number(right.active)
              : field === 'lastSignIn'
                ? (left.lastSignInAt ? Date.parse(left.lastSignInAt) : 0) -
                  (right.lastSignInAt ? Date.parse(right.lastSignInAt) : 0)
                : left.name.localeCompare(right.name, this.language());
      return (
        (state.sort?.direction === 'asc' ? compared : -compared) || left.id.localeCompare(right.id)
      );
    });
    const start = (state.page - 1) * state.pageSize;
    return rows.slice(start, start + state.pageSize);
  });
  protected readonly tableMinWidth = '69.25rem';
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().name,
      width: '16rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'email', label: this.text().email, width: '20rem', kind: 'text' },
    { id: 'role', label: this.text().role, width: '11rem', kind: 'text' },
    { id: 'status', label: this.text().status, width: '8rem', kind: 'status' },
    {
      id: 'lastSignIn',
      label: this.text().lastSignIn,
      width: '11rem',
      kind: 'date',
      className: 'app-col-secondary',
    },
    {
      id: 'actions',
      label: this.text().actionsColumn,
      width: '3.25rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly actions = computed<
    readonly ListAction<UserActionId, AdminUserDetailsFragment>[]
  >(() => {
    if (!this.canManage()) {
      return [];
    }
    const text = this.text().actions;
    return [
      { id: 'edit', label: text.edit },
      {
        id: 'reactivate',
        label: text.reactivate,
        confirm: text.confirmReactivate,
        appliesTo: (user) => !user.active,
      },
      {
        id: 'deactivate',
        label: text.deactivate,
        danger: true,
        confirm: text.confirmDeactivate,
        appliesTo: (user) => user.active,
      },
    ];
  });
  private readonly records = computed(
    () => new Map(this.rows().map((row) => [row.id, this.toRecord(row)])),
  );

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

  protected roleLabel(row: AdminUserDetailsFragment): string {
    return this.text().roles[row.role];
  }

  protected editLabel(row: AdminUserDetailsFragment): string {
    return interpolate(this.text().editLabel, { name: row.name });
  }

  protected recordOf(row: AdminUserDetailsFragment): ListRecord<UserActionId> {
    return this.records().get(row.id) ?? this.toRecord(row);
  }

  private toRecord(row: AdminUserDetailsFragment): ListRecord<UserActionId> {
    return listRecord(this.actions(), row, row.id, `${row.name} (${row.email})`);
  }
}
