import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartState } from './cart-state';
import { checkoutAddressFields } from './checkout-address-fields';
import { checkoutCountries, defaultCountryCode } from './checkout-countries';
import type {
  CustomerAddressInput,
  CustomerAddressType,
  ShopperAddressFieldsFragment,
} from './generated/operations';
import { StorefrontApi, storefrontFieldErrors } from './storefront-api';
import { messages, type Language } from './storefront-messages';

const addressKinds = {
  GENERAL: 'addressTypeGeneral',
  SHIPPING: 'addressTypeShipping',
  BILLING: 'addressTypeBilling',
} as const satisfies Record<CustomerAddressType, keyof (typeof messages)['en']>;
const [cityField, postalCodeField, line1Field, line2Field] = checkoutAddressFields;
const recipientField = {
  name: 'recipient',
  label: 'addressRecipient',
  autocomplete: 'name',
  maxLength: 200,
} as const;
const phoneField = {
  name: 'phone',
  label: 'addressPhone',
  autocomplete: 'tel',
  maxLength: 50,
} as const;

const emptyAddress = {
  type: 'GENERAL' as const,
  isDefault: false,
  recipient: '',
  line1: '',
  line2: '',
  phone: '',
  city: '',
  postalCode: '',
  countryCode: defaultCountryCode,
};

interface AddressBookScope {
  shopId: string;
  shopperToken: string;
}

type Address = ShopperAddressFieldsFragment;
type AddressActionError = 'addressSaveFailed' | 'addressDefaultFailed' | 'addressRemoveFailed';

function addressText(maxLength: number, required = true) {
  return (control: AbstractControl<string>) => {
    const value = control.value.trim();
    if (required && !value) {
      return { required: true };
    }
    return value.includes('\u0000') || Array.from(value).length > maxLength
      ? { invalidAddressText: true }
      : null;
  };
}

@Component({
  selector: 'holita-shopper-addresses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './shopper-addresses-page.html',
  styleUrl: './shopper-addresses-page.scss',
})
export class ShopperAddressesPage {
  readonly language = input.required<Language>();

  private readonly api = inject(StorefrontApi);
  private readonly cartState = inject(CartState);
  private readonly destroy = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly editorHeading = viewChild<ElementRef<HTMLHeadingElement>>('editorHeading');
  private readonly confirmation = viewChild<ElementRef<HTMLDivElement>>('confirmation');
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');

  protected readonly t = computed(() => messages[this.language()]);
  protected readonly base = computed(() => ['/s', this.cartState.shopId()]);
  protected readonly expired = this.cartState.sessionExpired;
  private readonly scope = computed<AddressBookScope | undefined>(() => {
    const shopId = this.cartState.shopId();
    const shopperToken = this.cartState.shopperToken();
    return shopperToken ? { shopId, shopperToken } : undefined;
  });
  protected readonly signedIn = computed(() => !!this.scope());
  protected readonly request = resource({
    params: this.scope,
    loader: async ({ params, abortSignal }) => {
      try {
        return await this.api.shopperAddresses(params.shopId, params.shopperToken);
      } catch (error) {
        abortSignal.throwIfAborted();
        if (await this.clearExpiredSession(params, error)) {
          return undefined;
        }
        throw error;
      }
    },
  });
  protected readonly addressKinds = addressKinds;
  protected readonly kindOptions = ['GENERAL', 'SHIPPING', 'BILLING'] as const;
  protected readonly textFields = [
    recipientField,
    line1Field,
    line2Field,
    cityField,
    postalCodeField,
    phoneField,
  ];
  protected readonly countries = computed(() => checkoutCountries(this.language()));
  private readonly countryNames = computed(
    () => new Intl.DisplayNames(this.language(), { type: 'region' }),
  );

  protected readonly form = this.fb.group({
    type: this.fb.control<CustomerAddressType>('GENERAL'),
    isDefault: false,
    recipient: ['', addressText(recipientField.maxLength)],
    line1: ['', addressText(line1Field.maxLength)],
    line2: ['', addressText(line2Field.maxLength, false)],
    phone: ['', addressText(phoneField.maxLength, false)],
    city: ['', addressText(cityField.maxLength)],
    postalCode: ['', addressText(postalCodeField.maxLength)],
    countryCode: [defaultCountryCode, Validators.pattern(/^[a-z]{2}$/i)],
  });
  protected readonly editor = signal<{ addressId: string | null } | null>(null);
  protected readonly removingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<AddressActionError | null>(null);

  constructor() {
    afterNextRender(() => this.heading()?.nativeElement.focus());
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.controls.isDefault.setValue(false);
    });
  }

  protected countryName(code: string) {
    return this.countryNames().of(code) ?? code;
  }

  protected unlistedCountry(code: string) {
    return code && !this.countries().some((country) => country.code === code);
  }

  protected addressLabel(address: Address) {
    const { recipient, line1, line2, postalCode, city, type } = address;
    const street = line2 ? `${line1}, ${line2}` : line1;
    return `${recipient} · ${street} · ${postalCode} ${city} · ${this.t()[addressKinds[type]]}`;
  }

  protected fieldError(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    return control.touched && control.invalid ? this.t().checkoutInvalidField : null;
  }

  protected openEditor(address?: Address) {
    this.removingId.set(null);
    this.actionError.set(null);
    this.form.reset(
      address
        ? { ...address, line2: address.line2 ?? '', phone: address.phone ?? '' }
        : emptyAddress,
      { emitEvent: false },
    );
    this.editor.set({ addressId: address?.id ?? null });
    afterNextRender(() => this.editorHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected confirmRemoval(addressId: string) {
    this.actionError.set(null);
    this.removingId.set(addressId);
    afterNextRender(() => this.confirmation()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected cancelAction() {
    const editor = this.editor();
    const addressId = editor ? editor.addressId : this.removingId();
    const openerId = addressId
      ? `address-${editor ? 'edit' : 'remove'}-${addressId}`
      : 'address-add';
    this.closeAction();
    afterNextRender(
      () => (this.document.getElementById(openerId) ?? this.heading()?.nativeElement)?.focus(),
      { injector: this.injector },
    );
  }

  protected save() {
    const editor = this.editor();
    this.form.markAllAsTouched();
    if (!editor || this.form.invalid) {
      this.focusInvalidField();
      return;
    }
    const input = this.form.getRawValue();
    return this.write(
      ({ shopId, shopperToken }) =>
        editor.addressId
          ? this.api.updateShopperAddress(shopId, shopperToken, editor.addressId, input)
          : this.api.createShopperAddress(shopId, shopperToken, input),
      'addressSaveFailed',
    );
  }

  protected setDefault(address: Address) {
    const { id, type, recipient, line1, line2, phone, city, postalCode, countryCode } = address;
    const input: CustomerAddressInput = {
      type,
      recipient,
      line1,
      line2,
      phone,
      city,
      postalCode,
      countryCode,
      isDefault: true,
    };
    return this.write(
      ({ shopId, shopperToken }) => this.api.updateShopperAddress(shopId, shopperToken, id, input),
      'addressDefaultFailed',
    );
  }

  protected remove(addressId: string) {
    return this.write(
      ({ shopId, shopperToken }) => this.api.removeShopperAddress(shopId, shopperToken, addressId),
      'addressRemoveFailed',
    );
  }

  private async write(
    send: (scope: AddressBookScope) => Promise<unknown>,
    failure: AddressActionError,
  ) {
    const scope = this.scope();
    if (!scope || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await send(scope);
      if (this.isActive(scope)) {
        this.closeAction();
        this.heading()?.nativeElement.focus();
        this.request.reload();
      }
    } catch (error) {
      if (!this.isActive(scope)) {
        return;
      }
      if (failure === 'addressSaveFailed' && this.showFieldErrors(error)) {
        this.focusInvalidField();
      } else if (!(await this.clearExpiredSession(scope, error)) && this.isActive(scope)) {
        this.actionError.set(failure);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private closeAction() {
    this.actionError.set(null);
    this.editor.set(null);
    this.removingId.set(null);
  }

  private showFieldErrors(error: unknown) {
    let shown = false;
    for (const { path } of storefrontFieldErrors(error)) {
      const control = this.form.get(path);
      if (control) {
        control.setErrors({ server: true });
        shown = true;
      }
    }
    return shown;
  }

  private async clearExpiredSession(scope: AddressBookScope, error: unknown) {
    const { shopId, shopperToken } = scope;
    if (this.cartState.expireSession(shopId, { shopperToken }, error)) {
      return true;
    }
    // The Router can mask the subgraph's authentication error.
    const shopper = await this.api.me(shopId, shopperToken).catch(() => undefined);
    return (
      shopper === null &&
      this.isActive(scope) &&
      this.cartState.clearShopperSession(shopId, shopperToken)
    );
  }

  private isActive(scope: AddressBookScope) {
    return !this.destroy.destroyed && this.scope() === scope;
  }

  private focusInvalidField() {
    afterNextRender(
      () =>
        this.formElement()
          ?.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}
