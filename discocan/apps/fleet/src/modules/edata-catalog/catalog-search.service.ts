import { Injectable, NotFoundException } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type {
  FleetEdataParameter,
  FleetEdataParameterPage,
  FleetEdataParametersInput,
  FleetEdataProfile,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { invalid, pagination, searchTokens } from '../../validation.js';
import { CatalogSearchRepository } from './catalog-search.repository.js';

function hex(parameterId: number): string {
  return parameterId.toString(16).toUpperCase().padStart(4, '0');
}

@Injectable()
export class CatalogSearchService {
  constructor(private readonly repository: CatalogSearchRepository) {}

  async profiles(context: RequestContext): Promise<FleetEdataProfile[]> {
    requireTenant(context);
    const catalog = await this.repository.latest();
    if (!catalog) {
      return [];
    }
    return (await this.repository.profiles(catalog.id)).map((profile) => ({
      id: profile.vendorId,
      name: profile.name,
      categoryId: profile.categoryId,
      categoryName: profile.category.name,
      parameterCount: profile.set._count.members,
    }));
  }

  async parameters(
    input: FleetEdataParametersInput,
    context: RequestContext,
  ): Promise<FleetEdataParameterPage> {
    requireTenant(context);
    const { offset, limit } = pagination({
      ...(input.offset != null && { offset: input.offset }),
      ...(input.limit != null && { limit: input.limit }),
    });
    const tokens = searchTokens(input.search).map((token) => token.toLowerCase());
    if (input.ids && input.ids.length > 100) {
      invalid('ids', 'Use at most 100 IDs.', 'OUT_OF_RANGE');
    }
    const ids = input.ids ? new Set(input.ids) : undefined;
    const catalog = await this.repository.latest();
    if (!catalog) {
      return { items: [], total: 0, offset, limit, catalogLabel: null };
    }
    let members: number[] | undefined;
    let category: { key: string; name: string } | undefined;
    if (input.profileId !== null && input.profileId !== undefined) {
      const profile = await this.repository.profile(catalog.id, input.profileId);
      if (!profile) {
        throw new NotFoundException('eData profile not found in the imported catalog');
      }
      members = [...new Set(profile.set.members.map((member) => member.parameterId))];
      category = { key: String(profile.categoryId), name: profile.category.name };
    }
    // One row per ID: the profile's vehicle category name when present, else the first category.
    const rows = new Map<number, FleetEdataParameter>();
    for (const row of await this.repository.monitorParameters(
      catalog.id,
      members ?? input.ids ?? undefined,
    )) {
      const current = rows.get(row.parameterId);
      if (
        !current ||
        (category && row.category === category.key && current.category !== category.name)
      ) {
        rows.set(row.parameterId, {
          parameterId: row.parameterId,
          hex: hex(row.parameterId),
          name: row.name,
          category: category && row.category === category.key ? category.name : row.category,
          multiply: row.multiply,
          offset: row.offset,
        });
      }
    }
    for (const parameterId of members ?? []) {
      if (!rows.has(parameterId)) {
        rows.set(parameterId, {
          parameterId,
          hex: hex(parameterId),
          name: `#${String(parameterId)}`,
          category: category?.name ?? '',
          multiply: null,
          offset: null,
        });
      }
    }
    const matches = [...rows.values()]
      .filter(
        (row) =>
          (!ids || ids.has(row.parameterId)) &&
          tokens.every((token) => {
            const id = token.replace(/^0x/, '');
            return (
              row.name.toLowerCase().includes(token) ||
              String(row.parameterId).startsWith(token) ||
              (/^[0-9a-f]{1,4}$/.test(id) && row.hex === id.toUpperCase().padStart(4, '0'))
            );
          }),
      )
      .sort((left, right) => left.parameterId - right.parameterId);
    return {
      items: matches.slice(offset, offset + limit),
      total: matches.length,
      offset,
      limit,
      catalogLabel: catalog.packageLabel,
    };
  }
}
