import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { LeadNote } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';

type NoteFields = Pick<LeadNote, 'occurredAt' | 'text'>;

@Injectable()
export class LeadNotesRepository {
  constructor(private readonly database: DatabaseService) {}

  list({ tenantId }: SalesScope, leadId: string) {
    return this.database.client.leadNote.findMany({
      where: { tenantId, leadId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  find({ tenantId }: SalesScope, leadId: string, id: string) {
    return this.database.client.leadNote.findUnique({ where: { id, tenantId, leadId } });
  }

  create({ tenantId, userId }: SalesScope, leadId: string, fields: NoteFields) {
    return this.database.client.leadNote.create({
      data: {
        ...fields,
        authorUserId: userId,
        lead: { connect: { tenantId_id: { tenantId, id: leadId } } },
      },
    });
  }

  update({ tenantId }: SalesScope, leadId: string, id: string, fields: NoteFields) {
    return this.database.client.leadNote.update({ where: { id, tenantId, leadId }, data: fields });
  }

  delete({ tenantId }: SalesScope, leadId: string, id: string) {
    return this.database.client.leadNote.delete({ where: { id, tenantId, leadId } });
  }
}
