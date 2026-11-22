import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type {
  CharacteristicGroupInput,
  CharacteristicGroupSort,
  CharacteristicInput,
  ProductCharacteristicValueInput,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { catalogueProductWhere } from '../products/product-relations.js';
import type { Scope } from '../scope.js';

type GroupFields = Omit<CharacteristicGroupInput, 'characteristics'>;

const byOrder = [
  { sortOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.CharacteristicOrderByWithRelationInput[];

function orderedCharacteristics(scope: Scope, activeOnly = false) {
  return {
    where: { ...scope, ...(activeOnly ? { active: true } : {}) },
    orderBy: byOrder,
  } satisfies Prisma.CharacteristicGroup$characteristicsArgs;
}

@Injectable()
export class CharacteristicsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: CharacteristicGroupSort | null,
  ) {
    const where: Prisma.CharacteristicGroupWhereInput = {
      ...scope,
      AND: words.map((word) => ({ name: { contains: word, mode: 'insensitive' } })),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.CharacteristicGroupOrderByWithRelationInput =
      sort?.field === 'NAME' ? { name: direction } : { sortOrder: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.characteristicGroup.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          include: { characteristics: orderedCharacteristics(scope) },
        }),
        this.database.client.characteristicGroup.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find(scope: Scope, id: string) {
    return this.database.client.characteristicGroup.findUnique({
      where: { ...scope, id },
      include: { characteristics: orderedCharacteristics(scope) },
    });
  }

  create(scope: Scope, fields: GroupFields, characteristics: Omit<CharacteristicInput, 'id'>[]) {
    return this.database.client.characteristicGroup.create({
      data: { ...scope, ...fields, characteristics: { create: characteristics } },
      include: { characteristics: orderedCharacteristics(scope) },
    });
  }

  update(scope: Scope, id: string, fields: GroupFields, characteristics: CharacteristicInput[]) {
    return this.database.client.$transaction(
      async (tx) => {
        const existing = await tx.characteristicGroup.findUniqueOrThrow({
          where: { ...scope, id },
          select: { characteristics: { where: scope, select: { id: true, name: true } } },
        });
        const existingIds = new Set(existing.characteristics.map((item) => item.id));
        const submittedIds = new Set(characteristics.map((item) => item.id));
        const omittedNames = new Set(
          existing.characteristics
            .filter((item) => !submittedIds.has(item.id))
            .map((item) => item.name.toLowerCase()),
        );
        const create: Omit<CharacteristicInput, 'id'>[] = [];
        const update: Prisma.CharacteristicUpdateWithWhereUniqueWithoutGroupInput[] = [];
        for (const [index, { id: characteristicId, ...data }] of characteristics.entries()) {
          if (omittedNames.has(data.name.toLowerCase())) {
            return { duplicateNameIndex: index };
          }
          if (characteristicId) {
            if (!existingIds.has(characteristicId)) {
              return { invalidIdIndex: index };
            }
            update.push({ where: { ...scope, groupId: id, id: characteristicId }, data });
          } else {
            create.push(data);
          }
        }
        const row = await tx.characteristicGroup.update({
          where: { ...scope, id },
          data: { ...fields, characteristics: { create, update } },
          include: { characteristics: orderedCharacteristics(scope) },
        });
        return { row };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  productCharacteristics(scope: Scope, productId?: string) {
    return this.database.client.$transaction(
      async (tx) => {
        const groups = await tx.characteristicGroup.findMany({
          where: { ...scope, active: true, characteristics: { some: { ...scope, active: true } } },
          orderBy: byOrder,
          include: { characteristics: orderedCharacteristics(scope, true) },
        });
        const values = productId
          ? await tx.productCharacteristicValue.findMany({
              where: {
                ...scope,
                productId,
                characteristicId: {
                  in: groups.flatMap((group) => group.characteristics.map(({ id }) => id)),
                },
              },
              select: { characteristicId: true, value: true },
            })
          : [];
        return { groups, values };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async patchProductValues(
    tx: Prisma.TransactionClient,
    scope: Scope & { productId: string },
    values: ProductCharacteristicValueInput[],
  ) {
    const { tenantId, branchId } = scope;
    const definitions = await tx.characteristic.findMany({
      where: {
        tenantId,
        branchId,
        id: { in: values.map(({ characteristicId }) => characteristicId) },
      },
      select: { id: true },
    });
    const ids = new Set(definitions.map(({ id }) => id));
    const invalidIndex = values.findIndex(({ characteristicId }) => !ids.has(characteristicId));
    if (invalidIndex !== -1) {
      throw new InvalidCharacteristicIdError(invalidIndex);
    }
    for (const { characteristicId, value } of values) {
      const key = { ...scope, characteristicId };
      if (value) {
        await tx.productCharacteristicValue.upsert({
          where: { tenantId_branchId_productId_characteristicId: key },
          create: { ...key, value },
          update: { value },
        });
      } else {
        await tx.productCharacteristicValue.deleteMany({ where: key });
      }
    }
  }

  async publicSpecifications(scope: Scope, productId: string) {
    const characteristics = { ...scope, active: true };
    const productValues = {
      ...scope,
      productId,
      value: { not: '' },
      product: catalogueProductWhere(scope),
    };
    const groups = await this.database.client.characteristicGroup.findMany({
      where: {
        ...scope,
        active: true,
        characteristics: { some: { ...characteristics, productValues: { some: productValues } } },
      },
      orderBy: byOrder,
      select: {
        name: true,
        characteristics: {
          where: { ...characteristics, productValues: { some: productValues } },
          orderBy: byOrder,
          select: { name: true, productValues: { where: productValues, select: { value: true } } },
        },
      },
    });
    return groups.flatMap(({ name, characteristics }) => {
      const values = characteristics.flatMap((item) =>
        item.productValues
          .filter(({ value }) => value.trim())
          .map(({ value }) => ({ name: item.name, value })),
      );
      return values.length ? [{ name, values }] : [];
    });
  }
}

export class InvalidCharacteristicIdError extends Error {
  constructor(readonly index: number) {
    super('Choose a characteristic from this shop');
  }
}
