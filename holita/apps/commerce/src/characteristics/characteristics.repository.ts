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
const byChoiceName = [
  { name: 'asc' },
  { id: 'asc' },
] satisfies Prisma.CharacteristicChoiceOrderByWithRelationInput[];

function groupRelations(scope: Scope, activeOnly = false) {
  return {
    categories: {
      where: scope,
      orderBy: { categoryId: 'asc' },
      select: { categoryId: true },
    },
    characteristics: {
      where: { ...scope, ...(activeOnly ? { active: true } : {}) },
      orderBy: byOrder,
      include: {
        choices: { where: scope, orderBy: byChoiceName, select: { id: true, name: true } },
      },
    },
  } satisfies Prisma.CharacteristicGroupInclude;
}

type GroupRow = Prisma.CharacteristicGroupGetPayload<{
  include: ReturnType<typeof groupRelations>;
}>;

function groupView({ categories, ...group }: GroupRow) {
  return { ...group, categoryIds: categories.map(({ categoryId }) => categoryId) };
}

function applicableGroup(scope: Scope, categoryId: string | null) {
  return {
    ...scope,
    active: true,
    OR: [
      { categories: { none: scope } },
      ...(categoryId ? [{ categories: { some: { ...scope, categoryId } } }] : []),
    ],
  } satisfies Prisma.CharacteristicGroupWhereInput;
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
          include: groupRelations(scope),
        }),
        this.database.client.characteristicGroup.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items: items.map(groupView), total, offset, limit };
  }

  async find(scope: Scope, id: string) {
    const group = await this.database.client.characteristicGroup.findUnique({
      where: { ...scope, id },
      include: groupRelations(scope),
    });
    return group ? groupView(group) : null;
  }

  save(
    scope: Scope,
    id: string | undefined,
    { categoryIds, ...fields }: GroupFields,
    characteristics: CharacteristicInput[],
  ) {
    return this.database.client.$transaction(
      async (tx) => {
        if (categoryIds?.length) {
          const count = await tx.category.count({ where: { ...scope, id: { in: categoryIds } } });
          if (count !== categoryIds.length) {
            throw new InvalidCharacteristicDefinitionError(
              'categoryIds',
              'Choose categories from this shop',
            );
          }
        }
        const group = id
          ? await tx.characteristicGroup.update({
              where: { ...scope, id },
              data: fields,
              include: groupRelations(scope),
            })
          : await tx.characteristicGroup.create({
              data: { ...scope, ...fields },
              include: groupRelations(scope),
            });
        const groupScope = { ...scope, groupId: group.id };
        if (categoryIds) {
          await tx.characteristicGroupCategory.deleteMany({ where: groupScope });
          if (categoryIds.length) {
            await tx.characteristicGroupCategory.createMany({
              data: categoryIds.map((categoryId) => ({ ...groupScope, categoryId })),
            });
          }
        }

        const existing = new Map(group.characteristics.map((item) => [item.id, item]));
        const submittedIds = new Set(characteristics.map((item) => item.id));
        const omittedNames = new Set(
          group.characteristics
            .filter((item) => !submittedIds.has(item.id))
            .map((item) => item.name.toLowerCase()),
        );
        for (const [
          index,
          { id: characteristicId, kind, choices, ...data },
        ] of characteristics.entries()) {
          const path = `characteristics.${String(index)}`;
          if (omittedNames.has(data.name.toLowerCase())) {
            throw new InvalidCharacteristicDefinitionError(
              `${path}.name`,
              'This group already uses the characteristic name',
              'DUPLICATE_VALUE',
            );
          }
          const saved = characteristicId ? existing.get(characteristicId) : undefined;
          if (characteristicId && !saved) {
            throw new InvalidCharacteristicDefinitionError(
              `${path}.id`,
              'Choose a characteristic from this group',
            );
          }
          if (kind && saved && kind !== saved.kind) {
            throw new InvalidCharacteristicDefinitionError(
              `${path}.kind`,
              'The kind of an existing characteristic cannot change',
            );
          }
          const fieldKind = saved?.kind ?? kind ?? 'TEXT';
          if (fieldKind === 'TEXT' && choices?.length) {
            throw new InvalidCharacteristicDefinitionError(
              `${path}.kind`,
              'Text characteristics cannot have choices',
            );
          }

          const field = saved
            ? await tx.characteristic.update({ where: { ...groupScope, id: saved.id }, data })
            : await tx.characteristic.create({ data: { ...groupScope, ...data, kind: fieldKind } });
          const fieldScope = { ...scope, characteristicId: field.id };
          const savedChoices = saved?.choices ?? [];
          const choiceIds = new Set(choices?.map((choice) => choice.id));
          const choiceNames = new Set(
            savedChoices
              .filter((choice) => !choiceIds.has(choice.id))
              .map(({ name }) => name.toLowerCase()),
          );
          for (const [choiceIndex, choice] of (choices ?? []).entries()) {
            const choicePath = `${path}.choices.${String(choiceIndex)}`;
            const name = choice.name.toLowerCase();
            if (choiceNames.has(name)) {
              throw new InvalidCharacteristicDefinitionError(
                `${choicePath}.name`,
                'This characteristic already uses the choice name',
                'DUPLICATE_VALUE',
              );
            }
            choiceNames.add(name);
            if (choice.id) {
              if (!savedChoices.some(({ id }) => id === choice.id)) {
                throw new InvalidCharacteristicDefinitionError(
                  `${choicePath}.id`,
                  'Choose a value from this characteristic',
                );
              }
              await tx.characteristicChoice.update({
                where: { ...fieldScope, id: choice.id },
                data: { name: choice.name },
              });
            } else {
              await tx.characteristicChoice.create({ data: { ...fieldScope, name: choice.name } });
            }
          }
        }

        return groupView(
          await tx.characteristicGroup.findUniqueOrThrow({
            where: { ...scope, id: group.id },
            include: groupRelations(scope),
          }),
        );
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
          include: groupRelations(scope, true),
        });
        const values = new Map<
          string,
          { characteristicId: string; value: string; choiceIds: string[] }
        >();
        if (productId) {
          const where = {
            ...scope,
            productId,
            characteristicId: {
              in: groups.flatMap((group) => group.characteristics.map(({ id }) => id)),
            },
          };
          const texts = await tx.productCharacteristicValue.findMany({
            where,
            select: { characteristicId: true, value: true },
          });
          for (const text of texts) {
            values.set(text.characteristicId, { ...text, choiceIds: [] });
          }
          const choices = await tx.productCharacteristicChoice.findMany({
            where,
            orderBy: { choiceId: 'asc' },
            select: { characteristicId: true, choiceId: true },
          });
          for (const { characteristicId, choiceId } of choices) {
            const value = values.get(characteristicId) ?? {
              characteristicId,
              value: '',
              choiceIds: [],
            };
            value.choiceIds.push(choiceId);
            values.set(characteristicId, value);
          }
        }
        return { groups: groups.map(groupView), values: [...values.values()] };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async patchProductValues(
    tx: Prisma.TransactionClient,
    productScope: Scope & { productId: string },
    categoryId: string | null,
    values: ProductCharacteristicValueInput[],
  ) {
    const { tenantId, branchId } = productScope;
    const scope = { tenantId, branchId };
    const definitions = await tx.characteristic.findMany({
      where: {
        ...scope,
        active: true,
        group: applicableGroup(scope, categoryId),
        id: { in: values.map(({ characteristicId }) => characteristicId) },
      },
      select: { id: true, kind: true, choices: { where: scope, select: { id: true } } },
    });
    const byId = new Map(definitions.map((field) => [field.id, field]));
    for (const [index, { characteristicId, value, choiceIds }] of values.entries()) {
      const field = byId.get(characteristicId);
      if (!field) {
        throw new InvalidCharacteristicValueError(
          index,
          'characteristicId',
          'Choose an applicable characteristic from this shop',
        );
      }

      const key = { ...productScope, characteristicId };
      if (field.kind === 'TEXT') {
        if (value == null || choiceIds != null) {
          throw new InvalidCharacteristicValueError(
            index,
            'value',
            'Enter a text value for this characteristic',
          );
        }
        if (value) {
          await tx.productCharacteristicValue.upsert({
            where: { tenantId_branchId_productId_characteristicId: key },
            create: { ...key, value },
            update: { value },
          });
        } else {
          await tx.productCharacteristicValue.deleteMany({ where: key });
        }
      } else {
        const available = new Set(field.choices.map(({ id }) => id));
        if (
          !choiceIds ||
          value != null ||
          (field.kind === 'SINGLE_CHOICE' && choiceIds.length > 1) ||
          choiceIds.some((id) => !available.has(id))
        ) {
          throw new InvalidCharacteristicValueError(
            index,
            'choiceIds',
            'Choose allowed values for this characteristic',
          );
        }
        await tx.productCharacteristicChoice.deleteMany({ where: key });
        if (choiceIds.length) {
          await tx.productCharacteristicChoice.createMany({
            data: choiceIds.map((choiceId) => ({ ...key, choiceId })),
          });
        }
      }
    }
  }

  publicSpecifications(scope: Scope, productId: string) {
    return this.database.client.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: { ...catalogueProductWhere(scope), id: productId },
          select: { categoryId: true },
        });
        if (!product) {
          return [];
        }
        const productScope = { ...scope, productId };
        const groups = await tx.characteristicGroup.findMany({
          where: applicableGroup(scope, product.categoryId),
          orderBy: byOrder,
          select: {
            name: true,
            characteristics: {
              where: { ...scope, active: true },
              orderBy: byOrder,
              select: {
                name: true,
                productValues: { where: productScope, select: { value: true } },
                choices: {
                  where: { ...scope, productAssignments: { some: productScope } },
                  orderBy: byChoiceName,
                  select: { name: true },
                },
              },
            },
          },
        });
        return groups.flatMap(({ name, characteristics }) => {
          const values = characteristics.flatMap((item) => {
            const text = item.productValues[0]?.value;
            const value =
              text && text.trim() ? text : item.choices.map(({ name }) => name).join(', ');
            return value ? [{ name: item.name, value }] : [];
          });
          return values.length ? [{ name, values }] : [];
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

export class InvalidCharacteristicDefinitionError extends Error {
  constructor(
    readonly path: string,
    message: string,
    readonly code = 'INVALID_VALUE',
  ) {
    super(message);
  }
}

export class InvalidCharacteristicValueError extends Error {
  constructor(
    readonly index: number,
    readonly field: 'characteristicId' | 'value' | 'choiceIds',
    message: string,
  ) {
    super(message);
  }
}
