import { Module } from '@nestjs/common';
import { CoreClient } from './core.client.js';

@Module({ providers: [CoreClient], exports: [CoreClient] })
export class CoreClientModule {}
