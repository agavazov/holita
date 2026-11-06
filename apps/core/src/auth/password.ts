import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const cost = 131072;
const blockSize = 8;
const parallelization = 1;
const keyLength = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelization, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return [
    'scrypt',
    cost,
    blockSize,
    parallelization,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, storedCost, storedBlockSize, storedParallelization, saltText, keyText, extra] =
    encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    storedCost !== String(cost) ||
    storedBlockSize !== String(blockSize) ||
    storedParallelization !== String(parallelization) ||
    !saltText ||
    !keyText ||
    extra !== undefined
  ) {
    return false;
  }
  const salt = Buffer.from(saltText, 'base64url');
  const storedKey = Buffer.from(keyText, 'base64url');
  if (salt.length !== 16 || storedKey.length !== keyLength) {
    return false;
  }
  const key = await derive(password, salt);
  return timingSafeEqual(key, storedKey);
}
