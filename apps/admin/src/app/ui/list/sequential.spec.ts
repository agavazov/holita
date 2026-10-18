import { runSequential } from './sequential';

describe('runSequential', () => {
  it('runs in order, keeps partial failures and reports progress', async () => {
    const calls: string[] = [];
    const progress: [number, number][] = [];
    const result = await runSequential(
      ['a', 'b', 'c'],
      async (item) => {
        calls.push(item);
        await Promise.resolve();
        if (item === 'b') throw new Error('b is blocked');
      },
      {
        isCurrent: () => true,
        progress: (done, total) => progress.push([done, total]),
        errorText: (error) => (error instanceof Error ? error.message : 'unknown'),
      },
    );
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(result).toEqual({
      succeeded: ['a', 'c'],
      failures: [{ item: 'b', message: 'b is blocked' }],
      stopped: false,
    });
  });

  it('sends no further item once the view retires but lets the submitted write settle', async () => {
    let current = true;
    let settled = false;
    const calls: number[] = [];
    const progress = vi.fn();
    const result = await runSequential(
      [1, 2, 3],
      async (item) => {
        calls.push(item);
        current = false;
        await Promise.resolve();
        settled = true;
      },
      { isCurrent: () => current, progress, errorText: () => 'failed' },
    );
    expect(calls).toEqual([1]);
    expect(settled).toBe(true);
    expect(progress).not.toHaveBeenCalled();
    expect(result).toEqual({ succeeded: [1], failures: [], stopped: true });
  });
});
