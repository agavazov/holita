import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  formatNumber,
  listRecord,
  tableView,
  trackById,
  uiMessages,
  type DrawerHost,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type {
  NavigationPlacement,
  OperatorNavigationMenuSummaryFieldsFragment,
} from '../generated/navigation-operations';
import { NavigationApi } from './navigation-api';

type NavigationMenus = Awaited<ReturnType<NavigationApi['list']>>;

const definition: ListDefinition<Record<string, never>, 'PLACEMENT'> = {
  pageSizes: [20],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'PLACEMENT', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-navigation-page',
  imports: [FilterBuilder, Message, PageHeader, RouterOutlet, RowActions, TableModule, TablePanel],
  templateUrl: './navigation-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationPage {
  private readonly api = inject(NavigationApi);
  private readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  protected readonly trackById = trackById;
  protected readonly actions = computed<
    readonly ListAction<'edit', OperatorNavigationMenuSummaryFieldsFragment>[]
  >(() => (this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : []));
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'placement',
      label: this.text().navigationPlacement,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'itemCount', label: this.text().navigationLinkCount, width: '6rem', kind: 'number' },
    ...(this.canWrite()
      ? [
          {
            id: 'actions',
            label: this.shared().pageHeader.actions,
            width: '3.25rem',
            kind: 'actions' as const,
            className: 'app-col-actions',
          },
        ]
      : []),
  ]);
  protected readonly list = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params }) => this.api.list(params),
  });
  private readonly menus = linkedSignal<
    { scope: ReturnType<NavigationApi['scope']>; data: NavigationMenus | undefined },
    NavigationMenus | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() => {
    const menus = this.menus();
    return this.canWrite() && menus && menus.length < 2
      ? [
          {
            id: 'create',
            label: this.text().newNavigationMenu,
            primary: true,
            disabled: this.list.isLoading(),
          },
        ]
      : [];
  });
  protected readonly rows = computed(() => {
    const menus = this.menus() ?? [];
    const language = this.language.value();
    const search = this.url.state().search.toLocaleLowerCase(language);
    return search
      ? menus.filter(({ placement }) =>
          this.placementLabel(placement).toLocaleLowerCase(language).includes(search),
        )
      : menus;
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.menus() ? this.rows().length : null,
      filtered: !!this.url.state().search,
    }),
  );
  protected readonly actionContext = computed(() => ({
    scope: this.scope(),
    search: this.url.state().search,
  }));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
    },
  };

  protected placementLabel(placement: NavigationPlacement): string {
    return placement === 'HEADER' ? this.text().navigationHeader : this.text().navigationFooter;
  }

  protected itemCount(count: number): string {
    return formatNumber(count, this.language.value());
  }

  protected record(menu: OperatorNavigationMenuSummaryFieldsFragment) {
    return listRecord(this.actions(), menu, menu.id, this.placementLabel(menu.placement));
  }

  protected open(id: string): void {
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  protected run(request: ListActionRequest<'edit'>): void {
    const id = request.ids[0];
    if (id && this.canWrite()) {
      this.open(id);
    }
  }
}
