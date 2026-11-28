import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

export type EmailLanguage = 'bg' | 'en';

type LocalMessage = Omit<
  Prisma.LocalEmailCreateManyInput,
  keyof Scope | 'capturedAt' | 'language'
> & {
  language: EmailLanguage;
};

@Injectable()
export class LocalMailbox {
  async capture(tx: Prisma.TransactionClient, scope: Scope, message: LocalMessage): Promise<void> {
    await tx.localEmail.createMany({ data: { ...message, ...scope }, skipDuplicates: true });
  }
}
