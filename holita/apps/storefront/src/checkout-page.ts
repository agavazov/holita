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
  cartNotFound,
  forgetGuestCart,
  forgetPendingGuestCheckout,
  forgetPendingShopperCheckout,
  pendingGuestCheckout,
  pendingShopperCheckout,
  promoProblems,
  promoRejection,
  rememberGuestReceipt,
  rememberPendingGuestCheckout,
  rememberPendingShopperCheckout,
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
import { formatStorefrontMoney, shopCurrency } from './storefront-money';
import type { QuoteCheckoutMutation } from './generated/operations';

const contactFields = [
  { name: 'email', label: 'email', type: 'email', autocomplete: 'email' },
  { name: 'name', label: 'name', type: 'text', autocomplete: 'name' },
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
  | 'cartMinimumNotMet'
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
    case 'MINIMUM_QUANTITY_NOT_MET':
      return 'cartMinimumNotMet';
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
      const { credentials, pending } = this.checkoutOwner(shopId);
      if (credentials.shopperToken) {
        return this.readShopperCheckout(shopId, credentials.shopperToken, abortSignal);
      }
      if (!pending) {
        return this.readCheckout(shopId, credentials, abortSignal);
      }
      try {
        return { checkout: await this.api.checkout(shopId, credentials), shopper: null };
      } catch (error) {
        abortSignal.throwIfAborted();
        if (!cartNotFound(error)) {
          throw error;
        }
      }
      const order = await this.api.guestOrderConfirmation(shopId, pending.cartId, pending.token);
      abortSignal.throwIfAborted();
      if (order) {
        await this.finishCheckout(shopId, order.id, pending.cartId, credentials);
        return null;
      }
      forgetPendingGuestCheckout(shopId, pending);
      forgetGuestCart(shopId, pending.token);
      return this.readCheckout(shopId, this.cartState.credentials(shopId), abortSignal);
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
      problem === 'cartMinimumNotMet' ||
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
        currency: this.quote()?.currency ?? this.checkout()?.currency ?? shopCurrency,
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
    const { credentials } = this.checkoutOwner(shopId);
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
    const { shopperToken, guestCartToken } = credentials;
    const guestAttempt = guestCartToken ? { cartId, token: guestCartToken } : null;
    try {
      if (shopperToken) {
        rememberPendingShopperCheckout(shopId, cartId);
      } else if (guestAttempt) {
        rememberPendingGuestCheckout(shopId, guestAttempt);
      }
      const order = await this.api.placeOrder(shopId, credentials, {
        ...this.form.getRawValue(),
        cartId,
        quoteRevision,
      });
      await this.finishCheckout(shopId, order.id, cartId, credentials);
    } catch (error) {
      if (guestAttempt && cartNotFound(error)) {
        forgetPendingGuestCheckout(shopId, guestAttempt);
        forgetGuestCart(shopId, guestAttempt.token);
      }
      if (!this.destroy.destroyed && !this.cartState.expireSession(shopId, credentials, error)) {
        this.showRejection(error, 'orderPlacementFailed');
      }
    } finally {
      this.placing.set(false);
    }
  }

  private checkoutOwner(shopId: string) {
    const credentials = this.cartState.credentials(shopId);
    const pending = credentials.shopperToken ? null : pendingGuestCheckout(shopId);
    return { credentials: pending ? { guestCartToken: pending.token } : credentials, pending };
  }

  private async readShopperCheckout(
    shopId: string,
    shopperToken: string,
    abortSignal: AbortSignal,
  ) {
    const credentials = { shopperToken };
    const cartId = pendingShopperCheckout(shopId);
    if (cartId) {
      try {
        const order = await this.api.shopperOrderConfirmation(shopId, cartId, shopperToken);
        abortSignal.throwIfAborted();
        if (order) {
          await this.finishCheckout(shopId, order.id, cartId, credentials);
          return null;
        }
        forgetPendingShopperCheckout(shopId, cartId);
      } catch (error) {
        abortSignal.throwIfAborted();
        if (this.cartState.expireSession(shopId, credentials, error)) {
          return null;
        }
        throw error;
      }
    }
    return this.readCheckout(shopId, credentials, abortSignal);
  }

  private async readCheckout(
    shopId: string,
    credentials: StorefrontCredentials,
    abortSignal: AbortSignal,
  ) {
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
      if (this.cartState.expireSession(shopId, credentials, error) || cartNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  private async finishCheckout(
    shopId: string,
    orderId: string,
    cartId: string,
    { guestCartToken, shopperToken }: StorefrontCredentials,
  ) {
    if (guestCartToken) {
      rememberGuestReceipt(shopId, orderId, guestCartToken);
      forgetPendingGuestCheckout(shopId, { cartId, token: guestCartToken });
    }
    if (
      !this.destroy.destroyed &&
      this.cartState.shopId() === shopId &&
      (!shopperToken || this.cartState.credentials(shopId).shopperToken === shopperToken)
    ) {
      const opened = await this.router.navigate(
        ['/s', shopId, 'checkout', 'confirmation', orderId],
        {
          replaceUrl: true,
        },
      );
      if (opened && shopperToken) {
        forgetPendingShopperCheckout(shopId, cartId);
      }
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
      } else if (problem === 'cartMinimumNotMet') {
        this.cartState.refresh();
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
