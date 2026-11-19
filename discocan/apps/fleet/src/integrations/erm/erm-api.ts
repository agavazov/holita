import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { InspectionCaller, InspectionDevice } from '../device-adapter.js';
import { recordOf, text } from '../../database/sql.js';

function ermUrl(path: string): URL {
  const url = new URL(process.env.ERM_TELEMETRY_URL ?? 'http://127.0.0.1:11017');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Invalid ERM API URL');
  }
  url.pathname = path;
  return url;
}

export async function requestErmGraphql(
  query: string,
  variables: object,
  headers: Record<string, string>,
) {
  const url = ermUrl('/graphql');
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('ERM request failed');
  }
  return recordOf(await response.json());
}

function upstreamError(value: unknown): never {
  const error = recordOf(Array.isArray(value) ? value[0] : undefined);
  const code = recordOf(error.extensions).code;
  const message = text(error, 'message');
  switch (code) {
    case 'BAD_USER_INPUT':
      throw new BadRequestException(message);
    case 'UNAUTHENTICATED':
      throw new UnauthorizedException(message);
    case 'FORBIDDEN':
      throw new ForbiddenException(message);
    case 'NOT_FOUND':
      throw new NotFoundException(message);
    case 'CONFLICT':
      throw new ConflictException(message);
    default:
      throw new Error('ERM device operation failed');
  }
}

export async function ermOperation<T>(
  query: string,
  variables: object,
  field: string,
  { authorization, branchId }: InspectionCaller,
  parse: (value: unknown) => T,
): Promise<T> {
  if (!authorization || !branchId) {
    throw new UnauthorizedException('Device operations require a signed-in Branch session');
  }
  try {
    const response = await requestErmGraphql(query, variables, {
      authorization,
      'x-branch-id': branchId,
    });
    if (response.errors !== undefined) {
      upstreamError(response.errors);
    }
    return parse(recordOf(response.data)[field]);
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new ServiceUnavailableException('ERM device data is unavailable');
  }
}

export function ermEntity<T>(
  query: string,
  device: InspectionDevice,
  variables: object,
  field: string,
  caller: InspectionCaller,
  parse: (value: unknown) => T,
) {
  return ermOperation(
    query,
    { ...variables, devices: [{ __typename: 'FleetDevice', ...device }] },
    '_entities',
    caller,
    (value) => {
      if (!Array.isArray(value) || value.length !== 1) {
        throw new TypeError('Invalid ERM Device reference');
      }
      if (value[0] === null) {
        throw new NotFoundException('Device not found in the active Branch');
      }
      return parse(recordOf(value[0])[field]);
    },
  );
}

export function ermMutate<T>(
  field: string,
  inputType: string,
  input: object,
  fields: string,
  caller: InspectionCaller,
  parse: (value: unknown) => T,
) {
  const query = `mutation FleetDeviceOperation($input: ${inputType}!) { ${field}(input: $input) { ${fields} } }`;
  return ermOperation(query, { input }, field, caller, parse);
}

export function isErmRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function requestErmInternal(
  path: string,
  options: { query?: URLSearchParams; body?: object },
): Promise<unknown> {
  const token = process.env.ERM_TELEMETRY_TOKEN;
  if (!token || token.length < 32) {
    throw new Error('ERM internal access is not configured');
  }
  const url = ermUrl(path);
  if (options.query) {
    url.search = options.query.toString();
  }
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { method: 'POST', body: JSON.stringify(options.body) } : {}),
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error('ERM request failed');
  }
  return response.json();
}

export async function requestErmDashboard(
  query: string,
  variables: object,
  field: string,
  caller?: { authorization: string; branchId: string },
): Promise<Record<string, unknown>> {
  const token = process.env.ERM_TELEMETRY_TOKEN;
  const authorization = caller
    ? { authorization: caller.authorization, 'x-branch-id': caller.branchId }
    : token && token.length >= 32
      ? { authorization: `Bearer ${token}` }
      : null;
  if (!authorization) {
    throw new ServiceUnavailableException('ERM dashboard access is not configured');
  }
  try {
    const body = await requestErmGraphql(query, variables, authorization);
    if (body.errors !== undefined) {
      throw new Error('ERM query failed');
    }
    return recordOf(recordOf(body.data)[field]);
  } catch {
    throw new ServiceUnavailableException('ERM dashboard data is unavailable');
  }
}
