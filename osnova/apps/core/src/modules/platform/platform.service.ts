import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { hashPassword, normalizedEmail, userName, validatePassword } from '@osnova/auth';
import { requireSession } from '../../auth/session.js';
import type {
  AccountStatus,
  Merchant,
  MerchantBranch,
  MerchantPage,
} from '../../generated/graphql/types.js';
import { Prisma, type MerchantProvisioning } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { PlatformRepository, type MerchantProvisioningInput } from './platform.repository.js';

function requirePlatform(context: RequestContext, write: boolean): void {
  const identity = requireSession(context);
  if (
    !identity.platform ||
    !['ADMINISTRATOR', 'OPERATOR', ...(write ? [] : ['SALES'])].includes(identity.role)
  ) {
    throw new ForbiddenException('Platform access is required');
  }
}
function id(value: string): string {
  if (!isUUID(value)) {
    throw new BadRequestException('ID must be a UUID');
  }
  return value.toLowerCase();
}
function merchant<T extends { _count: { branches: number } }>(
  value: T,
): T & { branchCount: number } {
  return { ...value, branchCount: value._count.branches };
}
function writeError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new NotFoundException('Merchant or Branch not found');
    }
    if (error.code === 'P2002') {
      throw new BadRequestException('Name or email is already in use');
    }
  }
  throw error;
}

function replayProvisioning(input: MerchantProvisioningInput, record: MerchantProvisioning) {
  if (
    input.merchantName !== record.merchantName ||
    input.adminName !== record.adminName ||
    input.adminEmail !== record.adminEmail ||
    input.branchName !== record.branchName
  ) {
    throw new ConflictException('Operation already completed with different onboarding details');
  }
  return { merchantTenantId: record.merchantTenantId, branchId: record.branchId };
}

@Injectable()
export class PlatformService {
  constructor(private readonly repository: PlatformRepository) {}

  async list(context: RequestContext, offset = 0, limit = 20): Promise<MerchantPage> {
    requirePlatform(context, false);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const [rows, total] = await this.repository.list(offset, limit);
    return { items: rows.map(merchant), total };
  }

  async find(context: RequestContext, tenantId: string): Promise<Merchant | null> {
    requirePlatform(context, false);
    if (!isUUID(tenantId)) {
      return null;
    }
    const row = await this.repository.find(tenantId.toLowerCase());
    return row && merchant(row);
  }

  async create(
    context: RequestContext,
    name: string,
    adminName: string,
    adminEmail: string,
    password: string,
  ): Promise<Merchant> {
    requirePlatform(context, true);
    const tenantName = userName(name);
    const normalizedName = userName(adminName);
    const email = normalizedEmail(adminEmail);
    const passwordHash = await hashPassword(validatePassword(password, 'initialPassword'));
    try {
      return merchant(
        await this.repository.create(tenantName, normalizedName, email, passwordHash),
      );
    } catch (error: unknown) {
      return writeError(error);
    }
  }

  async provisionMerchant(platformTenantId: string, body: unknown) {
    if (
      typeof body !== 'object' ||
      body === null ||
      !('operationId' in body) ||
      typeof body.operationId !== 'string' ||
      !('merchantName' in body) ||
      typeof body.merchantName !== 'string' ||
      !('adminName' in body) ||
      typeof body.adminName !== 'string' ||
      !('adminEmail' in body) ||
      typeof body.adminEmail !== 'string' ||
      !('branchName' in body) ||
      typeof body.branchName !== 'string'
    ) {
      throw new BadRequestException('Invalid merchant onboarding request');
    }
    const initialPassword = 'initialPassword' in body ? body.initialPassword : '';
    if (typeof initialPassword !== 'string') {
      throw new BadRequestException('Invalid merchant onboarding request');
    }
    const input = {
      operationId: id(body.operationId),
      merchantName: userName(body.merchantName, 'merchantName'),
      adminName: userName(body.adminName, 'adminName'),
      adminEmail: normalizedEmail(body.adminEmail, 'adminEmail'),
      branchName: userName(body.branchName, 'branchName'),
    };
    const existing = await this.repository.findProvisioning(platformTenantId, input.operationId);
    if (existing) {
      return replayProvisioning(input, existing);
    }

    const passwordHash = await hashPassword(validatePassword(initialPassword, 'initialPassword'));
    try {
      return await this.repository.provisionMerchant(platformTenantId, input, passwordHash);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // A concurrent commit can win the replay key or the merchant name/email constraint.
        const committed = await this.repository.findProvisioning(
          platformTenantId,
          input.operationId,
        );
        if (committed) {
          return replayProvisioning(input, committed);
        }
      }
      return writeError(error);
    }
  }

  async createBranch(
    context: RequestContext,
    tenantId: string,
    name: string,
  ): Promise<MerchantBranch> {
    requirePlatform(context, true);
    const branch = await this.repository.createBranch(id(tenantId), userName(name));
    if (!branch) {
      throw new NotFoundException('Merchant not found');
    }
    return branch;
  }

  async setStatus(
    context: RequestContext,
    tenantId: string,
    status: AccountStatus,
  ): Promise<Merchant> {
    requirePlatform(context, true);
    try {
      return merchant(await this.repository.setStatus(id(tenantId), status));
    } catch (error: unknown) {
      return writeError(error);
    }
  }

  async setBranchStatus(
    context: RequestContext,
    tenantId: string,
    branchId: string,
    status: AccountStatus,
  ): Promise<MerchantBranch> {
    requirePlatform(context, true);
    try {
      return await this.repository.setBranchStatus(id(tenantId), id(branchId), status);
    } catch (error: unknown) {
      return writeError(error);
    }
  }
}
