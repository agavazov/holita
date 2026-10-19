export interface SequentialResult<T> {
  readonly succeeded: readonly T[];
  readonly failures: readonly { readonly item: T; readonly message: string }[];
  /** True when the view retired before every item was sent. */
  readonly stopped: boolean;
}

/**
 * Runs one write per item, in order (bulk delete, deactivate, acknowledge, resolve). Once
 * `isCurrent()` is false no further item is sent; a write already submitted still settles.
 */
export async function runSequential<T>(
  items: readonly T[],
  action: (item: T) => Promise<unknown>,
  options: {
    isCurrent(): boolean;
    progress(done: number, total: number): void;
    errorText(error: unknown, item: T): string;
  },
): Promise<SequentialResult<T>> {
  const succeeded: T[] = [];
  const failures: { item: T; message: string }[] = [];
  let done = 0;
  for (const item of items) {
    if (!options.isCurrent()) {
      return { succeeded, failures, stopped: true };
    }
    try {
      await action(item);
      succeeded.push(item);
    } catch (error: unknown) {
      failures.push({ item, message: options.errorText(error, item) });
    }
    done++;
    if (options.isCurrent()) {
      options.progress(done, items.length);
    }
  }
  return { succeeded, failures, stopped: false };
}
