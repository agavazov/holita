import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  ListSortMenu,
  PageHeader,
  TablePanel,
  UI_LANGUAGE,
  UrlListState,
  injectDisplayFormat,
  tableView,
  uiMessages,
  type ListDefinition,
  type ListQuery,
  type TableColumn,
} from '@osnova/ui';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { LeadContactSortField, SalesContactsQuery } from '../generated/contacts-operations';
import { leadLabel } from '../leads/lead-record';
import { contactLabel, contactRoleLabels, contactStrings } from './contact-labels';
import { compactPhoneSearch } from './contact-search';
import { ContactsApi } from './contacts-api';

type ContactPage = SalesContactsQuery['salesContacts'];
type ContactRow = ContactPage['items'][number];

const definition: ListDefinition<Record<string, never>, LeadContactSortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'name', field: 'NAME' },
    { param: 'updatedAt', field: 'UPDATED_AT' },
  ],
  defaultSort: { field: 'NAME', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-contacts-page',
  imports: [PageHeader, TablePanel, FilterBuilder, ListSortMenu, TableModule, Tag, RouterLink],
  templateUrl: './contacts-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPage {
  private readonly api = inject(ContactsApi);
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly url = new UrlListState(definition, () => !!this.api.scope());
  protected readonly compactPhoneSearch = compactPhoneSearch;
  protected readonly text = computed(() => contactStrings[this.language()]);
  protected readonly title = computed(() => operatorStrings[this.language()].contacts);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  private readonly roles = computed(() => contactRoleLabels(this.text()));
  protected readonly format = injectDisplayFormat();
  protected readonly leadLabel = leadLabel;
  protected readonly trackByContact = (_index: number, row: ContactRow): string => row.contact.id;
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().contactName,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'role', label: this.text().contactRole, width: '8rem' },
    { id: 'phone', label: this.text().contactPhone, width: '10rem' },
    { id: 'email', label: this.text().contactEmail, width: '13rem' },
    { id: 'primary', label: this.text().contactPrimary, width: '6rem', kind: 'status' },
    {
      id: 'lead',
      label: this.text().contactLead,
      width: '12rem',
      className: 'app-table-merged-column',
    },
    { id: 'updatedAt', label: this.text().contactUpdated, width: '9rem', kind: 'date' },
  ]);
  protected readonly sortFields = computed(() => [
    { field: 'NAME', label: this.text().contactName },
    { field: 'UPDATED_AT', label: this.text().contactUpdated },
  ]);
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => {
    const { field, direction } = this.url.state().sort;
    return { field, direction: direction === 'ASC' ? 'asc' : 'desc' };
  });
  protected readonly list = resource({
    params: () => {
      const scope = this.api.scope();
      const { page, pageSize, search, sort } = this.url.state();
      return scope
        ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize, search, sort } }
        : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.browse(params.scope, params.variables, abortSignal),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<ContactsApi['scope']>; data: ContactPage | undefined },
    ContactPage | null
  >({
    source: () => ({
      scope: this.api.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? (previous?.value ?? null) : null),
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }

  protected label(row: ContactRow): string {
    return contactLabel(row.contact, this.text().unnamedContact);
  }

  protected roleLabel(row: ContactRow): string {
    return this.roles()[row.contact.role];
  }

  protected changeSort({ field, direction }: NonNullable<ListQuery['sort']>): void {
    if (field === 'NAME' || field === 'UPDATED_AT') {
      this.url.setSort(field, direction === 'asc' ? 'ASC' : 'DESC');
    }
  }
}
