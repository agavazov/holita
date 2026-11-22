import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  ListSortMenu,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  codecs,
  formatDateTimeCell,
  injectSortReady,
  listQuery,
  listRecord,
  tableView,
  toneSeverity,
  trackById,
  uiMessages,
  type DrawerHost,
  type FilterCondition,
  type FilterField,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type ListQuery,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  OperatorBlogArticleListFieldsFragment,
  OperatorBlogArticlesQuery,
  BlogArticleSortField,
  BlogArticleStatus,
} from '../generated/blog-operations';
import { BlogApi } from './blog-api';
import { articleStatus, articleStatuses, articleTitle } from './blog-article-labels';

type ArticleList = OperatorBlogArticlesQuery['blogArticles'];
type ArticleRow = OperatorBlogArticleListFieldsFragment;
const statusCodec = codecs.choice([...articleStatuses, 'ANY'], 'ANY');
const definition: ListDefinition<{ status: BlogArticleStatus | 'ANY' }, BlogArticleSortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'updatedAt', field: 'UPDATED_AT' },
    { param: 'slug', field: 'SLUG' },
    { param: 'status', field: 'STATUS' },
  ],
  defaultSort: { field: 'UPDATED_AT', direction: 'DESC' },
  filters: { status: statusCodec },
};

@Component({
  selector: 'holita-blog-articles-page',
  imports: [
    FilterBuilder,
    ListSortMenu,
    Message,
    PageHeader,
    RouterOutlet,
    RowActions,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './blog-articles-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArticlesPage {
  private readonly api = inject(BlogApi);
  private readonly language = inject(OperatorLanguage);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly sortReady = injectSortReady();
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly canWrite = this.api.canWrite;
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly tableMinWidth = '43rem';
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().newBlogArticle, primary: true }] : [],
  );
  protected readonly actions = computed<readonly ListAction<'edit', ArticleRow>[]>(() =>
    this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : [],
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'article',
      label: this.text().blogArticleTitle,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'STATUS', label: this.text().status, width: '8rem', kind: 'status' },
    {
      id: 'tags',
      label: this.text().blogTags,
      width: '14rem',
      kind: 'text',
      className: 'app-col-secondary',
    },
    {
      id: 'publishedAt',
      label: this.text().blogPublishedAt,
      width: '11rem',
      kind: 'date',
      className: 'app-col-secondary',
    },
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
  protected readonly sortFields = computed(() => [
    { field: 'UPDATED_AT', label: this.text().pageUpdatedAt },
    { field: 'SLUG', label: this.text().slug },
    { field: 'STATUS', label: this.text().status },
  ]);
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  protected readonly filterFields = computed<readonly FilterField[]>(() => [
    {
      key: 'status',
      label: this.text().status,
      type: 'enum',
      operators: ['equals'],
      options: articleStatuses.map((value) => ({ value, label: this.statusLabel(value) })),
    },
  ]);
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const status = this.url.state().filter.status;
    return status && status !== 'ANY'
      ? [{ id: 'status', field: 'status', operator: 'equals', values: [status] }]
      : [];
  });
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, sort, filter } = this.url.state();
    return scope
      ? {
          scope,
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            sort,
            status: filter.status && filter.status !== 'ANY' ? filter.status : null,
          },
        }
      : undefined;
  });
  protected readonly list = resource({
    params: this.params,
    loader: ({ params }) => this.api.articles(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<BlogApi['scope']>; data: ArticleList | undefined },
    ArticleList | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search || this.conditions().length > 0,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
    },
  };

  constructor() {
    effect(() => {
      const data = this.list.hasValue() && !this.list.isLoading() ? this.list.value() : null;
      if (data) {
        this.url.correctPage(Math.ceil(data.total / this.url.state().pageSize));
      }
    });
  }

  protected title(article: ArticleRow): string {
    return articleTitle(article, this.language.value());
  }

  protected tagNames(article: ArticleRow): string {
    return article.tags.map(({ name }) => name).join(', ');
  }

  protected statusLabel(status: BlogArticleStatus): string {
    return articleStatus(status, this.language.value());
  }

  protected publishedAt(value: string | null) {
    return formatDateTimeCell(value, this.language.value(), 'UTC');
  }

  protected record(article: ArticleRow) {
    return listRecord(this.actions(), article, article.id, this.title(article));
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    this.url.patchFilter({ status: statusCodec.read(conditions[0]?.values ?? []) ?? 'ANY' });
  }

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    const field = definition.sorts.find((candidate) => candidate.field === sort.field)?.field;
    if (field) {
      this.url.setSort(field, sort.direction === 'asc' ? 'ASC' : 'DESC');
    }
  }

  protected tableSort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) {
      return;
    }
    const sort = listQuery.sorted(
      { ...this.url.state(), sort: this.sort(), conditions: this.conditions() },
      event,
    )?.sort;
    if (sort) {
      this.changeSort(sort);
    }
  }

  protected open(id: string): void {
    if (this.canWrite()) {
      void this.router.navigate([id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    }
  }

  protected run(request: ListActionRequest<'edit'>): void {
    const id = request.ids[0];
    if (id) {
      this.open(id);
    }
  }
}
