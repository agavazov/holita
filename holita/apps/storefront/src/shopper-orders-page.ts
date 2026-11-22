import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  resource,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartState } from './cart-state';
import { OrderReceipt } from './order-receipt';
import { StorefrontApi } from './storefront-api';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney } from './storefront-money';

const ordersPageSize = 20;
const maxPage = Math.floor(2_147_483_647 / ordersPageSize) + 1;

@Component({
  selector: 'holita-shopper-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, OrderReceipt],
  templateUrl: './shopper-orders-page.html',
  styleUrl: './shopper-orders-page.scss',
})
export class ShopperOrdersPage {
  readonly language = input.required<Language>();
  readonly orderId = input.required<string | null>();

  private readonly api = inject(StorefrontApi);
  private readonly cartState = inject(CartState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');

  protected readonly t = computed(() => messages[this.language()]);
  protected readonly base = computed(() => ['/s', this.cartState.shopId()]);
  protected readonly ordersLink = computed(() => [...this.base(), 'account', 'orders']);
  protected readonly signedOut = computed(() => this.cartState.shopperToken() === null);
  protected readonly expired = this.cartState.sessionExpired;
  protected readonly page = computed(() => {
    const query = this.query().get('page') ?? '1';
    const page = /^[1-9]\d*$/.test(query) ? Number(query) : 1;
    return page <= maxPage ? page : 1;
  });

  private readonly request = resource({
    params: () => {
      const shopId = this.cartState.shopId();
      const shopperToken = this.cartState.shopperToken();
      const orderId = this.orderId();
      return shopperToken
        ? {
            shopId,
            shopperToken,
            orderId,
            offset: orderId ? 0 : (this.page() - 1) * ordersPageSize,
          }
        : undefined;
    },
    loader: async ({ params: { shopId, shopperToken, orderId, offset }, abortSignal }) => {
      try {
        return orderId
          ? {
              kind: 'detail' as const,
              order: await this.api.shopperOrder(shopId, shopperToken, orderId),
            }
          : {
              kind: 'list' as const,
              page: await this.api.shopperOrders(shopId, shopperToken, offset, ordersPageSize),
            };
      } catch (error) {
        abortSignal.throwIfAborted();
        if (this.cartState.expireSession(shopId, { shopperToken }, error)) {
          return undefined;
        }
        // The Router can mask the subgraph's authentication error.
        const shopper = await this.api.me(shopId, shopperToken).catch(() => undefined);
        abortSignal.throwIfAborted();
        if (shopper === null && this.cartState.clearShopperSession(shopId, shopperToken)) {
          return undefined;
        }
        throw error;
      }
    },
  });
  private readonly result = computed(() =>
    this.request.hasValue() ? this.request.value() : undefined,
  );
  protected readonly list = computed(() => {
    const result = this.result();
    return result?.kind === 'list' ? result.page : null;
  });
  protected readonly order = computed(() => {
    const result = this.result();
    return result?.kind === 'detail' ? result.order : null;
  });
  protected readonly loading = this.request.isLoading;
  protected readonly failed = computed(() => this.request.status() === 'error');
  private readonly date = computed(
    () => new Intl.DateTimeFormat(this.language(), { dateStyle: 'medium' }),
  );

  constructor() {
    afterNextRender(() => this.heading()?.nativeElement.focus());
    effect(() => {
      const list = this.list();
      if (!list) {
        return;
      }
      const lastPage = Math.max(1, Math.ceil(list.total / list.limit));
      if (list.offset >= list.total && this.page() > lastPage) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.pageParams(lastPage),
          replaceUrl: true,
        });
      }
    });
  }

  protected pageParams(page: number) {
    return { page: page > 1 ? page : null };
  }

  protected formatDate(value: string) {
    return this.date().format(new Date(value));
  }

  protected formatPrice(value: string, currency: string) {
    const format = new Intl.NumberFormat(this.language(), { style: 'currency', currency });
    return formatStorefrontMoney(value, format);
  }

  protected retry() {
    this.request.reload();
  }
}
