import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Store } from '../generated/graphql/types.js';
import { StoresRepository } from './stores.repository.js';

@Injectable()
export class StoresService {
  constructor(private readonly stores: StoresRepository) {}

  list(): Promise<Store[]> {
    return this.stores.list();
  }

  find(id: string): Promise<Store | null> {
    if (typeof id !== 'string' || !isUUID(id))
      throw new BadRequestException('Store ID must be a UUID');
    return this.stores.find(id.toLowerCase());
  }
}
