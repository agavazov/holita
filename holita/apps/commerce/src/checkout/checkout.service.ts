import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { normalizedEmail, userName } from '@osnova/auth';
import { isUUID } from 'class-validator';
import { CartPrice, CartService, type CartContext } from '../cart/cart.service.js';
import type {
  CheckoutQuote,
  CheckoutQuoteInput,
  CheckoutState,
} from '../generated/graphql/storefront-types.js';
import { CheckoutRepository } from './checkout.repository.js';

const checkoutCurrency = 'BGN';

function checkoutError(path: string, code: string, message: string) {
  return new UnprocessableEntityException({ message, fieldErrors: [{ path, code, message }] });
}

function invalidValue(path: string) {
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

function validateCheckoutInput(input: CheckoutQuoteInput) {
  const address = input.shippingAddress;
  const countryCode = address.countryCode.trim();
  if (!/^[a-z]{2}$/i.test(countryCode)) {
    throw invalidValue('shippingAddress.countryCode');
  }
  return {
    contact: {
      name: contactField('contact.name', input.contact.name, userName),
      email: contactField('contact.email', input.contact.email, normalizedEmail),
      phone: trimmedField('contact.phone', input.contact.phone),
    },
    shippingAddress: {
      countryCode: countryCode.toUpperCase(),
      city: trimmedField('shippingAddress.city', address.city),
      postalCode: trimmedField('shippingAddress.postalCode', address.postalCode),
      line1: trimmedField('shippingAddress.line1', address.line1),
      line2: trimmedField('shippingAddress.line2', address.line2 ?? '', false) || null,
    },
    paymentMethodId: methodId('paymentMethodId', input.paymentMethodId),
    shippingMethodId: methodId('shippingMethodId', input.shippingMethodId),
  };
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly methods: CheckoutRepository,
    private readonly carts: CartService,
  ) {}

  read(context: CartContext): Promise<CheckoutState | null> {
    return this.methods.readTransaction(async (tx) => {
      const cart = await this.carts.readInTransaction(tx, context);
      if (!cart.lines.length) {
        return null;
      }
      const paymentMethods = await this.methods.paymentMethods(tx, context.scope);
      const shippingMethods = await this.methods.shippingMethods(tx, context.scope);
      return {
        cart,
        currency: checkoutCurrency,
        paymentMethods,
        shippingMethods: shippingMethods.map((method) => ({
          ...method,
          fixedFee: method.fixedFee.toFixed(2),
        })),
      };
    });
  }

  quote(context: CartContext, input: CheckoutQuoteInput): Promise<CheckoutQuote> {
    return this.methods.readTransaction(async (tx) => {
      const cart = await this.carts.readInTransaction(tx, context);
      if (!cart.lines.length) {
        throw checkoutError('cart', 'CHECKOUT_EMPTY_CART', 'The cart is empty');
      }
      if (cart.lines.some(({ available }) => !available)) {
        throw checkoutError('cart', 'CHECKOUT_CART_CHANGED', 'Review the cart before checkout');
      }
      const { paymentMethodId, shippingMethodId } = validateCheckoutInput(input);
      const paymentMethod = await this.methods.paymentMethod(tx, context.scope, paymentMethodId);
      if (!paymentMethod) {
        throw invalidMethod('paymentMethodId');
      }
      const shippingMethod = await this.methods.shippingMethod(tx, context.scope, shippingMethodId);
      if (!shippingMethod) {
        throw invalidMethod('shippingMethodId');
      }
      const shippingFee = shippingMethod.fixedFee.toFixed(2);
      return {
        lines: cart.lines,
        paymentMethod,
        shippingMethod: { ...shippingMethod, fixedFee: shippingFee },
        currency: checkoutCurrency,
        subtotal: cart.subtotal,
        shippingFee,
        total: new CartPrice(cart.subtotal).plus(shippingFee).toFixed(2),
      };
    });
  }
}
