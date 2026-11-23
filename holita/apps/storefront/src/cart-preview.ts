import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CartState,
  cartProblems,
  maxCartQuantity,
  promoProblems,
  type CartWriteError,
} from './cart-state';
import type { PublicCartFieldsFragment } from './generated/operations';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney } from './storefront-money';

type CartLine = PublicCartFieldsFragment['lines'][number];

@Component({
  selector: 'holita-cart-preview',
  imports: [RouterLink],
  templateUrl: './cart-preview.html',
  styleUrl: './cart-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPreview {
  readonly language = input.required<Language>();
  readonly priceFormat = input.required<Intl.NumberFormat>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private opener: HTMLElement | null = null;
  protected readonly state = inject(CartState);
  protected readonly base = () => ['/s', this.state.shopId()];
  protected readonly t = () => messages[this.language()];
  protected readonly cartProblems = cartProblems;
  protected readonly maxCartQuantity = maxCartQuantity;
  protected readonly promoProblems = promoProblems;
  protected readonly shown = signal(false);
  protected readonly lineError = signal<{
    lineId: string;
    message: CartWriteError | 'cartInvalidQuantity';
  } | null>(null);

  open(opener: HTMLElement) {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      this.opener = opener;
      this.lineError.set(null);
      this.shown.set(true);
      dialog.showModal();
      this.closeButton().nativeElement.focus();
    }
  }

  protected restoreFocus() {
    this.shown.set(false);
    this.opener?.focus();
    this.opener = null;
  }

  protected formatPrice(value: string) {
    return formatStorefrontMoney(value, this.priceFormat());
  }

  protected async update(line: CartLine, quantityInput: HTMLInputElement) {
    if (this.state.locked()) {
      return;
    }
    this.lineError.set(null);
    if (!quantityInput.validity.valid) {
      const message =
        quantityInput.validity.rangeUnderflow && (line.minimumQuantity ?? 1) > 1
          ? 'cartMinimumNotMet'
          : 'cartInvalidQuantity';
      this.lineError.set({ lineId: line.id, message });
      quantityInput.focus();
      return;
    }
    const quantity = quantityInput.valueAsNumber;
    if (quantity === line.quantity) {
      return;
    }
    const result = await this.state.update(line.id, quantity);
    if (result !== 'ok' && result !== 'expired') {
      quantityInput.value = String(line.quantity);
      this.lineError.set({ lineId: line.id, message: result });
      if (result === 'cartMinimumNotMet') {
        this.state.refresh();
      }
    }
  }

  protected async remove(line: CartLine) {
    if (this.state.locked()) {
      return;
    }
    this.lineError.set(null);
    const result = await this.state.remove(line.id);
    if (result === 'ok') {
      if (this.shown()) {
        this.closeButton().nativeElement.focus();
      }
    } else if (result !== 'expired') {
      this.lineError.set({ lineId: line.id, message: result });
    }
  }
}
