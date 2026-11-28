import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  FormatDateTimePipe,
  PageHeader,
  TablePanel,
  UI_LANGUAGE,
  UrlListState,
  tableView,
  uiMessages,
  type DrawerHost,
  type ListDefinition,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { SalesOfferSummaryFragment, SalesOffersQuery } from '../generated/offers-operations';
import { offerLabel, offerPrice, offerStrings, quoteKinds } from './offer';
import { OffersApi } from './offers-api';

const definition: ListDefinition<Record<string, never>, 'UPDATED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'UPDATED_AT', direction: 'DESC' },
  filters: {},
};

@Component({
  selector: 'holita-offers-page',
  imports: [
    PageHeader,
    TablePanel,
    FilterBuilder,
    FormatDateTimePipe,
    RouterLink,
    RouterOutlet,
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
  protected readonly quoteKinds = quoteKinds;
  protected readonly trackByOffer = (_index: number, row: SalesOfferSummaryFragment) => row.id;
  protected readonly detailOpen = computed(() => {
    this.router.lastSuccessfulNavigation();
    return this.route.firstChild?.snapshot.paramMap.has('recordId') ?? false;
  });
  protected readonly url = new UrlListState(definition, () => !!this.api.scope());
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
    { id: 'status', label: this.text().status, width: '8rem', kind: 'status' },
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
      id: 'updatedAt',
      label: this.text().updatedAt,
      width: '11rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
  ]);
  protected readonly list = resource({
    params: () => {
      const scope = this.api.scope();
      const { page, pageSize, search } = this.url.state();
      return scope
        ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize, search } }
        : undefined;
    },
    loader: ({ params, abortSignal }) => this.api.list(params.scope, params.variables, abortSignal),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<OffersApi['scope']>; data: SalesOffersQuery['salesOffers'] | undefined },
    SalesOffersQuery['salesOffers'] | null
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
