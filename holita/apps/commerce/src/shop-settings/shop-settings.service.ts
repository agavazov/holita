import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { contentInputError } from '../content-validation.js';
import type { ShopSettings, ShopSettingsInput } from '../generated/graphql/types.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import { ShopSettingsRepository } from './shop-settings.repository.js';

const emptySettings = {
  displayName: null,
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
} satisfies ShopSettings;

function text(input: ShopSettingsInput, field: keyof ShopSettingsInput, max: number) {
  const value = input[field]?.trim() ?? '';
  if (value.includes('\u0000') || Array.from(value).length > max) {
    throw contentInputError(field, 'INVALID_VALUE', 'Enter supported text within the field limit');
  }
  return value || null;
}

@Injectable()
export class ShopSettingsService {
  constructor(private readonly repository: ShopSettingsRepository) {}

  async read(context: RequestContext): Promise<ShopSettings> {
    return this.readScoped(await requireScope(context, false));
  }

  async readScoped(scope: Scope) {
    return (await this.repository.find(scope)) ?? emptySettings;
  }

  async update(context: RequestContext, input: ShopSettingsInput): Promise<ShopSettings> {
    const scope = await requireScope(context, true);
    const fields = {
      displayName: text(input, 'displayName', 200),
      contactEmail: text(input, 'contactEmail', 254),
      contactPhone: text(input, 'contactPhone', 50),
      contactAddress: text(input, 'contactAddress', 500),
    };
    if (fields.contactEmail && !isEmail(fields.contactEmail)) {
      throw contentInputError('contactEmail', 'INVALID_EMAIL', 'Enter a valid email address');
    }
    return this.repository.save(scope, fields);
  }
}
