import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  FormatDateOnlyPipe,
  FormatDateTimePipe,
  PageHeader,
  TablePanel,
  UI_LANGUAGE,
  UrlListState,
  codecs,
  tableView,
  uiMessages,
  type DrawerHost,
  type ListDefinition,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { SalesOfferSummaryFragment, SalesOffersQuery } from '../generated/offers-operations';
import {
  offerLabel,
  offerPrice,
  offerStatusKeys,
  offerStatusLabel,
  offerStatusSeverity,
  offerStatuses,
  offerStrings,
  quoteKinds,
} from './offer';
import { OffersApi } from './offers-api';

const statusKeys = Object.values(offerStatusKeys);
type OfferFilters = { status: (typeof statusKeys)[number] | 'all'; expires: 'any' | 'within7Days' };
const definition: ListDefinition<OfferFilters, 'UPDATED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'UPDATED_AT', direction: 'DESC' },
  filters: {
    status: codecs.choice(['all', ...statusKeys], 'all'),
    expires: codecs.choice(['any', 'within7Days'], 'any'),
  },
};

@Component({
  selector: 'holita-offers-page',
  imports: [
    PageHeader,
    TablePanel,
    FilterBuilder,
    FormatDateOnlyPipe,
    FormatDateTimePipe,
    FormsModule,
    RouterLink,
    RouterOutlet,
    Select,
    TableModule,
    Tag,
  ],
  templateUrl: './offers-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffersPage {
  private readonly api = inject(OffersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => offerStrings[this.language()]);
  protected readonly title = computed(() => operatorStrings[this.language()].offers);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly label = offerLabel;
  protected readonly price = offerPrice;
  protected readonly statusLabel = offerStatusLabel;
  protected readonly statusSeverity = offerStatusSeverity;
  protected readonly quoteKinds = quoteKinds;
  protected readonly trackByOffer = (_index: number, row: SalesOfferSummaryFragment) => row.id;
  protected readonly detailOpen = computed(() => {
    this.router.lastSuccessfulNavigation();
    return this.route.firstChild?.snapshot.paramMap.has('recordId') ?? false;
  });
  protected readonly url = new UrlListState(definition, () => !!this.api.scope());
  protected readonly statusOptions = computed(() => [
    { label: this.text().allStatuses, value: 'all' },
    ...statusKeys.map((value) => ({ label: this.text()[value], value })),
  ]);
  protected readonly expiryOptions = computed(() => [
    { label: this.text().anyExpiry, value: 'any' },
    { label: this.text().within7Days, value: 'within7Days' },
  ]);
  protected readonly actions = computed<readonly PageHeaderAction[]>(() => [
    { id: 'new', label: this.text().newOffer, primary: true },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'recipient',
      label: this.text().recipientName,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'status', label: this.text().status, width: '10rem', kind: 'status' },
    {
      id: 'recommended',
      label: this.text().recommended,
      width: '20%',
      className: 'app-table-merged-column',
    },
    {
      id: 'alternative',
      label: this.text().alternative,
      width: '20%',
      className: 'app-table-merged-column',
    },
    {
      id: 'validUntil',
      label: this.text().validUntil,
      width: '8rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
    {
      id: 'updatedAt',
      label: this.text().updatedAt,
      width: '11rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
  ]);
  private readonly listParams = computed(() => {
    const scope = this.api.scope();
    const { page, pageSize, search, filter } = this.url.state();
    return scope
      ? {
          scope,
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            status: offerStatuses.find((status) => offerStatusKeys[status] === filter.status),
            expires: filter.expires === 'within7Days' ? ('WITHIN_7_DAYS' as const) : null,
          },
        }
      : undefined;
  });
  protected readonly list = resource({
    params: this.listParams,
    loader: ({ params, abortSignal }) => this.api.list(params.scope, params.variables, abortSignal),
  });
  protected readonly page = linkedSignal({
    source: () => ({
      params: this.listParams(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: ({ params, data }, previous): SalesOffersQuery['salesOffers'] | null =>
      data ?? (previous?.source.params === params ? (previous?.value ?? null) : null),
  });
  protected readonly view = computed(() => {
    const { search, filter } = this.url.state();
    return tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!search || (filter.status ?? 'all') !== 'all' || filter.expires === 'within7Days',
    });
  });
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message, recordId }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
      if (recordId && !this.detailOpen()) {
        this.open(recordId);
      }
    },
  };

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }

  protected open(path: string): void {
    void this.router.navigate([path], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
