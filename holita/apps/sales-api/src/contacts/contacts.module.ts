import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { ContactsRepository } from './contacts.repository.js';
import { ContactsResolver } from './contacts.resolver.js';
import { ContactsService } from './contacts.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ContactsRepository, ContactsResolver, ContactsService],
})
export class ContactsModule {}
