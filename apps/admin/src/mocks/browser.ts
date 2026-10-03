import { graphqlEndpoint, prototypeGraphqlPath } from '../config.js';
import { createPrototypeState } from './state.js';
import { openPrototypeMediaStorage } from './media-storage.js';

export async function startPrototype() {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    throw new Error('Prototype requires browser storage. Enable it and reload.');
  }
  const images = await openPrototypeMediaStorage();
  const state = createPrototypeState(storage, images);
  await images.prune(state.retainedMediaIds());
  // Validate storage before importing libraries that may read it during initialization.
  const [{ setupWorker }, { createPrototypeHandlers }] = await Promise.all([
    import('msw/browser'),
    import('./handlers.js'),
  ]);
  const worker = setupWorker(...createPrototypeHandlers(graphqlEndpoint('mock'), state));
  await worker.start({
    quiet: true,
    onUnhandledFrame: ({ frame, defaults }) => {
      if (frame.protocol !== 'http') return;
      const data: unknown = frame.data;
      if (
        typeof data !== 'object' ||
        data === null ||
        !('request' in data) ||
        !(data.request instanceof Request)
      )
        return;
      const url = new URL(data.request.url);
      if (
        url.origin !== window.location.origin ||
        url.pathname === prototypeGraphqlPath ||
        url.pathname.startsWith('/__prototype/') ||
        url.pathname.endsWith('/graphql')
      )
        defaults.error();
    },
  });
  return async () => {
    // Reset the logical dataset first; even failed byte cleanup cannot revive uploads.
    state.reset();
    await images.prune([]).catch(() => {
      // Unreferenced bytes are inaccessible and cleanup is retried on startup.
      console.warn('Unused Prototype image cleanup deferred until reload.');
    });
  };
}
