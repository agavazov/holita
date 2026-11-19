import { BadRequestException } from '@nestjs/common';

export function parseRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
