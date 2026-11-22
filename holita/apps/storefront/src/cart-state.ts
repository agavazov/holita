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
import { StorefrontApi, type StorefrontCredentials } from './storefront-api';
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

export type CartWriteError = 'cartUnavailable' | 'cartInsufficientStock' | 'cartUpdateFailed';
type CartWriteResult = 'ok' | 'expired' | CartWriteError;

function fieldProblem(error: unknown, code: string): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(({ extensions }) => {
      const fields = extensions?.['fieldErrors'];
      return (
        Array.isArray(fields) &&
        fields.some(
          (field: unknown) =>
            typeof field === 'object' && field !== null && 'code' in field && field.code === code,
        )
      );
    })
  );
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
        if (credentials.guestCartToken && fieldProblem(error, 'CART_NOT_FOUND')) {
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
    return this.write((shop, credentials) =>
      this.api.addCartLine(shop, credentials, variantId, quantity),
    );
  }

  update(lineId: string, quantity: number) {
    return this.write(async (shop, credentials) => ({
      cart: await this.api.updateCartLine(shop, credentials, lineId, quantity),
    }));
  }

  remove(lineId: string) {
    return this.write(async (shop, credentials) => ({
      cart: await this.api.removeCartLine(shop, credentials, lineId),
    }));
  }

  private credentials(shopId: string): StorefrontCredentials {
    const shopperToken = sessionStorage.getItem(shopperStorageKey(shopId));
    return shopperToken ? { shopperToken } : { guestCartToken: guestCartToken(shopId) };
  }

  private expireSession(shopId: string, credentials: StorefrontCredentials, error: unknown) {
    const key = shopperStorageKey(shopId);
    if (
      credentials.shopperToken &&
      sessionStorage.getItem(key) === credentials.shopperToken &&
      CombinedGraphQLErrors.is(error) &&
      error.errors.some(({ extensions }) => extensions?.['code'] === 'UNAUTHENTICATED')
    ) {
      sessionStorage.removeItem(key);
      this.sessionExpired.set(true);
      return true;
    }
    return false;
  }

  private async write(
    send: (
      shopId: string,
      credentials: StorefrontCredentials,
    ) => Promise<{
      cart: PublicCartFieldsFragment;
      guestCartToken?: string | null;
    }>,
  ): Promise<CartWriteResult> {
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
      if (credentials.guestCartToken && fieldProblem(error, 'CART_NOT_FOUND')) {
        forgetGuestCart(shop, credentials.guestCartToken);
        if (active()) {
          this.refreshOwner();
        }
      }
      if (fieldProblem(error, 'INSUFFICIENT_STOCK')) {
        return 'cartInsufficientStock';
      }
      return fieldProblem(error, 'UNAVAILABLE') ? 'cartUnavailable' : 'cartUpdateFailed';
    } finally {
      if (active()) {
        this.pending.set(false);
      }
    }
  }
}
