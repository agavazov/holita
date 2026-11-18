import { BadRequestException, Injectable } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type {
  ErmDeviceActionCommand,
  ErmParameterCatalogInput,
  ErmParameterCatalogPage,
  ErmParameterDefinition,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { parameterReference } from '../../starlink/parameter-reference.js';
import { deviceActions } from './device-actions.js';
import { validateParameterChangeOptions } from './edata-change.js';

function writable(parameter: number): boolean {
  try {
    // The same guard the 04/46 workflows apply, with a neutral unit and value.
    validateParameterChangeOptions({
      unitId: '000000000000000',
      parameter: String(parameter).padStart(4, '0'),
      value: '0',
    });
    return true;
  } catch {
    return false;
  }
}

const definitions: readonly ErmParameterDefinition[] = parameterReference.map((entry) => ({
  ...entry,
  code: String(entry.parameter).padStart(4, '0'),
  features: [...entry.features],
  options: [...entry.options],
  writable: writable(entry.parameter),
}));
const actionOrder: readonly (keyof typeof deviceActions)[] = [
  'REQUEST_LOCATION',
  'READ_STATUS',
  'READ_VERSION',
  'READ_ACCESSORIES',
  'READ_EDATA_DIAGNOSTICS',
  'READ_EDATA_FAULTS',
];
const features = [...new Set(definitions.flatMap((entry) => entry.features))].sort((a, b) =>
  a.localeCompare(b),
);

@Injectable()
export class ParameterCatalogService {
  search(
    input: ErmParameterCatalogInput | null | undefined,
    context: RequestContext,
  ): ErmParameterCatalogPage {
    requireTenant(context);
    const offset = input?.offset ?? 0;
    const limit = input?.limit ?? 20;
    const search = input?.search?.trim().toLowerCase() ?? '';
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      search.length > 200
    ) {
      throw new BadRequestException(
        'Use offset ≥ 0, limit 1–100 and at most 200 search characters',
      );
    }
    const tokens = search.split(/\s+/).filter(Boolean);
    const matches = definitions.filter(
      (entry) =>
        (!input?.writableOnly || entry.writable) &&
        (!input?.feature || entry.features.includes(input.feature)) &&
        tokens.every((token) =>
          /^\d{1,4}$/.test(token)
            ? entry.code.startsWith(token.padStart(4, '0')) ||
              String(entry.parameter).startsWith(token)
            : [entry.title, entry.summary ?? '', ...entry.features].some((text) =>
                text.toLowerCase().includes(token),
              ),
        ),
    );
    return {
      items: matches.slice(offset, offset + limit),
      total: matches.length,
      offset,
      limit,
      features,
    };
  }

  actionCommands(context: RequestContext): ErmDeviceActionCommand[] {
    requireTenant(context);
    return actionOrder.map((action) => ({
      action,
      command: deviceActions[action].command,
      fields: [...deviceActions[action].fields],
    }));
  }
}
