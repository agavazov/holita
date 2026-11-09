import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { Microchip } from '@primeicons/angular/microchip';
import { Send } from '@primeicons/angular/send';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import type { FilterCondition } from '../../ui/filter-builder/filter-model';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../ui/list/list-actions';
import { injectSortReady, listQuery, type ListQuery } from '../../ui/list/list-query';
import { ListSortMenu } from '../../ui/list/list-sort-menu';
import { maxSearchLength } from '../../ui/list/list-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { RowActions } from '../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { notificationsText } from './i18n/messages';
import { notificationTone, type NotificationRow } from './notification-presentation';

@Component({
  selector: 'discocan-notifications-view',
  imports: [
    RouterLink,
    FormsModule,
    ExclamationTriangle,
    Microchip,
    Send,
    InputText,
    ListSortMenu,
    Message,
    Select,
    TableModule,
    Tag,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    PageHeader,
    RowActions,
    TablePanel,
  ],
  templateUrl: './notifications-view.html',
  styleUrl: './notifications-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class NotificationsView {
  readonly rows = input.required<readonly NotificationRow[]>();
  readonly total = input.required<number>();
  readonly unreadCount = input.required<number>();
  readonly loading = input(false);
  readonly errorText = input<string | null>(null);
  readonly searchError = input<string | null>(null);
  readonly busy = input(false);
  readonly readAllowed = input(false);
  readonly state = input.required<ListQuery>();
  readonly stateChange = output<ListQuery>();
  readonly markRead = output<string>();
  readonly markAllRead = output();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly router = inject(Router);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => notificationsText(this.language()));
  protected readonly format = injectFleetFormat();
  protected readonly trackById = trackById;
  protected readonly maxSearchLength = maxSearchLength;
  protected readonly sortFields = computed(() => [
    { field: 'occurredAt', label: this.text().table.occurred },
  ]);
  protected readonly tableMinWidth = '91.25rem';
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.errorText(),
      rows: this.rows().length,
      filtered: listQuery.filtered(this.state()),
    }),
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'notification',
      label: this.text().table.notification,
      width: '27rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'category', label: this.text().category, width: '10rem', kind: 'status' },
    {
      id: 'source',
      label: this.text().table.source,
      width: '16rem',
      kind: 'identity',
      className: 'app-col-secondary',
    },
    { id: 'target', label: this.text().table.target, width: '14rem' },
    { id: 'occurred', label: this.text().table.occurred, width: '13rem', kind: 'date' },
    { id: 'readState', label: this.text().readState, width: '8rem', kind: 'status' },
    {
      id: 'actions',
      label: this.text().table.actions,
      width: '3.25rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly readOptions = computed(() => [
    { value: 'ALL', label: this.text().all },
    { value: 'UNREAD', label: this.text().unread },
  ]);
  protected readonly categoryOptions = computed(() => [
    { value: 'ALL', label: this.text().allCategories },
    ...Object.entries(this.text().categories).map(([value, label]) => ({ value, label })),
  ]);
  protected readonly readState = computed(() =>
    this.state().conditions.some(
      (condition) => condition.field === 'readState' && condition.values.includes('UNREAD'),
    )
      ? 'UNREAD'
      : 'ALL',
  );
  protected readonly category = computed(
    () =>
      this.state().conditions.find((condition) => condition.field === 'category')?.values[0] ??
      'ALL',
  );
  protected readonly actions = computed<readonly ListAction<'mark-read', NotificationRow>[]>(() => [
    {
      id: 'mark-read',
      label: this.text().markRead,
      appliesTo: (row) => row.unread && this.readAllowed() && !this.busy(),
    },
  ]);
  protected readonly tableRows = computed(() =>
    this.rows().map((row) => ({
      ...row,
      date: this.format.dateTimeCell(row.occurredAt),
      tone: notificationTone(row.severity),
      sourceUrl: row.sourceLink ? this.router.parseUrl(row.sourceLink.url) : null,
      links: row.links.map((link) => ({ ...link, route: this.router.parseUrl(link.url) })),
      record: listRecord(this.actions(), row, row.id, row.sentence),
    })),
  );
  protected readonly page = computed(() => ({
    page: this.state().page,
    pageSize: this.state().pageSize,
    total: this.total(),
  }));

  protected categoryLabel(category: NotificationRow['category']): string {
    return this.text().categories[category];
  }

  protected sourceLabel(sourceKind: NotificationRow['sourceKind']): string {
    return this.text().sources[sourceKind];
  }

  protected severityLabel(severity: NotificationRow['severity']): string {
    return this.text().severities[severity];
  }

  protected inputSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.stateChange.emit(listQuery.search(this.state(), event.target.value));
    }
  }

  protected changeFilter(field: 'readState' | 'category', value: unknown): void {
    if (typeof value !== 'string') {
      return;
    }
    const conditions: FilterCondition[] = this.state().conditions.filter(
      (condition) => condition.field !== field,
    );
    if (value !== 'ALL') {
      conditions.push({ id: field, field, operator: 'isAnyOf', values: [value] });
    }
    this.stateChange.emit(listQuery.conditions(this.state(), conditions));
  }

  protected changePage(page: { page: number; pageSize: number }): void {
    this.stateChange.emit(listQuery.page(this.state(), page));
  }

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    this.stateChange.emit({ ...this.state(), sort, page: 1 });
  }

  protected sort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) {
      return;
    }
    const next = listQuery.sorted(this.state(), event);
    if (next) {
      this.stateChange.emit(next);
    }
  }

  protected clearFilters(): void {
    this.stateChange.emit(listQuery.cleared(this.state()));
  }

  protected run(event: ListActionRequest<'mark-read'>): void {
    const id = event.ids[0];
    if (id) {
      this.markRead.emit(id);
    }
  }
}
