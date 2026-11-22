import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { OptionInput, OptionSort } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

type OptionFields = Omit<OptionInput, 'values'>;
type ValueFields = Pick<Prisma.OptionValueCreateWithoutOptionInput, 'label' | 'sortOrder'>;

function orderedValues(scope: Scope) {
  return {
    where: scope,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  } satisfies Prisma.Option$valuesArgs;
}

@Injectable()
export class OptionsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: OptionSort | null,
  ) {
    const where: Prisma.OptionWhereInput = {
      ...scope,
      AND: words.map((word) => ({ name: { contains: word, mode: 'insensitive' } })),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.OptionOrderByWithRelationInput =
      sort?.field === 'ACTIVE'
        ? { active: direction }
        : sort?.field === 'SHOW_IN_FILTERS'
          ? { showInFilters: direction }
          : { name: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.option.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          include: { values: orderedValues(scope) },
        }),
        this.database.client.option.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  productOptions(scope: Scope) {
    return this.database.client.option.findMany({
      where: scope,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { values: orderedValues(scope) },
    });
  }

  find(scope: Scope, id: string) {
    return this.database.client.option.findUnique({
      where: { ...scope, id },
      include: { values: orderedValues(scope) },
    });
  }

  create(scope: Scope, fields: OptionFields, values: ValueFields[]) {
    return this.database.client.option.create({
      data: { ...scope, ...fields, values: { create: values } },
      include: { values: orderedValues(scope) },
    });
  }

  update(
    scope: Scope,
    id: string,
    fields: OptionFields,
    values: (ValueFields & { id?: string })[],
  ) {
    return this.database.client.$transaction(
      async (tx) => {
        const existing = await tx.option.findUniqueOrThrow({
          where: { ...scope, id },
          select: { values: { where: scope, select: { id: true } } },
        });
        const existingIds = new Set(existing.values.map((value) => value.id));
        const invalidValueIndex = values.findIndex(
          (value) => value.id && !existingIds.has(value.id),
        );
        if (invalidValueIndex !== -1) {
          return { invalidValueIndex };
        }
        const create: ValueFields[] = [];
        const update: Prisma.OptionValueUpdateWithWhereUniqueWithoutOptionInput[] = [];
        const retainedIds = new Set<string>();
        for (const { id: valueId, ...data } of values) {
          if (valueId) {
            retainedIds.add(valueId);
            update.push({ where: { ...scope, optionId: id, id: valueId }, data });
          } else {
            create.push(data);
          }
        }
        const removedIds = existing.values
          .map((value) => value.id)
          .filter((id) => !retainedIds.has(id));
        const row = await tx.option.update({
          where: { ...scope, id },
          data: {
            ...fields,
            values: { deleteMany: { ...scope, id: { in: removedIds } }, create, update },
          },
          include: { values: orderedValues(scope) },
        });
        return { row };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
