import { NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  getArgumentValues,
  getDirectiveValues,
  getNamedType,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  isAbstractType,
  isObjectType,
  Kind,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  type SelectionSetNode,
} from 'graphql';
import { invalid, uuid } from '../validation.js';
import type { RequestContext } from './request-context.js';

/** Checks a path of schema field names, including aliases, fragments and conditional selections. */
export function selects(info: GraphQLResolveInfo, typeName: string, ...path: string[]): boolean {
  const { schema, fragments, variableValues } = info;
  function selected(
    set: SelectionSetNode | undefined,
    type: GraphQLObjectType,
    index: number,
  ): boolean {
    return (
      set?.selections.some((node) => {
        if (
          getDirectiveValues(GraphQLSkipDirective, node, variableValues)?.if === true ||
          getDirectiveValues(GraphQLIncludeDirective, node, variableValues)?.if === false
        ) {
          return false;
        }
        if (node.kind === Kind.FIELD) {
          const name = node.name.value;
          if (name !== path[index]) {
            return false;
          }
          if (index === path.length - 1) {
            return true;
          }
          const next = getNamedType(type.getFields()[name]?.type);
          return isObjectType(next) && selected(node.selectionSet, next, index + 1);
        }
        const fragment = node.kind === Kind.FRAGMENT_SPREAD ? fragments[node.name.value] : node;
        const condition =
          fragment?.typeCondition && schema.getType(fragment.typeCondition.name.value);
        return (
          (!condition ||
            condition === type ||
            (isAbstractType(condition) && schema.isSubType(condition, type))) &&
          selected(fragment?.selectionSet, type, index)
        );
      }) ?? false
    );
  }

  const type = schema.getType(typeName);
  return isObjectType(type) && info.fieldNodes.some((node) => selected(node.selectionSet, type, 0));
}

function representedIds(info: GraphQLResolveInfo, typeName: string): string[] {
  const field = info.schema.getQueryType()?.getFields()['_entities'];
  const node = info.fieldNodes[0];
  const representations: unknown =
    field && node ? getArgumentValues(field, node, info.variableValues).representations : undefined;
  return Array.isArray(representations)
    ? representations.flatMap((value: unknown) =>
        typeof value === 'object' &&
        value !== null &&
        '__typename' in value &&
        value.__typename === typeName &&
        'id' in value &&
        typeof value.id === 'string' &&
        isUUID(value.id)
          ? [value.id.toLowerCase()]
          : [],
      )
    : [];
}

export type ReferenceBatches<T> = WeakMap<RequestContext, Map<string, Promise<Map<string, T>>>>;

/** Reuses one scoped lookup and state batch for the representations of this entity selection. */
export async function selectedReference<T>(
  cache: ReferenceBatches<T>,
  context: RequestContext,
  info: GraphQLResolveInfo,
  typeName: string,
  referenceId: string,
  load: (ids: string[]) => Promise<Map<string, T>>,
  notFound: string,
): Promise<T> {
  const id = uuid(referenceId, 'id');
  let batches = cache.get(context);
  if (!batches) {
    batches = new Map();
    cache.set(context, batches);
  }
  const key = String(info.path.key);
  let batch = batches.get(key);
  if (!batch) {
    batch = load([...new Set([id, ...representedIds(info, typeName)])]);
    batches.set(key, batch);
  }
  const entity = (await batch).get(id);
  if (!entity) {
    throw new NotFoundException(notFound);
  }
  return entity;
}

export function singleDeviceDetail(info: GraphQLResolveInfo): void {
  for (let path = info.path.prev; path; path = path.prev) {
    if (typeof path.key === 'number') {
      invalid(info.fieldName, 'Select this field on a single Device.');
    }
  }
}
