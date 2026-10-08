import { createPrototypeState } from './state';
import { PrototypeError } from './prototype-error';
import { openPrototypeMediaStorage } from './media-storage';

export async function startPrototype(endpoint: string): Promise<() => Promise<void>> {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    throw new PrototypeError('Prototype requires browser storage. Enable it and reload.');
  }
  const images = await openPrototypeMediaStorage();
  const state = createPrototypeState(storage, images);
  await images.prune(state.retainedMediaIds());
  const [{ setupWorker }, { createPrototypeHandlers }] = await Promise.all([
    import('msw/browser'),
    import('./handlers'),
  ]);
  const worker = setupWorker(...createPrototypeHandlers(endpoint, state));
  await worker
    .start({
      quiet: true,
      onUnhandledFrame: 'bypass',
    })
    .catch(() => {
      throw new PrototypeError('Prototype service worker could not start.');
    });
  return async () => {
    state.reset();
    // Logical Reset succeeds before orphan cleanup; startup retries physical cleanup.
    await images.prune([]).catch(() => {
      console.warn('Prototype image cleanup will be retried on reload.');
    });
  };
}
