import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { StorefrontApi, storefrontFieldErrors, type StorefrontCredentials } from './storefront-api';
import type { PublicCartFieldsFragment } from './generated/operations';

export const maxCartQuantity = 2_147_483_647;

export function quantityControl(quantity: number) {
  return new FormControl<number | null>(quantity, [
    (control) => Validators.required(control),
    Validators.min(1),
    Validators.max(maxCartQuantity),
    (control) => (Number.isInteger(control.value) ? null : { integer: true }),
  ]);
}

export function shopperStorageKey(shopId: string) {
  return `holita.shopper.${shopId}`;
}

function guestCartStorageKey(shopId: string) {
  return `holita.cart.${shopId}`;
}

export function guestCartToken(shopId: string) {
  return localStorage.getItem(guestCartStorageKey(shopId));
}

export function forgetGuestCart(shopId: string, token: string | null) {
  if (token && guestCartToken(shopId) === token) {
    localStorage.removeItem(guestCartStorageKey(shopId));
  }
}

function guestReceiptStorageKey(shopId: string, orderId: string) {
  return `holita.receipt.${shopId}.${orderId}`;
}

export function guestReceiptToken(shopId: string, orderId: string) {
  return localStorage.getItem(guestReceiptStorageKey(shopId, orderId));
}

export function rememberGuestReceipt(shopId: string, orderId: string, token: string) {
  localStorage.setItem(guestReceiptStorageKey(shopId, orderId), token);
  forgetGuestCart(shopId, token);
}

export type CartWriteError = 'cartUnavailable' | 'cartInsufficientStock' | 'cartUpdateFailed';
type CartDiscount = NonNullable<PublicCartFieldsFragment['discount']>;

export const promoProblems = {
  INVALID: 'promoInvalid',
  NOT_STARTED: 'promoNotStarted',
  EXPIRED: 'promoExpired',
  MINIMUM_NOT_MET: 'promoMinimumNotMet',
  EXHAUSTED: 'promoExhausted',
} as const satisfies Record<NonNullable<CartDiscount['issue']>, string>;
export type PromoProblem = (typeof promoProblems)[keyof typeof promoProblems];
export type PromoWriteError = PromoProblem | 'promoUpdateFailed';

export function promoRejection(code: string): PromoProblem | null {
  return Object.entries(promoProblems).find(([issue]) => code === `PROMO_${issue}`)?.[1] ?? null;
}

function cartWriteError(error: unknown): CartWriteError {
  const fields = storefrontFieldErrors(error);
  if (fields.some(({ code }) => code === 'INSUFFICIENT_STOCK')) {
    return 'cartInsufficientStock';
  }
  return fields.some(({ code }) => code === 'UNAVAILABLE') ? 'cartUnavailable' : 'cartUpdateFailed';
}

function promoWriteError(error: unknown): PromoWriteError {
  return (
    storefrontFieldErrors(error)
      .map(({ code }) => promoRejection(code))
      .find((problem) => problem !== null) ?? 'promoUpdateFailed'
  );
}

function cartNotFound(error: unknown): boolean {
  return storefrontFieldErrors(error).some(({ code }) => code === 'CART_NOT_FOUND');
}

@Injectable()
export class CartState {
  private readonly api = inject(StorefrontApi);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly shopId = computed(() => this.params().get('shopId') ?? '');
  private readonly ownerChange = signal(0);
  readonly sessionExpired = linkedSignal({ source: this.shopId, computation: () => false });
  readonly shopperToken = computed(() => {
    this.ownerChange();
    return this.sessionExpired() ? null : sessionStorage.getItem(shopperStorageKey(this.shopId()));
  });
  readonly pending = linkedSignal({ source: this.shopId, computation: () => false });

  private readonly request = resource({
    params: () => ({ shopId: this.shopId(), ownerChange: this.ownerChange() }),
    loader: async ({ params: { shopId }, abortSignal }) => {
      const credentials = this.credentials(shopId);
      try {
        return await this.api.cart(shopId, credentials);
      } catch (error) {
        abortSignal.throwIfAborted();
        if (this.expireSession(shopId, credentials, error)) {
          return null;
        }
        if (credentials.guestCartToken && cartNotFound(error)) {
          forgetGuestCart(shopId, credentials.guestCartToken);
          return this.api.cart(shopId, this.credentials(shopId));
        }
        throw error;
      }
    },
  });
  readonly cart = computed(() => (this.request.hasValue() ? this.request.value() : null));
  readonly loading = this.request.isLoading;
  readonly loadFailed = computed(() => this.request.status() === 'error');
  readonly locked = computed(() => this.pending() || this.loading() || this.sessionExpired());

  refresh(): void {
    this.request.reload();
  }

  refreshOwner(): void {
    this.sessionExpired.set(false);
    this.ownerChange.update((generation) => generation + 1);
  }

  add(variantId: string, quantity: number) {
    return this.write(
      (shop, credentials) => this.api.addCartLine(shop, credentials, variantId, quantity),
      cartWriteError,
    );
  }

  update(lineId: string, quantity: number) {
    return this.write(
      async (shop, credentials) => ({
        cart: await this.api.updateCartLine(shop, credentials, lineId, quantity),
      }),
      cartWriteError,
    );
  }

  remove(lineId: string) {
    return this.write(
      async (shop, credentials) => ({
        cart: await this.api.removeCartLine(shop, credentials, lineId),
      }),
      cartWriteError,
    );
  }

  applyDiscount(code: string) {
    return this.write(
      async (shop, credentials) => ({
        cart: await this.api.applyCartDiscount(shop, credentials, code),
      }),
      promoWriteError,
    );
  }

  removeDiscount() {
    return this.write(
      async (shop, credentials) => ({
        cart: await this.api.removeCartDiscount(shop, credentials),
      }),
      promoWriteError,
    );
  }

  credentials(shopId: string): StorefrontCredentials {
    const shopperToken = sessionStorage.getItem(shopperStorageKey(shopId));
    return shopperToken ? { shopperToken } : { guestCartToken: guestCartToken(shopId) };
  }

  expireSession(shopId: string, credentials: StorefrontCredentials, error: unknown) {
    return Boolean(
      credentials.shopperToken &&
      CombinedGraphQLErrors.is(error) &&
      error.errors.some(({ extensions }) => extensions?.['code'] === 'UNAUTHENTICATED') &&
      this.clearShopperSession(shopId, credentials.shopperToken),
    );
  }

  clearShopperSession(shopId: string, shopperToken: string) {
    const key = shopperStorageKey(shopId);
    if (shopId !== this.shopId() || sessionStorage.getItem(key) !== shopperToken) {
      return false;
    }
    sessionStorage.removeItem(key);
    this.sessionExpired.set(true);
    return true;
  }

  private async write<Failure extends string>(
    send: (
      shopId: string,
      credentials: StorefrontCredentials,
    ) => Promise<{
      cart: PublicCartFieldsFragment;
      guestCartToken?: string | null;
    }>,
    writeError: (error: unknown) => Failure,
  ): Promise<'ok' | 'expired' | Failure> {
    this.pending.set(true);
    const shop = this.shopId();
    const credentials = this.credentials(shop);
    const active = () => !this.destroy.destroyed && this.shopId() === shop;
    try {
      const result = await send(shop, credentials);
      if (result.guestCartToken && !guestCartToken(shop)) {
        localStorage.setItem(guestCartStorageKey(shop), result.guestCartToken);
      }
      if (active()) {
        this.request.set(result.cart);
      }
      return 'ok';
    } catch (error) {
      if (active() && this.expireSession(shop, credentials, error)) {
        this.request.set(null);
        return 'expired';
      }
      if (credentials.guestCartToken && cartNotFound(error)) {
        forgetGuestCart(shop, credentials.guestCartToken);
        if (active()) {
          this.refreshOwner();
        }
      }
      return writeError(error);
    } finally {
      if (active()) {
        this.pending.set(false);
      }
    }
  }
}
