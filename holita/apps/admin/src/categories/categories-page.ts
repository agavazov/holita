import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  errorCode,
  formatNumber,
  listRecord,
  tableView,
  toneSeverity,
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
import { Tag } from 'primeng/tag';
import { CategoriesApi } from './categories-api';
import { categoryRows, type CategoryRow } from './category-tree';

type CategoryAction = 'edit' | 'delete';
type Categories = Awaited<ReturnType<CategoriesApi['list']>>;
const definition: ListDefinition<Record<string, never>, 'TREE'> = {
  pageSizes: [20],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'TREE', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-categories-page',
  imports: [
    FilterBuilder,
    Message,
    PageHeader,
    RouterOutlet,
    RowActions,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage {
  private readonly api = inject(CategoriesApi);
  private readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly deleting = signal(false);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  protected readonly tableMinWidth = '22rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite()
      ? [{ id: 'create', label: this.text().newCategory, primary: true, disabled: this.deleting() }]
      : [],
  );
  protected readonly actions = computed<readonly ListAction<CategoryAction, CategoryRow>[]>(() =>
    this.canWrite()
      ? [
          { id: 'edit', label: this.text().edit, appliesTo: () => !this.deleting() },
          {
            id: 'delete',
            label: this.text().delete,
            danger: true,
            appliesTo: () => !this.deleting(),
            confirm: {
              title: this.text().deleteCategory,
              detail: this.text().deleteCategoryDetail,
              accept: this.text().delete,
            },
          },
        ]
      : [],
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().name,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'sortOrder',
      label: this.text().categorySortOrder,
      width: '7.5rem',
      kind: 'number',
      className: 'app-col-secondary',
    },
    { id: 'status', label: this.text().status, width: '7rem', kind: 'status' },
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
  private readonly data = linkedSignal<
    { scope: ReturnType<CategoriesApi['scope']>; data: Categories | undefined },
    Categories | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
  private readonly tree = computed(() => categoryRows(this.data() ?? []));
  protected readonly rows = computed(() => {
    const tree = this.tree();
    const language = this.language.value();
    const search = this.url.state().search.toLocaleLowerCase(language);
    if (!search) {
      return tree;
    }
    const words = search.split(/\s+/u);
    const visible = new Set<string>();
    for (const category of tree.toReversed()) {
      const haystack = `${category.path} ${category.slug}`.toLocaleLowerCase(language);
      if (visible.has(category.id) || words.every((word) => haystack.includes(word))) {
        visible.add(category.id);
        if (category.parentId) {
          visible.add(category.parentId);
        }
      }
    }
    return tree.filter((category) => visible.has(category.id));
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.data() ? this.rows().length : null,
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

  protected sortOrder(value: number): string {
    return formatNumber(value, this.language.value());
  }

  protected record(category: CategoryRow) {
    return listRecord(this.actions(), category, category.id, category.path);
  }

  protected open(id: string): void {
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  protected async run(request: ListActionRequest<CategoryAction>): Promise<void> {
    const id = request.ids[0];
    const scope = this.scope();
    if (!id || !scope || !this.canWrite() || this.deleting()) {
      return;
    }
    if (request.action === 'edit') {
      this.open(id);
      return;
    }
    this.deleting.set(true);
    try {
      await this.api.delete(scope, id);
      if (!this.destroyRef.destroyed && this.scope() === scope) {
        this.messages.add({ severity: 'success', summary: this.text().categoryDeleted });
        this.list.reload();
      }
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed && this.scope() === scope) {
        this.messages.add({
          severity: 'error',
          summary:
            errorCode(error) === 'CONFLICT'
              ? this.text().categoryDeleteConflict
              : this.text().categoryDeleteFailed,
          sticky: true,
        });
      }
    } finally {
      this.deleting.set(false);
    }
  }
}
