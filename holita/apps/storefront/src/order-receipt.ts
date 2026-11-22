import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OrderConfirmationFieldsFragment } from './generated/operations';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney } from './storefront-money';

@Component({
  selector: 'holita-order-receipt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-receipt.html',
  styleUrls: ['./checkout-layout.scss', './order-receipt.scss'],
})
export class OrderReceipt {
  readonly order = input.required<OrderConfirmationFieldsFragment>();
  readonly language = input.required<Language>();
  readonly showPlacement = input(false);

  protected readonly t = computed(() => messages[this.language()]);
  protected readonly placedOn = computed(() =>
    new Intl.DateTimeFormat(this.language(), { dateStyle: 'medium' }).format(
      new Date(this.order().placedAt),
    ),
  );
  private readonly price = computed(
    () =>
      new Intl.NumberFormat(this.language(), {
        style: 'currency',
        currency: this.order().currency,
      }),
  );

  protected formatPrice(value: string) {
    return formatStorefrontMoney(value, this.price());
  }
}
