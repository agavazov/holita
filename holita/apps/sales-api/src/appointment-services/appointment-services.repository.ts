import { Injectable } from '@nestjs/common';
import { searchText } from '../contacts/contact-search.js';
import { DatabaseService } from '../database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';

type ServiceFields = Omit<
  Prisma.AppointmentServiceUncheckedCreateInput,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class AppointmentServicesRepository {
  constructor(private readonly database: DatabaseService) {}

  async list({ tenantId }: SalesScope, offset: number, limit: number, words: string[]) {
    const where: Prisma.AppointmentServiceWhereInput = {
      tenantId,
      AND: words.map((word) => {
        const match = searchText(word);
        return { OR: [{ name: match }, { description: match }] };
      }),
    };
    const { appointmentService } = this.database.client;
    const [items, total] = await this.database.client.$transaction([
      appointmentService.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      appointmentService.count({ where }),
    ]);
    return { items, total, offset, limit };
  }

  find({ tenantId }: SalesScope, id: string) {
    return this.database.client.appointmentService.findUnique({ where: { id, tenantId } });
  }

  create({ tenantId }: SalesScope, fields: ServiceFields) {
    return this.database.client.appointmentService.create({ data: { ...fields, tenantId } });
  }

  update({ tenantId }: SalesScope, id: string, data: ServiceFields | { active: false }) {
    return this.database.client.appointmentService.update({ where: { id, tenantId }, data });
  }
}
