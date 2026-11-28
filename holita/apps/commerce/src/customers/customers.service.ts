import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { invalidValue, normalizedCountryCode } from '../checkout/checkout.service.js';
import type {
  Customer,
  CustomerAddress,
  CustomerAddressInput,
  CustomerContactInput,
  CustomerDetail,
  CustomerPage,
  QueryCustomersArgs,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireMerchant, requireScope, type RequestContext, type ShopperScope } from '../scope.js';
import { ShopperRepository } from './shopper.repository.js';

type CustomerRow = Awaited<ReturnType<ShopperRepository['updateContact']>>;

function present({
  id,
  name,
  email,
  phone,
  createdAt,
  updatedAt,
  orders: [latest],
}: CustomerRow): Customer {
  return {
    id,
    name,
    email,
    phone,
    orderPhone: latest?.contactEmail === email ? latest.contactPhone : null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function recordId(path: string, id: string) {
  if (!isUUID(id)) {
    throw invalidValue(path);
  }
  return id.toLowerCase();
}

function textField(path: string, value: string, limit: number, required = true) {
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.includes('\u0000') || Array.from(trimmed).length > limit) {
    throw invalidValue(path);
  }
  return trimmed;
}

function addressFields(input: CustomerAddressInput) {
  return {
    recipient: textField('recipient', input.recipient, 200),
    line1: textField('line1', input.line1, 200),
    ...(input.line2 !== undefined && {
      line2: textField('line2', input.line2 ?? '', 200, false) || null,
    }),
    ...(input.phone !== undefined && {
      phone: textField('phone', input.phone ?? '', 50, false) || null,
    }),
    city: textField('city', input.city, 120),
    postalCode: textField('postalCode', input.postalCode, 20),
    countryCode: normalizedCountryCode('countryCode', input.countryCode),
  };
}

function missingRecord(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2025' || error.code === 'P2018')
  ) {
    throw new NotFoundException(message);
  }
  throw error;
}

@Injectable()
export class CustomersService {
  constructor(private readonly shoppers: ShopperRepository) {}

  async list(
    context: RequestContext,
    { offset = 0, limit = 20, search: rawSearch }: QueryCustomersArgs,
  ): Promise<CustomerPage> {
    const scope = await requireScope(context, false);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const search = (rawSearch ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    return this.shoppers.customers(scope, offset, limit, words);
  }

  async contact(context: RequestContext, id: string) {
    const scope = await requireScope(context, false);
    return isUUID(id) ? this.shoppers.customerContact(scope, id.toLowerCase()) : null;
  }

  async find(context: RequestContext, id: string): Promise<CustomerDetail | null> {
    const scope = await requireScope(context, false);
    if (!isUUID(id)) {
      return null;
    }
    const row = await this.shoppers.customer(scope, id.toLowerCase());
    return row ? { customer: present(row), addresses: row.addresses } : null;
  }

  async exportData(context: RequestContext, customerId: string): Promise<string> {
    const { scope, userId } = await requireMerchant(context, true);
    const key = recordId('customerId', customerId);
    const result = await this.shoppers.exportCustomerData(scope, key, userId);
    if (!result) {
      throw new NotFoundException('Customer not found');
    }
    const {
      exportedAt,
      customer: { id, email, name, phone, createdAt, addresses, orders },
      otherCustomerEmails,
    } = result;
    const canExportContact = ({ contactEmail }: { contactEmail: string }) =>
      !otherCustomerEmails.has(contactEmail.toLowerCase());
    return JSON.stringify({
      exportedAt,
      customer: { id, email, fullName: name, phone, createdAt },
      addresses: addresses.map((address) => ({
        addressType: address.type,
        fullName: address.recipient,
        phone: address.phone,
        countryCode: address.countryCode,
        city: address.city,
        postcode: address.postalCode,
        addressLine1: address.line1,
        addressLine2: address.line2,
      })),
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        ...(canExportContact(order) && {
          customerEmail: order.contactEmail,
          customerFullName: order.contactName,
          customerPhone: order.contactPhone,
        }),
        currencyCode: order.currency,
        totalAmount: order.total.toFixed(2),
        placedAt: order.placedAt,
      })),
      orderAddresses: orders.filter(canExportContact).flatMap((order) => {
        const shipping = {
          orderNumber: order.orderNumber,
          addressType: 'SHIPPING',
          fullName: order.contactName,
          phone: order.contactPhone,
          countryCode: order.shippingCountryCode,
          city: order.shippingCity,
          postcode: order.shippingPostalCode,
          addressLine1: order.shippingLine1,
          addressLine2: order.shippingLine2,
        };
        if (order.billingName === null) {
          return [shipping];
        }
        return [
          shipping,
          {
            orderNumber: order.orderNumber,
            addressType: 'BILLING',
            fullName: order.billingName,
            phone: order.billingPhone,
            countryCode: order.billingCountryCode,
            city: order.billingCity,
            postcode: order.billingPostalCode,
            addressLine1: order.billingLine1,
            addressLine2: order.billingLine2,
          },
        ];
      }),
    });
  }

  async updateContact(
    context: RequestContext,
    id: string,
    input: CustomerContactInput,
  ): Promise<Customer> {
    const scope = await requireScope(context, true);
    const key = recordId('id', id);
    const name = textField('name', input.name, 200);
    const phone =
      input.phone === undefined
        ? {}
        : {
            phone: textField('phone', input.phone ?? '', 50, false) || null,
          };
    const row = await this.shoppers
      .updateContact(scope, key, { name, ...phone })
      .catch((error: unknown) => missingRecord(error, 'Customer not found'));
    return present(row);
  }

  addresses(owner: ShopperScope): Promise<CustomerAddress[]> {
    return this.shoppers.addresses(owner);
  }

  async saveAddress(
    scope: ShopperScope,
    input: CustomerAddressInput,
    addressId?: string,
  ): Promise<CustomerAddress> {
    const owner = { ...scope, customerId: recordId('customerId', scope.customerId) };
    const id = addressId === undefined ? undefined : recordId('addressId', addressId);
    const fields = addressFields(input);
    return this.shoppers
      .transaction(async (tx) => {
        await this.shoppers.lockAddressBook(tx, owner);
        const previous = id ? await this.shoppers.address(tx, owner, id) : null;
        const type = input.type ?? previous?.type ?? 'GENERAL';
        const isDefault =
          input.isDefault ?? (previous?.isDefault === true && previous.type === type);
        if (isDefault) {
          if (type === 'GENERAL') {
            throw invalidValue('isDefault');
          }
          await this.shoppers.clearAddressDefault(tx, owner, type, id);
        }
        const data = { ...fields, type, isDefault };
        return id
          ? this.shoppers.updateAddress(tx, owner, id, data)
          : this.shoppers.createAddress(tx, owner, data);
      })
      .catch((error: unknown) =>
        missingRecord(error, id ? 'Customer address not found' : 'Customer not found'),
      );
  }

  async removeAddress(scope: ShopperScope, addressId: string): Promise<boolean> {
    const owner = { ...scope, customerId: recordId('customerId', scope.customerId) };
    const id = recordId('addressId', addressId);
    await this.shoppers
      .removeAddress(owner, id)
      .catch((error: unknown) => missingRecord(error, 'Customer address not found'));
    return true;
  }
}
