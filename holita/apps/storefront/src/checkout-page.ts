import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CartState,
  promoProblems,
  promoRejection,
  rememberGuestReceipt,
  type PromoProblem,
} from './cart-state';
import { checkoutCountries, defaultCountryCode } from './checkout-countries';
import {
  StorefrontApi,
  storefrontFieldErrors,
  type StorefrontCredentials,
  type StorefrontFieldError,
} from './storefront-api';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney } from './storefront-money';
import type { QuoteCheckoutMutation } from './generated/operations';

const contactFields = [
  { name: 'name', label: 'name', type: 'text', autocomplete: 'name' },
  { name: 'email', label: 'email', type: 'email', autocomplete: 'email' },
  { name: 'phone', label: 'phone', type: 'tel', autocomplete: 'tel' },
] as const;

const addressFields = [
  { name: 'city', label: 'city', autocomplete: 'address-level2' },
  { name: 'postalCode', label: 'postalCode', autocomplete: 'postal-code' },
  { name: 'line1', label: 'addressLine1', autocomplete: 'address-line1' },
  { name: 'line2', label: 'addressLine2', autocomplete: 'address-line2' },
] as const;

type CheckoutProblem =
  | 'checkoutEmptyCart'
  | 'checkoutCartChanged'
  | 'checkoutQuoteFailed'
  | 'checkoutQuoteChanged'
  | 'checkoutStockChanged'
  | 'orderPlacementFailed';

interface ReviewedCheckout {
  readonly shopId: string;
  readonly credentials: StorefrontCredentials;
  readonly quote: QuoteCheckoutMutation['quoteCheckout'];
}

function cartProblem(code: string): CheckoutProblem | null {
  switch (code) {
    case 'CART_NOT_FOUND':
    case 'CHECKOUT_EMPTY_CART':
      return 'checkoutEmptyCart';
    case 'CHECKOUT_CART_CHANGED':
      return 'checkoutCartChanged';
    case 'CHECKOUT_QUOTE_CHANGED':
      return 'checkoutQuoteChanged';
    case 'CHECKOUT_STOCK_CHANGED':
      return 'checkoutStockChanged';
    default:
      return null;
  }
}

function required(control: AbstractControl) {
  return Validators.required(control);
}

@Component({
  selector: 'holita-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './checkout-page.html',
  styleUrls: ['./checkout-layout.scss', './checkout-page.scss'],
})
export class CheckoutPage {
  readonly language = input.required<Language>();
  private readonly api = inject(StorefrontApi);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('checkoutForm');
  private readonly placeButton = viewChild<ElementRef<HTMLButtonElement>>('placeButton');
  private readonly problemElement = viewChild<ElementRef<HTMLParagraphElement>>('placementProblem');
  protected readonly cartState = inject(CartState);
  protected readonly base = computed(() => ['/s', this.cartState.shopId()]);
  protected readonly t = computed(() => messages[this.language()]);
  protected readonly contactFields = contactFields;
  protected readonly addressFields = addressFields;
  protected readonly countries = computed(() => checkoutCountries(this.language()));
  protected readonly form = this.fb.group({
    contact: this.fb.group({
      name: ['', required],
      email: ['', [required, (control: AbstractControl) => Validators.email(control)]],
      phone: ['', required],
    }),
    shippingAddress: this.fb.group({
      countryCode: [defaultCountryCode, required],
      city: ['', required],
      postalCode: ['', required],
      line1: ['', required],
      line2: '',
    }),
    shippingMethodId: ['', required],
    paymentMethodId: ['', required],
  });
  protected readonly reviewing = signal(false);
  protected readonly placing = signal(false);
  protected readonly busy = computed(() => this.reviewing() || this.placing());
  private readonly reviewed = signal<ReviewedCheckout | null>(null);
  protected readonly quote = computed(() => this.reviewed()?.quote ?? null);
  protected readonly problem = signal<CheckoutProblem | null>(null);
  private readonly rejectedPromo = signal<PromoProblem | null>(null);
  private readonly rejectedFields = signal<readonly StorefrontFieldError[]>([]);
  private readonly request = resource({
    params: () => this.cartState.shopId(),
    loader: async ({ params: shopId, abortSignal }) => {
      const credentials = this.cartState.credentials(shopId);
      try {
        const checkout = await this.api.checkout(shopId, credentials);
        abortSignal.throwIfAborted();
        const shopper =
          checkout && credentials.shopperToken
            ? await this.api.me(shopId, credentials.shopperToken)
            : null;
        return { checkout, shopper };
      } catch (error) {
        abortSignal.throwIfAborted();
        if (
          this.cartState.expireSession(shopId, credentials, error) ||
          storefrontFieldErrors(error).some(({ code }) => code === 'CART_NOT_FOUND')
        ) {
          return null;
        }
        throw error;
      }
    },
  });
  protected readonly checkout = computed(() =>
    this.request.hasValue() ? (this.request.value()?.checkout ?? null) : null,
  );
  protected readonly loading = this.request.isLoading;
  protected readonly loadFailed = computed(() => this.request.status() === 'error');
  protected readonly blocked = computed(
    () => !!this.checkout()?.cart.lines.some(({ issue }) => issue !== null),
  );
  protected readonly promoProblem = computed(() => {
    const issue = this.checkout()?.cart.discount?.issue;
    return this.rejectedPromo() ?? (issue ? promoProblems[issue] : null);
  });
  protected readonly needsCartReview = computed(() => {
    const problem = this.problem();
    return (
      !!this.promoProblem() ||
      problem === 'checkoutCartChanged' ||
      problem === 'checkoutEmptyCart' ||
      problem === 'checkoutStockChanged'
    );
  });
  protected readonly discount = computed(() => {
    const quote = this.quote();
    if (quote) {
      return quote.discountCode ? { code: quote.discountCode, amount: quote.discountAmount } : null;
    }
    return this.promoProblem() ? null : (this.checkout()?.cart.discount ?? null);
  });
  private readonly paymentId = toSignal(this.form.controls.paymentMethodId.valueChanges);
  protected readonly selectedPayment = computed(
    () =>
      this.quote()?.paymentMethod ??
      this.checkout()?.paymentMethods.find(({ id }) => id === this.paymentId()),
  );
  private readonly price = computed(
    () =>
      new Intl.NumberFormat(this.language(), {
        style: 'currency',
        currency: this.quote()?.currency ?? this.checkout()?.currency ?? 'BGN',
      }),
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.reviewed.set(null);
      this.problem.set(null);
      this.rejectedFields.set([]);
    });

    effect(() => {
      if (!this.request.hasValue()) {
        return;
      }
      const data = this.request.value();
      if (!data?.checkout) {
        return;
      }
      const { name, email } = this.form.controls.contact.controls;
      if (data.shopper && name.pristine && !name.value) {
        name.setValue(data.shopper.name);
      }
      if (data.shopper && email.pristine && !email.value) {
        email.setValue(data.shopper.email);
      }
      const { shippingMethodId, paymentMethodId } = this.form.controls;
      const { shippingMethods, paymentMethods } = data.checkout;
      // Refresh the controls without discarding the checkout rejection or the contact draft.
      for (const [control, methods] of [
        [shippingMethodId, shippingMethods],
        [paymentMethodId, paymentMethods],
      ] as const) {
        if (control.value && !methods.some(({ id }) => id === control.value)) {
          control.setValue('', { onlySelf: true });
        } else if (!control.value && methods.length === 1 && methods[0]) {
          control.setValue(methods[0].id, { onlySelf: true });
        }
      }
      this.form.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected retry() {
    this.request.reload();
  }

  protected formatPrice(value: string): string {
    return formatStorefrontMoney(value, this.price());
  }

  protected fieldError(path: string, control: AbstractControl): string | null {
    const server = this.rejectedFields().find((field) => field.path === path);
    if (!server && !(control.touched && control.invalid)) {
      return null;
    }
    return path.endsWith('MethodId')
      ? this.t().checkoutInvalidMethod
      : this.t().checkoutInvalidField;
  }

  protected async review() {
    if (this.busy() || this.blocked() || this.promoProblem()) {
      return;
    }
    this.problem.set(null);
    this.rejectedFields.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusError();
      return;
    }
    const shopId = this.cartState.shopId();
    const credentials = this.cartState.credentials(shopId);
    this.reviewed.set(null);
    this.reviewing.set(true);
    try {
      const quote = await this.api.quoteCheckout(shopId, credentials, this.form.getRawValue());
      if (!this.destroy.destroyed) {
        this.reviewed.set({ shopId, credentials, quote });
        afterNextRender(() => this.placeButton()?.nativeElement.focus(), {
          injector: this.injector,
        });
      }
    } catch (error) {
      if (!this.destroy.destroyed && !this.cartState.expireSession(shopId, credentials, error)) {
        this.showRejection(error, 'checkoutQuoteFailed');
      }
    } finally {
      this.reviewing.set(false);
    }
  }

  protected async placeOrder() {
    const reviewed = this.reviewed();
    if (this.busy() || !reviewed || reviewed.shopId !== this.cartState.shopId()) {
      return;
    }
    const {
      shopId,
      credentials,
      quote: { cartId, quoteRevision },
    } = reviewed;
    this.problem.set(null);
    this.placing.set(true);
    try {
      const order = await this.api.placeOrder(shopId, credentials, {
        ...this.form.getRawValue(),
        cartId,
        quoteRevision,
      });
      if (credentials.guestCartToken) {
        rememberGuestReceipt(shopId, order.id, credentials.guestCartToken);
      }
      if (!this.destroy.destroyed) {
        await this.router.navigate(['/s', shopId, 'checkout', 'confirmation', order.id], {
          replaceUrl: true,
        });
      }
    } catch (error) {
      if (!this.destroy.destroyed && !this.cartState.expireSession(shopId, credentials, error)) {
        this.showRejection(error, 'orderPlacementFailed');
      }
    } finally {
      this.placing.set(false);
    }
  }

  private showRejection(error: unknown, fallback: 'checkoutQuoteFailed' | 'orderPlacementFailed') {
    const errors = storefrontFieldErrors(error);
    const promo = errors.map(({ code }) => promoRejection(code)).find((value) => value !== null);
    const problem = errors.map(({ code }) => cartProblem(code)).find((value) => value !== null);
    const formErrors = errors.filter(({ path }) => this.form.get(path));
    if (promo) {
      this.reviewed.set(null);
      this.rejectedPromo.set(promo);
    } else if (problem) {
      this.reviewed.set(null);
      this.problem.set(problem);
      if (problem === 'checkoutQuoteChanged') {
        this.request.reload();
      }
    } else if (formErrors.length) {
      this.reviewed.set(null);
      this.rejectedFields.set(formErrors);
      if (formErrors.some(({ code }) => code === 'INVALID_METHOD')) {
        this.request.reload();
      }
      this.focusError();
      return;
    } else {
      this.problem.set(fallback);
    }
    afterNextRender(() => this.problemElement()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  private focusError() {
    afterNextRender(
      () => {
        this.formElement()
          ?.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
