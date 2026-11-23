import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { normalizedEmail, userName } from '@osnova/auth';
import { isUUID } from 'class-validator';
import { hash } from 'node:crypto';
import { CartRepository, type CartSelection } from '../cart/cart.repository.js';
import { CartPrice, CartService, type CartContext } from '../cart/cart.service.js';
import { promoError } from '../discounts/discounts.service.js';
import type {
  Cart,
  CheckoutQuote,
  CheckoutQuoteInput,
  CheckoutState,
} from '../generated/graphql/storefront-types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ManualMethodsRepository } from '../manual-methods/manual-methods.repository.js';
import type { Scope } from '../scope.js';
import { checkoutCurrency } from './currency.js';

export function checkoutError(path: string, code: string, message: string) {
  return new UnprocessableEntityException({ message, fieldErrors: [{ path, code, message }] });
}

export function invalidValue(path: string) {
  return checkoutError(path, 'INVALID_VALUE', 'Enter a valid value');
}

function contactField(path: string, value: string, validate: (value: string) => string) {
  try {
    return validate(value);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw invalidValue(path);
    }
    throw error;
  }
}

function trimmedField(path: string, value: string, required = true) {
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.includes('\u0000')) {
    throw invalidValue(path);
  }
  return trimmed;
}

function invalidMethod(path: 'paymentMethodId' | 'shippingMethodId') {
  return checkoutError(path, 'INVALID_METHOD', 'Choose an available checkout method');
}

function methodId(path: 'paymentMethodId' | 'shippingMethodId', id: string) {
  if (!isUUID(id)) {
    throw invalidMethod(path);
  }
  return id.toLowerCase();
}

export function normalizedCountryCode(path: string, value: string) {
  const countryCode = value.trim();
  if (!/^[a-z]{2}$/i.test(countryCode)) {
    throw invalidValue(path);
  }
  return countryCode.toUpperCase();
}

export function validateOrderContact(
  input: Pick<CheckoutQuoteInput, 'contact' | 'shippingAddress'>,
) {
  const address = input.shippingAddress;
  const countryCode = normalizedCountryCode('shippingAddress.countryCode', address.countryCode);
  return {
    contact: {
      name: contactField('contact.name', input.contact.name, userName),
      email: contactField('contact.email', input.contact.email, normalizedEmail),
      phone: trimmedField('contact.phone', input.contact.phone),
    },
    shippingAddress: {
      countryCode,
      city: trimmedField('shippingAddress.city', address.city),
      postalCode: trimmedField('shippingAddress.postalCode', address.postalCode),
      line1: trimmedField('shippingAddress.line1', address.line1),
      line2: trimmedField('shippingAddress.line2', address.line2 ?? '', false) || null,
    },
  };
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly methods: ManualMethodsRepository,
    private readonly cartRepository: CartRepository,
    private readonly carts: CartService,
  ) {}

  read(context: CartContext): Promise<CheckoutState | null> {
    return this.cartRepository.readTransaction(async (tx) => {
      const ownedCart = await this.carts.readOwned(tx, context);
      if (!ownedCart?.cart.lines.length) {
        return null;
      }
      return { cart: ownedCart.cart, ...(await this.enabledMethods(tx, context.scope)) };
    });
  }

  async enabledMethods(tx: Prisma.TransactionClient, scope: Scope) {
    const paymentMethods = await this.methods.paymentMethods(tx, scope);
    const shippingMethods = await this.methods.shippingMethods(tx, scope);
    return {
      currency: checkoutCurrency,
      paymentMethods,
      shippingMethods: shippingMethods.map((method) => ({
        ...method,
        fixedFee: method.fixedFee.toFixed(2),
      })),
    };
  }

  paymentMethodId(id: string) {
    return methodId('paymentMethodId', id);
  }

  shippingMethodId(id: string) {
    return methodId('shippingMethodId', id);
  }

  async paymentMethod(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    const method = await this.methods.paymentMethod(tx, scope, id);
    if (!method) {
      throw invalidMethod('paymentMethodId');
    }
    return method;
  }

  async shippingMethod(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    const method = await this.methods.shippingMethod(tx, scope, id);
    if (!method) {
      throw invalidMethod('shippingMethodId');
    }
    return method;
  }

  quote(context: CartContext, input: CheckoutQuoteInput): Promise<CheckoutQuote> {
    return this.cartRepository.readTransaction(async (tx) => {
      const ownedCart = await this.carts.readOwned(tx, context);
      if (!ownedCart) {
        throw checkoutError('cart', 'CHECKOUT_EMPTY_CART', 'The cart is empty');
      }
      const review = await this.quoteCart(tx, context.scope, ownedCart, input);
      return review.quote;
    });
  }

  async quoteCart(
    tx: Prisma.TransactionClient,
    scope: Scope,
    { id: cartId, discountId, cart }: CartSelection & { cart: Cart },
    input: CheckoutQuoteInput,
  ) {
    if (!cart.lines.length) {
      throw checkoutError('cart', 'CHECKOUT_EMPTY_CART', 'The cart is empty');
    }
    if (cart.lines.some(({ issue }) => issue === 'MINIMUM_QUANTITY_NOT_MET')) {
      throw checkoutError(
        'cart',
        'MINIMUM_QUANTITY_NOT_MET',
        'A cart line is below the minimum quantity for its variant',
      );
    }
    if (cart.lines.some(({ available }) => !available)) {
      throw checkoutError('cart', 'CHECKOUT_CART_CHANGED', 'Review the cart before checkout');
    }
    if (cart.discount?.issue) {
      throw promoError(cart.discount.issue);
    }
    const { contact, shippingAddress } = validateOrderContact(input);
    const paymentMethod = await this.paymentMethod(
      tx,
      scope,
      this.paymentMethodId(input.paymentMethodId),
    );
    const shippingMethod = await this.shippingMethod(
      tx,
      scope,
      this.shippingMethodId(input.shippingMethodId),
    );
    const shippingFee = shippingMethod.fixedFee.toFixed(2);
    const discountCode = cart.discount?.code ?? null;
    const discountAmount = cart.discount?.amount ?? '0.00';
    const terms = [
      cartId,
      cart.lines.map(({ variantId, quantity, unitPrice, name, optionLabels }) => [
        variantId,
        quantity,
        unitPrice,
        name,
        optionLabels,
      ]),
      [paymentMethod.id, paymentMethod.label, paymentMethod.instructions],
      [shippingMethod.id, shippingMethod.label, shippingFee],
      [discountId, discountCode, discountAmount],
      checkoutCurrency,
    ];
    const quote: CheckoutQuote = {
      cartId,
      quoteRevision: hash('sha256', JSON.stringify(terms), 'hex'),
      lines: cart.lines,
      paymentMethod,
      shippingMethod: { ...shippingMethod, fixedFee: shippingFee },
      currency: checkoutCurrency,
      subtotal: cart.subtotal,
      discountCode,
      discountAmount,
      shippingFee,
      total: new CartPrice(cart.discountedSubtotal).plus(shippingFee).toFixed(2),
    };
    return { quote, contact, shippingAddress };
  }
}
