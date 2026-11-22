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
import { RouterLink } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { CartState } from './cart-state';
import { StorefrontApi } from './storefront-api';
import { messages, type Language } from './storefront-messages';
import { formatStorefrontMoney } from './storefront-money';
import type { QuoteCheckoutMutation } from './generated/operations';

const contactFields = [
  { name: 'name', label: 'name', type: 'text', autocomplete: 'name' },
  { name: 'email', label: 'email', type: 'email', autocomplete: 'email' },
  { name: 'phone', label: 'phone', type: 'tel', autocomplete: 'tel' },
] as const;

const addressFields = [
  { name: 'countryCode', label: 'countryCode', autocomplete: 'country' },
  { name: 'city', label: 'city', autocomplete: 'address-level2' },
  { name: 'postalCode', label: 'postalCode', autocomplete: 'postal-code' },
  { name: 'line1', label: 'addressLine1', autocomplete: 'address-line1' },
  { name: 'line2', label: 'addressLine2', autocomplete: 'address-line2' },
] as const;

interface CheckoutFieldError {
  path: string;
  code: string;
}

function checkoutFieldErrors(error: unknown): CheckoutFieldError[] {
  if (!CombinedGraphQLErrors.is(error)) {
    return [];
  }
  return error.errors.flatMap(({ extensions }) => {
    const fields = extensions?.['fieldErrors'];
    if (!Array.isArray(fields)) {
      return [];
    }
    return fields.filter(
      (field: unknown): field is CheckoutFieldError =>
        typeof field === 'object' &&
        field !== null &&
        'path' in field &&
        typeof field.path === 'string' &&
        'code' in field &&
        typeof field.code === 'string',
    );
  });
}

type CheckoutProblem = 'checkoutEmptyCart' | 'checkoutCartChanged' | 'checkoutQuoteFailed';

function required(control: AbstractControl) {
  return Validators.required(control);
}

@Component({
  selector: 'holita-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
})
export class CheckoutPage {
  readonly language = input.required<Language>();
  private readonly api = inject(StorefrontApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('checkoutForm');
  protected readonly cartState = inject(CartState);
  protected readonly base = computed(() => ['/s', this.cartState.shopId()]);
  protected readonly t = computed(() => messages[this.language()]);
  protected readonly contactFields = contactFields;
  protected readonly addressFields = addressFields;
  protected readonly form = this.fb.group({
    contact: this.fb.group({
      name: ['', required],
      email: ['', [required, (control: AbstractControl) => Validators.email(control)]],
      phone: ['', required],
    }),
    shippingAddress: this.fb.group({
      countryCode: ['', [required, Validators.pattern(/^[a-z]{2}$/i)]],
      city: ['', required],
      postalCode: ['', required],
      line1: ['', required],
      line2: '',
    }),
    shippingMethodId: ['', required],
    paymentMethodId: ['', required],
  });
  protected readonly reviewing = signal(false);
  protected readonly quote = signal<QuoteCheckoutMutation['quoteCheckout'] | null>(null);
  protected readonly problem = signal<CheckoutProblem | null>(null);
  private readonly rejectedFields = signal<readonly CheckoutFieldError[]>([]);
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
          checkoutFieldErrors(error).some(({ code }) => code === 'CART_NOT_FOUND')
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
      this.quote.set(null);
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
      const [shipping] = shippingMethods;
      const [payment] = paymentMethods;
      if (!shippingMethodId.value && shipping && shippingMethods.length === 1) {
        shippingMethodId.setValue(shipping.id);
      }
      if (!paymentMethodId.value && payment && paymentMethods.length === 1) {
        paymentMethodId.setValue(payment.id);
      }
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
    if (this.reviewing() || this.blocked()) {
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
    this.reviewing.set(true);
    try {
      const quote = await this.api.quoteCheckout(shopId, credentials, this.form.getRawValue());
      if (!this.destroy.destroyed) {
        this.quote.set(quote);
      }
    } catch (error) {
      if (!this.destroy.destroyed && !this.cartState.expireSession(shopId, credentials, error)) {
        this.showRejection(error);
      }
    } finally {
      this.reviewing.set(false);
    }
  }

  private showRejection(error: unknown) {
    this.quote.set(null);
    const errors = checkoutFieldErrors(error);
    const cartError = errors.find(({ path }) => path === 'cart');
    const formErrors = errors.filter(({ path }) => this.form.get(path));
    if (cartError) {
      this.problem.set(
        cartError.code === 'CHECKOUT_CART_CHANGED' ? 'checkoutCartChanged' : 'checkoutEmptyCart',
      );
    } else if (formErrors.length) {
      this.rejectedFields.set(formErrors);
      if (formErrors.some(({ code }) => code === 'INVALID_METHOD')) {
        this.request.reload();
      }
      this.focusError();
    } else {
      this.problem.set('checkoutQuoteFailed');
    }
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
