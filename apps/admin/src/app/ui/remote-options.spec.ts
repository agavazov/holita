import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { RemoteOptions } from './remote-options';

interface Option {
  readonly id: string;
  readonly label: string;
}

function create(
  load: (search: string, ids: readonly string[] | null) => Observable<readonly Option[]>,
) {
  const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  const options = runInInjectionContext(injector, () => new RemoteOptions(load));
  return { options, injector };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RemoteOptions', () => {
  it('debounces searches and keeps only the latest answer', async () => {
    const calls: string[] = [];
    const answers = new Map<string, Subject<readonly Option[]>>();
    const { options, injector } = create((search) => {
      calls.push(search);
      const answer = new Subject<readonly Option[]>();
      answers.set(search, answer);
      return answer;
    });
    options.search('c');
    options.search('ca ');
    await wait(300);
    expect(calls).toEqual(['ca']);
    expect(options.loading()).toBe(true);
    options.search('cb');
    await wait(300);
    answers.get('ca')?.next([{ id: 'old', label: 'Obsolete' }]);
    answers.get('cb')?.next([{ id: 'v1', label: 'CB 1001 AX' }]);
    answers.get('cb')?.complete();
    expect(options.options()).toEqual([{ id: 'v1', label: 'CB 1001 AX' }]);
    expect(options.loading()).toBe(false);
    injector.destroy();
  });

  it('hydrates selected IDs at once and reports failures', async () => {
    const { options, injector } = create((_search, ids) =>
      ids ? of(ids.map((id) => ({ id, label: id }))) : throwError(() => new Error('offline')),
    );
    options.hydrate(['v7']);
    await wait(0);
    expect(options.options()).toEqual([{ id: 'v7', label: 'v7' }]);
    options.search('x');
    await wait(300);
    expect(options.error()).toBeInstanceOf(Error);
    expect(options.loading()).toBe(false);
    injector.destroy();
  });
});
