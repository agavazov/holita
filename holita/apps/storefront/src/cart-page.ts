import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CartState,
  maxCartQuantity,
  promoProblems,
  quantityControl,
  type CartWriteError,
  type PromoWriteError,
} from './cart-state';
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
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly promoInput = viewChild<ElementRef<HTMLInputElement>>('promoInput');
  private readonly removePromoButton =
    viewChild<ElementRef<HTMLButtonElement>>('removePromoButton');
  protected readonly state = inject(CartState);
  protected readonly base = () => ['/s', this.state.shopId()];
  protected readonly t = () => messages[this.language()];
  protected readonly maxCartQuantity = maxCartQuantity;
  protected readonly promoProblems = promoProblems;
  protected readonly canCheckout = computed(() => {
    const cart = this.state.cart();
    return (
      !!cart?.lines.length &&
      !this.state.locked() &&
      !cart.discount?.issue &&
      cart.lines.every(({ issue }) => issue === null)
    );
  });
  protected readonly promoCode = new FormControl('', { nonNullable: true });
  protected readonly promoDraft = toSignal(this.promoCode.valueChanges, { initialValue: '' });
  protected readonly promoError = linkedSignal({
    source: this.promoDraft,
    computation: (): PromoWriteError | null => null,
  });
  protected readonly promoStatus = signal<'promoApplied' | 'promoRemoved' | null>(null);
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

  protected async applyPromo() {
    const code = this.promoDraft().trim();
    if (this.state.locked() || !code) {
      return;
    }
    this.promoError.set(null);
    this.promoStatus.set(null);
    const result = await this.state.applyDiscount(code);
    if (this.destroy.destroyed || result === 'expired') {
      return;
    }
    if (result === 'ok') {
      this.promoCode.reset();
      this.promoStatus.set('promoApplied');
    } else {
      this.promoError.set(result);
    }
    afterNextRender(
      () => (result === 'ok' ? this.removePromoButton() : this.promoInput())?.nativeElement.focus(),
      { injector: this.injector },
    );
  }

  protected async removePromo() {
    if (this.state.locked()) {
      return;
    }
    this.promoError.set(null);
    this.promoStatus.set(null);
    const result = await this.state.removeDiscount();
    if (this.destroy.destroyed || result === 'expired') {
      return;
    }
    if (result !== 'ok') {
      this.promoError.set(result);
      return;
    }
    this.promoStatus.set('promoRemoved');
    afterNextRender(() => (this.promoInput() ?? this.heading())?.nativeElement.focus(), {
      injector: this.injector,
    });
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
