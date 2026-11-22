import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  PaymentMethodInput,
  QueryPaymentMethodsArgs,
  QueryShippingMethodsArgs,
  ShippingMethodInput,
} from '../generated/graphql/types.js';
import { Prisma, type ShippingMethod as StoredShippingMethod } from '../generated/prisma/client.js';
import { requireScope, type RequestContext } from '../scope.js';
import { ManualMethodsRepository } from './manual-methods.repository.js';

function invalid(path: string, message: string) {
  return new UnprocessableEntityException({
    message,
    fieldErrors: [{ path, code: 'INVALID_VALUE', message }],
  });
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Method ID must be a UUID');
  }
  return id.toLowerCase();
}

function pageArgs({ offset = 0, limit = 20, search }: QueryPaymentMethodsArgs) {
  if (offset < 0 || limit < 1 || limit > 100) {
    throw new BadRequestException('Invalid page');
  }
  const text = (search ?? '').trim();
  const words = text.split(/\s+/u).filter(Boolean);
  if (Array.from(text).length > 200 || words.length > 5 || text.includes('\u0000')) {
    throw new BadRequestException('Invalid search');
  }
  return { offset, limit, words };
}

function methodFields(input: Pick<PaymentMethodInput, 'label' | 'enabled' | 'sortOrder'>) {
  const label = input.label.trim();
  if (!label || Array.from(label).length > 200 || label.includes('\u0000')) {
    throw invalid('label', 'Enter a label with 1 to 200 characters');
  }
  if (input.sortOrder < 0) {
    throw invalid('sortOrder', 'Enter a non-negative sort order');
  }
  return { label, enabled: input.enabled, sortOrder: input.sortOrder };
}

async function updated<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new NotFoundException('Method not found');
    }
    throw error;
  }
}

function shippingMethod(row: StoredShippingMethod) {
  const { id, label, enabled, sortOrder, fixedFee } = row;
  return { id, label, enabled, sortOrder, fixedFee: fixedFee.toFixed(2) };
}

@Injectable()
export class ManualMethodsService {
  constructor(private readonly repository: ManualMethodsRepository) {}

  async listPaymentMethods(context: RequestContext, args: QueryPaymentMethodsArgs) {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = pageArgs(args);
    return this.repository.listPaymentMethods(scope, offset, limit, words);
  }

  async listShippingMethods(context: RequestContext, args: QueryShippingMethodsArgs) {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = pageArgs(args);
    const page = await this.repository.listShippingMethods(scope, offset, limit, words);
    return { ...page, items: page.items.map(shippingMethod) };
  }

  async findPaymentMethod(context: RequestContext, id: string) {
    return this.repository.findPaymentMethod(await requireScope(context, false), recordId(id));
  }

  async findShippingMethod(context: RequestContext, id: string) {
    const row = await this.repository.findShippingMethod(
      await requireScope(context, false),
      recordId(id),
    );
    return row && shippingMethod(row);
  }

  async savePaymentMethod(context: RequestContext, input: PaymentMethodInput, id?: string) {
    const scope = await requireScope(context, true);
    const fields = methodFields(input);
    const instructions = input.instructions.trim();
    if (!instructions || instructions.includes('\u0000')) {
      throw invalid('instructions', 'Enter payment instructions');
    }
    const data = { ...fields, instructions };
    return id === undefined
      ? this.repository.createPaymentMethod(scope, data)
      : updated(this.repository.updatePaymentMethod(scope, recordId(id), data));
  }

  async saveShippingMethod(context: RequestContext, input: ShippingMethodInput, id?: string) {
    const scope = await requireScope(context, true);
    const fields = methodFields(input);
    const fee = input.fixedFee.trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/u.test(fee)) {
      throw invalid('fixedFee', 'Enter a non-negative fee with up to two decimal places');
    }
    const data = { ...fields, fixedFee: new Prisma.Decimal(fee) };
    const row =
      id === undefined
        ? await this.repository.createShippingMethod(scope, data)
        : await updated(this.repository.updateShippingMethod(scope, recordId(id), data));
    return shippingMethod(row);
  }
}
