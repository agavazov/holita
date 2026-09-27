export type FieldError = { path: string; message: string };
export class DataError extends Error {
  readonly statusCode = 400;
  constructor(
    message: string,
    readonly requestId?: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'DataError';
  }
}
// GraphQL provider reduces errors to strings; retain only the public validation details.
export function responseFieldErrors(body: unknown): FieldError[] {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('errors' in body) ||
    !Array.isArray(body.errors)
  )
    return [];
  return body.errors.flatMap((error: unknown) => {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('extensions' in error) ||
      typeof error.extensions !== 'object' ||
      error.extensions === null ||
      !('fieldErrors' in error.extensions) ||
      !Array.isArray(error.extensions.fieldErrors)
    )
      return [];
    return error.extensions.fieldErrors.slice(0, 30).flatMap((field: unknown) => {
      if (
        typeof field !== 'object' ||
        field === null ||
        !('path' in field) ||
        !('message' in field) ||
        typeof field.path !== 'string' ||
        typeof field.message !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9]*$/.test(field.path) ||
        field.message.length > 300
      )
        return [];
      return [{ path: field.path, message: field.message }];
    });
  });
}
