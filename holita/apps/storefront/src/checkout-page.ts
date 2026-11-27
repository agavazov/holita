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
  untracked,
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
import { checkoutAddressFields } from './checkout-address-fields';
import { checkoutCountries, defaultCountryCode } from './checkout-countries';
import {
  StorefrontApi,
  storefrontFieldErrors,
  type StorefrontCredentials,
  type StorefrontFieldError,
} from './storefront-api';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney, shopCurrency } from './storefront-money';
import type {
  QuoteCheckoutMutation,
  ShopperAddressFieldsFragment,
  ShopperOrderConfirmationQuery,
} from './generated/operations';

const contactFields = [
  { name: 'email', label: 'email', type: 'email', autocomplete: 'email' },
  { name: 'name', label: 'name', type: 'text', autocomplete: 'name' },
  { name: 'phone', label: 'phone', type: 'tel', autocomplete: 'tel' },
] as const;

const billingFields = [
  { name: 'name', label: 'billingName', autocomplete: 'name', type: 'text', maxLength: 200 },
  { name: 'phone', label: 'billingPhone', autocomplete: 'tel', type: 'tel', maxLength: 100 },
  ...checkoutAddressFields.map((field) => ({ ...field, type: 'text' })),
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

type ConfirmedShopperOrder = NonNullable<ShopperOrderConfirmationQuery['shopperOrderConfirmation']>;

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

function requiredBillingField(control: AbstractControl<string>) {
  return control.value.trim() ? null : { required: true };
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
  protected readonly addressFields = checkoutAddressFields;
  protected readonly billingFields = billingFields;
  protected readonly countries = computed(() => checkoutCountries(this.language()));
  protected readonly shopperNoteLimit = 5_000;
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
    separateBillingAddress: false,
    billingAddress: this.fb.group({
      name: ['', requiredBillingField],
      phone: ['', requiredBillingField],
      countryCode: [defaultCountryCode, requiredBillingField],
      city: ['', requiredBillingField],
      postalCode: ['', requiredBillingField],
      line1: ['', requiredBillingField],
      line2: '',
    }),
    shopperNote: ['', Validators.maxLength(this.shopperNoteLimit)],
  });
  protected readonly savedAddressId = this.fb.control('');
  protected readonly saveAddress = this.fb.control(false);
  private readonly selectedAddressId = toSignal(this.savedAddressId.valueChanges, {
    initialValue: '',
  });
  private readonly owner = computed(() => ({
    shopId: this.cartState.shopId(),
    shopperToken: this.cartState.shopperToken(),
  }));
  private readonly addressRequest = resource({
    params: () => {
      const { shopId, shopperToken } = this.owner();
      return shopperToken ? { shopId, shopperToken } : undefined;
    },
    loader: async ({ params: { shopId, shopperToken }, abortSignal }) => {
      try {
        const addresses = await this.api.shopperAddresses(shopId, shopperToken);
        return addresses.filter(({ type }) => type === 'GENERAL' || type === 'SHIPPING');
      } catch (error) {
        abortSignal.throwIfAborted();
        if (this.cartState.expireSession(shopId, { shopperToken }, error)) {
          return undefined;
        }
        throw error;
      }
    },
  });
  protected readonly savedAddresses = computed(() =>
    this.addressRequest.hasValue() ? this.addressRequest.value() : [],
  );
  protected readonly addressListFailed = computed(() => this.addressRequest.status() === 'error');
  protected readonly hasUnavailableAddresses = computed(() =>
    this.savedAddresses().some(({ countryCode }) => !this.addressCountryAvailable(countryCode)),
  );
  protected readonly canSaveAddress = computed(
    () => !!this.owner().shopperToken && !this.selectedAddressId(),
  );
  protected readonly reviewing = signal(false);
  protected readonly placing = signal(false);
  protected readonly busy = computed(() => this.reviewing() || this.placing());
  private readonly reviewed = signal<ReviewedCheckout | null>(null);
  protected readonly quote = computed(() => this.reviewed()?.quote ?? null);
  protected readonly problem = signal<CheckoutProblem | null>(null);
  private readonly rejectedPromo = signal<PromoProblem | null>(null);
  private readonly rejectedFields = signal<readonly StorefrontFieldError[]>([]);
  private readonly request = resource({
    params: () => (this.cartState.sessionExpired() ? undefined : this.owner()),
    loader: async ({ params: { shopId, shopperToken }, abortSignal }) => {
      if (shopperToken) {
        return this.readShopperCheckout(shopId, shopperToken, abortSignal);
      }
      const { credentials, pending } = this.checkoutOwner(shopId);
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
    const { separateBillingAddress, billingAddress } = this.form.controls;
    billingAddress.disable({ emitEvent: false });
    separateBillingAddress.valueChanges.pipe(takeUntilDestroyed()).subscribe((separate) => {
      if (separate) {
        billingAddress.enable({ emitEvent: false });
      } else {
        billingAddress.disable({ emitEvent: false });
      }
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.reviewed.set(null);
      this.problem.set(null);
      this.rejectedFields.set([]);
    });

    let previousOwner = this.owner();
    effect(() => {
      const owner = this.owner();
      if (owner === previousOwner) {
        return;
      }
      this.reviewed.set(null);
      if (previousOwner.shopperToken) {
        this.savedAddressId.reset();
        this.saveAddress.reset();
        this.form.controls.shippingAddress.reset();
        this.form.controls.contact.reset();
      }
      previousOwner = owner;
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

    effect(() => {
      if (!this.checkout()) {
        return;
      }
      const addresses = this.savedAddresses();
      untracked(() => {
        const delivery = this.form.controls.shippingAddress;
        if (
          !delivery.pristine ||
          !delivery.untouched ||
          this.savedAddressId.value ||
          this.saveAddress.value
        ) {
          return;
        }
        const available = addresses.filter(({ countryCode }) =>
          this.addressCountryAvailable(countryCode),
        );
        const preferred =
          available.find(({ type, isDefault }) => type === 'SHIPPING' && isDefault) ?? available[0];
        if (preferred) {
          this.savedAddressId.setValue(preferred.id);
          this.fillAddress(preferred, true);
        }
      });
    });
  }

  protected addressCountryAvailable(countryCode: string): boolean {
    return this.countries().some(({ code }) => code === countryCode);
  }

  protected addressOptionLabel(address: ShopperAddressFieldsFragment): string {
    const country = this.countries().find(({ code }) => code === address.countryCode);
    return [
      address.recipient,
      address.line1,
      address.line2,
      `${address.postalCode} ${address.city}`,
      country?.label ?? address.countryCode,
      address.isDefault ? this.t().addressDefault : '',
      country ? '' : this.t().checkoutAddressUnavailable,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected chooseAddress(id: string) {
    this.saveAddress.reset();
    if (!id) {
      this.form.controls.shippingAddress.reset();
      this.form.controls.shippingAddress.markAsDirty();
      return;
    }
    const address = this.savedAddresses().find((saved) => saved.id === id);
    if (address && this.addressCountryAvailable(address.countryCode)) {
      this.fillAddress(address, false);
    }
  }

  private fillAddress(address: ShopperAddressFieldsFragment, preselect: boolean) {
    const { countryCode, city, postalCode, line1, line2, recipient } = address;
    this.form.controls.shippingAddress.setValue({
      countryCode,
      city,
      postalCode,
      line1,
      line2: line2 ?? '',
    });
    const { name, phone } = this.form.controls.contact.controls;
    if (!preselect || !name.value.trim()) {
      name.setValue(recipient);
    }
    if (address.phone && (!preselect || !phone.value.trim())) {
      phone.setValue(address.phone);
    }
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
    if (path === 'shopperNote') {
      return this.t().checkoutShopperNoteInvalid;
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
      const quote = await this.api.quoteCheckout(shopId, credentials, this.checkoutInput());
      if (
        !this.destroy.destroyed &&
        this.cartState.shopId() === shopId &&
        this.cartState.shopperToken() === (credentials.shopperToken ?? null)
      ) {
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
    if (
      this.busy() ||
      !reviewed ||
      reviewed.shopId !== this.cartState.shopId() ||
      (reviewed.credentials.shopperToken ?? null) !== this.cartState.shopperToken()
    ) {
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
    const shouldSave = this.canSaveAddress() && this.saveAddress.value;
    try {
      if (shopperToken) {
        rememberPendingShopperCheckout(shopId, cartId, shouldSave);
      } else if (guestAttempt) {
        rememberPendingGuestCheckout(shopId, guestAttempt);
      }
      const order = await this.api.placeOrder(shopId, credentials, {
        ...this.checkoutInput(),
        shopperNote: this.form.controls.shopperNote.value,
        cartId,
        quoteRevision,
      });
      await this.finishCheckout(
        shopId,
        order.id,
        cartId,
        credentials,
        shouldSave ? order : undefined,
      );
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

  private async saveShippingAddress(
    shopId: string,
    shopperToken: string,
    { contact, shippingAddress }: ConfirmedShopperOrder,
  ): Promise<boolean> {
    const { name: recipient, phone } = contact;
    const { countryCode, city, postalCode, line1, line2 } = shippingAddress;
    if (Array.from(recipient).length > 200 || Array.from(phone).length > 50) {
      return false;
    }
    try {
      const addresses = await this.api.shopperAddresses(shopId, shopperToken);
      if (!this.isActiveCheckout(shopId, shopperToken)) {
        return false;
      }
      const shipping = addresses.filter(({ type }) => type === 'SHIPPING');
      if (
        shipping.some(
          (address) =>
            address.recipient === recipient &&
            address.phone === phone &&
            address.countryCode === countryCode &&
            address.city === city &&
            address.postalCode === postalCode &&
            address.line1 === line1 &&
            address.line2 === line2,
        )
      ) {
        return true;
      }
      await this.api.createShopperAddress(shopId, shopperToken, {
        type: 'SHIPPING',
        recipient,
        phone,
        countryCode,
        city,
        postalCode,
        line1,
        line2,
        isDefault: !shipping.some(({ isDefault }) => isDefault),
      });
      return true;
    } catch {
      return false;
    }
  }

  private checkoutInput() {
    const {
      contact,
      shippingAddress,
      separateBillingAddress,
      billingAddress,
      paymentMethodId,
      shippingMethodId,
    } = this.form.getRawValue();
    return {
      contact,
      shippingAddress,
      ...(separateBillingAddress ? { billingAddress } : {}),
      paymentMethodId,
      shippingMethodId,
    };
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
    const attempt = pendingShopperCheckout(shopId);
    if (attempt) {
      const { cartId, saveAddress } = attempt;
      try {
        const order = await this.api.shopperOrderConfirmation(shopId, cartId, shopperToken);
        abortSignal.throwIfAborted();
        if (order) {
          await this.finishCheckout(
            shopId,
            order.id,
            cartId,
            credentials,
            saveAddress ? order : undefined,
          );
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

  private isActiveCheckout(shopId: string, shopperToken?: string | null) {
    return (
      !this.destroy.destroyed &&
      this.cartState.shopId() === shopId &&
      (!shopperToken || this.cartState.credentials(shopId).shopperToken === shopperToken)
    );
  }

  private async finishCheckout(
    shopId: string,
    orderId: string,
    cartId: string,
    { guestCartToken, shopperToken }: StorefrontCredentials,
    orderToSave?: ConfirmedShopperOrder,
  ) {
    if (guestCartToken) {
      rememberGuestReceipt(shopId, orderId, guestCartToken);
      forgetPendingGuestCheckout(shopId, { cartId, token: guestCartToken });
    }
    if (!this.isActiveCheckout(shopId, shopperToken)) {
      return;
    }
    const addressSaveFailed =
      orderToSave && shopperToken
        ? !(await this.saveShippingAddress(shopId, shopperToken, orderToSave))
        : false;
    if (this.isActiveCheckout(shopId, shopperToken)) {
      const opened = await this.router.navigate(
        ['/s', shopId, 'checkout', 'confirmation', orderId],
        {
          replaceUrl: true,
          ...(addressSaveFailed ? { state: { unsavedAddressOrderId: orderId } } : {}),
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
