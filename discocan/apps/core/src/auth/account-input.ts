import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';

function invalid(path: string, message: string, code: string): never {
  throw new BadRequestException({ message, fieldErrors: [{ path, message, code }] });
}

export function normalizedEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !isEmail(email)) {
    invalid(
      'email',
      'Enter a valid email address of at most 254 characters.',
      !email ? 'REQUIRED' : email.length > 254 ? 'TOO_LONG' : 'INVALID_FORMAT',
    );
  }
  return email;
}

export function userName(value: string): string {
  const name = value.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    invalid(
      'name',
      'Use 1 to 200 supported characters.',
      !name ? 'REQUIRED' : Array.from(name).length > 200 ? 'TOO_LONG' : 'INVALID_FORMAT',
    );
  }
  return name;
}

export function validatePassword(value: string, path = 'password'): string {
  const length = Array.from(value).length;
  if (length < 12 || length > 128 || value.includes('\u0000')) {
    invalid(
      path,
      'Use a password of 12 to 128 characters without NUL.',
      !length ? 'REQUIRED' : length > 128 ? 'TOO_LONG' : 'INVALID_FORMAT',
    );
  }
  return value;
}
