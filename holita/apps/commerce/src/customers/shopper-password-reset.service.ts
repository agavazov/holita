import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { hashPassword, normalizedEmail, validatePassword } from '@osnova/auth';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { LocalMailbox, type EmailLanguage } from '../local-mailbox/local-mailbox.repository.js';
import type { Scope } from '../scope.js';
import { ShopperRepository } from './shopper.repository.js';

const resetMinutes = 30;
const resetCopy = {
  bg: {
    subject: 'Нова парола за профила ви в магазина',
    body: `Отворете връзката, за да зададете нова парола. Тя е валидна ${String(resetMinutes)} минути и може да се използва веднъж.`,
  },
  en: {
    subject: 'Reset your shop account password',
    body: `Open the link to set a new password. It expires in ${String(resetMinutes)} minutes and can be used once.`,
  },
};

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ShopperPasswordResetService {
  private readonly origin = process.env.STOREFRONT_ORIGIN ?? 'http://127.0.0.1:12020';

  constructor(
    private readonly shoppers: ShopperRepository,
    private readonly mailbox: LocalMailbox,
  ) {}

  async request(scope: Scope, email: string, language: EmailLanguage): Promise<boolean> {
    let address: string;
    try {
      address = normalizedEmail(email);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw new UnprocessableEntityException(error.getResponse(), { cause: error });
      }
      throw error;
    }
    const shopper = await this.shoppers.findByEmail(scope, address);
    if (shopper?.passwordHash) {
      const token = randomBytes(32).toString('base64url');
      const link = new URL(`/s/${scope.branchId}/reset-password`, this.origin);
      link.hash = new URLSearchParams({ token }).toString();
      const expiresAt = new Date(Date.now() + resetMinutes * 60_000);
      const { subject, body } = resetCopy[language];
      await this.shoppers.transaction(async (tx) => {
        await this.shoppers.savePasswordReset(
          tx,
          { ...scope, customerId: shopper.id },
          tokenHash(token),
          expiresAt,
        );
        await this.mailbox.capture(tx, scope, {
          template: 'SHOPPER_PASSWORD_RESET',
          sourceEventId: randomUUID(),
          recipient: shopper.email,
          language,
          subject,
          body: `${body}\n\n${link.href}`,
        });
      });
    }
    return true;
  }

  async reset(scope: Scope, token: string, password: string): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return false;
    }
    validatePassword(password);
    return this.shoppers.transaction(async (tx) => {
      const reset = await this.shoppers.consumePasswordReset(tx, scope, tokenHash(token));
      if (!reset) {
        return false;
      }
      await this.shoppers.replacePassword(
        tx,
        { ...scope, customerId: reset.customerId },
        await hashPassword(password),
      );
      return true;
    });
  }
}
