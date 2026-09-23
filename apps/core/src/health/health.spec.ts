import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../app.module.js';

describe('core health endpoint', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds without store context or database access', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', service: 'core' });
  });

  it('does not expose an unrelated route', async () => {
    const response = await fetch(`${baseUrl}/unregistered`);
    await response.text();
    expect(response.status).toBe(404);
  });
});
