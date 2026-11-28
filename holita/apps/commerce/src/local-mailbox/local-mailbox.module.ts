import { Module } from '@nestjs/common';
import { LocalMailbox } from './local-mailbox.repository.js';

@Module({ providers: [LocalMailbox], exports: [LocalMailbox] })
export class LocalMailboxModule {}
