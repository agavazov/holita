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
import { requireScope, type RequestContext } from '../scope.js';
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

  async createAddress(
    context: RequestContext,
    customerId: string,
    input: CustomerAddressInput,
  ): Promise<CustomerAddress> {
    const scope = await requireScope(context, true);
    const key = recordId('customerId', customerId);
    return this.shoppers
      .createAddress(scope, key, addressFields(input))
      .catch((error: unknown) => missingRecord(error, 'Customer not found'));
  }

  async updateAddress(
    context: RequestContext,
    customerId: string,
    id: string,
    input: CustomerAddressInput,
  ): Promise<CustomerAddress> {
    const scope = await requireScope(context, true);
    const customerKey = recordId('customerId', customerId);
    const addressKey = recordId('addressId', id);
    return this.shoppers
      .updateAddress(scope, customerKey, addressKey, addressFields(input))
      .catch((error: unknown) => missingRecord(error, 'Customer address not found'));
  }
}
