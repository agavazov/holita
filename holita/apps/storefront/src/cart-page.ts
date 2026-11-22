import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartState, maxCartQuantity, quantityControl, type CartWriteError } from './cart-state';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney } from './storefront-money';
import type { PublicCartFieldsFragment, SignInShopperMutation } from './generated/operations';

type CartLine = PublicCartFieldsFragment['lines'][number];
type MergeIssues = SignInShopperMutation['signInShopper']['cartMergeIssues'];

export class CartMergeNotice {
  constructor(
    readonly shopId: string,
    readonly issues: MergeIssues,
  ) {}
}

@Component({
  selector: 'holita-shop-cart',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage {
  readonly language = input.required<Language>();
  readonly priceFormat = input.required<Intl.NumberFormat>();
  readonly mergeNotice = input<CartMergeNotice | null>(null);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly state = inject(CartState);
  protected readonly base = () => ['/s', this.state.shopId()];
  protected readonly t = () => messages[this.language()];
  protected readonly maxCartQuantity = maxCartQuantity;
  protected readonly canCheckout = computed(() => {
    const lines = this.state.cart()?.lines;
    return !!lines?.length && !this.state.locked() && lines.every(({ issue }) => issue === null);
  });
  protected readonly lineError = signal<{ lineId: string; message: CartWriteError } | null>(null);
  protected readonly updated = signal(false);
  protected readonly quantities = linkedSignal<
    readonly CartLine[],
    Map<string, FormControl<number | null>>
  >({
    source: () => this.state.cart()?.lines ?? [],
    computation: (lines, previous) =>
      new Map(
        lines.map((line) => [
          line.id,
          previous?.value.get(line.id) ?? quantityControl(line.quantity),
        ]),
      ),
  });

  protected formatPrice(value: string) {
    return formatStorefrontMoney(value, this.priceFormat());
  }

  protected async update(line: CartLine) {
    const control = this.quantities().get(line.id);
    const quantity = control?.value;
    if (this.state.locked() || !control?.valid || quantity == null || quantity === line.quantity) {
      return;
    }
    this.lineError.set(null);
    this.updated.set(false);
    const result = await this.state.update(line.id, quantity);
    if (result === 'ok') {
      this.updated.set(true);
    } else if (result !== 'expired') {
      this.lineError.set({ lineId: line.id, message: result });
    }
  }

  protected async remove(line: CartLine) {
    if (this.state.locked()) {
      return;
    }
    this.lineError.set(null);
    this.updated.set(false);
    const result = await this.state.remove(line.id);
    if (result === 'ok') {
      this.updated.set(true);
      this.heading()?.nativeElement.focus();
    } else if (result !== 'expired') {
      this.lineError.set({ lineId: line.id, message: result });
    }
  }
}
