import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  resource,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartState, forgetGuestReceipt, guestReceiptToken, shopperStorageKey } from './cart-state';
import { StorefrontApi } from './storefront-api';
import { messages, type Language } from './storefront-messages';
import { OrderReceipt } from './order-receipt';

@Component({
  selector: 'holita-order-confirmation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, OrderReceipt],
  templateUrl: './order-confirmation-page.html',
  styleUrl: './order-confirmation-page.scss',
})
export class OrderConfirmationPage {
  readonly language = input.required<Language>();
  readonly orderId = input.required<string>();

  private readonly api = inject(StorefrontApi);
  private readonly cartState = inject(CartState);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly base = computed(() => ['/s', this.cartState.shopId()]);
  protected readonly t = computed(() => messages[this.language()]);
  private readonly request = resource({
    params: () => ({ shopId: this.cartState.shopId(), orderId: this.orderId() }),
    loader: async ({ params: { shopId, orderId }, abortSignal }) => {
      const guestCartToken = guestReceiptToken(shopId, orderId);
      const credentials = guestCartToken
        ? { guestCartToken }
        : { shopperToken: sessionStorage.getItem(shopperStorageKey(shopId)) };
      try {
        const order = await this.api.orderConfirmation(shopId, credentials, orderId);
        abortSignal.throwIfAborted();
        if (!order && guestCartToken !== null) {
          forgetGuestReceipt(shopId, orderId, guestCartToken);
        }
        return order;
      } catch (error) {
        abortSignal.throwIfAborted();
        if (this.cartState.expireSession(shopId, credentials, error)) {
          return null;
        }
        throw error;
      }
    },
  });
  protected readonly order = computed(() =>
    this.request.hasValue() ? this.request.value() : null,
  );
  protected readonly loading = this.request.isLoading;
  protected readonly loadFailed = computed(() => this.request.status() === 'error');
  protected readonly sessionExpired = this.cartState.sessionExpired;
  constructor() {
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected retry() {
    this.request.reload();
  }
}
