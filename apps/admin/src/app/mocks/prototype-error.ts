export class PrototypeError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'PrototypeError';
  }
}
