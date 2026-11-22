import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { PublicBlogArticleSummaryFragment } from './generated/operations';
import { StorefrontApi } from './storefront-api';
import { localizedContent } from './storefront-content';
import { messages, type Language } from './storefront-messages';

const pageSize = 20;
const maxPage = Math.floor(2_147_483_647 / pageSize) + 1;

@Component({
  selector: 'holita-storefront-blog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './storefront-blog.html',
  styleUrl: './storefront-blog.scss',
})
export class StorefrontBlog {
  readonly language = input.required<Language>();
  readonly shopId = input.required<string>();
  readonly slug = input.required<string | null>();

  private readonly api = inject(StorefrontApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly t = computed(() => messages[this.language()]);
  protected readonly blogLink = computed(() => ['/s', this.shopId(), 'blog']);
  protected readonly tag = computed(() => this.query().get('tag'));
  protected readonly page = computed(() => {
    const raw = this.query().get('page') ?? '1';
    const page = /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
    return page <= maxPage ? page : 1;
  });
  private readonly request = resource({
    params: () => {
      const shopId = this.shopId();
      const slug = this.slug();
      return slug === null
        ? { shopId, slug, tagSlug: this.tag(), offset: (this.page() - 1) * pageSize }
        : { shopId, slug };
    },
    loader: async ({ params }) => {
      if (params.slug !== null) {
        return { article: await this.api.blogArticle(params.shopId, params.slug), list: null };
      }
      return {
        article: null,
        list: await this.api.blogArticles(params.shopId, {
          tagSlug: params.tagSlug,
          offset: params.offset,
          limit: pageSize,
        }),
      };
    },
  });
  private readonly result = computed(() => (this.request.hasValue() ? this.request.value() : null));
  protected readonly list = computed(() => this.result()?.list ?? null);
  protected readonly article = computed(() => {
    const article = this.result()?.article;
    const content = localizedContent(article, this.language());
    return article && content
      ? { ...content, publishedAt: article.publishedAt, tags: article.tags }
      : null;
  });
  protected readonly loading = this.request.isLoading;
  protected readonly failed = computed(() => this.request.status() === 'error');
  private readonly date = computed(
    () => new Intl.DateTimeFormat(this.language(), { dateStyle: 'long', timeZone: 'UTC' }),
  );

  constructor() {
    effect(() => {
      const list = this.list()?.blogArticles;
      if (list && list.offset > 0 && list.offset >= list.total) {
        const lastPage = Math.max(1, Math.ceil(list.total / list.limit));
        void this.router.navigate(this.blogLink(), {
          queryParams: this.pageParams(lastPage),
          replaceUrl: true,
        });
      }
    });
  }

  protected pageParams(page = this.page()) {
    return { tag: this.tag(), page: page > 1 ? page : null };
  }

  protected localizedTitle({ titleBg, titleEn }: PublicBlogArticleSummaryFragment) {
    return titleEn && (this.language() === 'en' || !titleBg)
      ? { title: titleEn, language: 'en' }
      : { title: titleBg, language: 'bg' };
  }

  protected formatDate(value: string) {
    return this.date().format(new Date(value));
  }

  protected retry() {
    this.request.reload();
  }
}
