import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type {
  LeadContact,
  LeadContactInput,
  QuerySalesContactsArgs,
} from '../generated/graphql/types.js';
import { Prisma, type LeadContact as StoredContact } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { isContactEmail } from './contact-email.js';
import { normalizeContactPhone } from './contact-phone.js';
import { ContactsRepository } from './contacts.repository.js';

type ContactText = keyof Pick<LeadContactInput, 'name' | 'phone' | 'email' | 'notes'>;

function present(row: StoredContact): LeadContact {
  const { id, leadId, name, phone, email, role, isPrimary, notes, createdAt, updatedAt } = row;
  return {
    id,
    leadId,
    name,
    phone,
    email,
    role,
    isPrimary,
    notes,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function recordId(id: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
    throw new BadRequestException(label + ' ID must be a UUID');
  }
  return id.toLowerCase();
}

function inputError(path: ContactText, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function text(input: LeadContactInput, path: ContactText, maximum?: number): string | null {
  const value = input[path]?.trim();
  if (value?.includes('\u0000')) {
    throw inputError(path, 'INVALID_VALUE', 'Text must not contain a null character');
  }
  if (value && maximum !== undefined && Array.from(value).length > maximum) {
    throw inputError(path, 'TOO_LONG', 'Text exceeds the maximum length');
  }
  return value || null;
}

function fields(input: LeadContactInput) {
  const name = text(input, 'name', 255);
  const email = text(input, 'email', 255);
  const rawPhone = text(input, 'phone');
  const phone = rawPhone ? normalizeContactPhone(rawPhone) : null;
  if (rawPhone && !phone) {
    throw inputError('phone', 'INVALID_FORMAT', 'Enter a valid phone number');
  }
  if (email && !isContactEmail(email)) {
    throw inputError('email', 'INVALID_FORMAT', 'Enter a valid email address');
  }
  if (!name && !phone && !email) {
    throw inputError(
      'name',
      'IDENTITY_REQUIRED',
      'Enter a name, a phone number or an email address',
    );
  }
  return {
    name,
    phone,
    email,
    notes: text(input, 'notes'),
    role: input.role ?? 'UNKNOWN',
    isPrimary: input.isPrimary ?? false,
  };
}

function contactNotFound() {
  return new NotFoundException('Contact or lead not found');
}

@Injectable()
export class ContactsService {
  constructor(private readonly repository: ContactsRepository) {}

  async listForLead(scope: SalesScope, leadId: string) {
    const contacts = await this.repository.listForLead(scope, recordId(leadId, 'Lead'));
    return contacts.map(present);
  }

  async find(scope: SalesScope, leadId: string, id: string): Promise<LeadContact | null> {
    const row = await this.repository.find(
      scope,
      recordId(leadId, 'Lead'),
      recordId(id, 'Contact'),
    );
    return row ? present(row) : null;
  }

  async list(scope: SalesScope, { offset = 0, limit = 20, search, sort }: QuerySalesContactsArgs) {
    const term = (search ?? '').trim();
    const words = term.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (term.includes('\u0000') || Array.from(term).length > 200 || words.length > 5) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.repository.list(scope, offset, limit, term, words, sort);
    return { ...page, items: page.items.map((row) => ({ contact: present(row), lead: row.lead })) };
  }

  async save(
    scope: SalesScope,
    leadId: string,
    input: LeadContactInput,
    id?: string,
  ): Promise<LeadContact> {
    const parentId = recordId(leadId, 'Lead');
    const contactId = id === undefined ? undefined : recordId(id, 'Contact');
    const data = fields(input);
    try {
      const row = await this.repository.save(scope, parentId, data, contactId);
      if (!row) {
        throw contactNotFound();
      }
      return present(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw contactNotFound();
        }
        if (error.code === 'P2002' && data.isPrimary) {
          throw new ConflictException('Another contact was set as primary');
        }
      }
      throw error;
    }
  }

  async delete(scope: SalesScope, leadId: string, id: string): Promise<boolean> {
    try {
      await this.repository.delete(scope, recordId(leadId, 'Lead'), recordId(id, 'Contact'));
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw contactNotFound();
      }
      throw error;
    }
  }
}
