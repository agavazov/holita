import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { readDataSource } from './config.js';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Missing root element.');
}

async function start() {
  const dataSource = readDataSource(import.meta.env.VITE_DATA_SOURCE);
  let onResetPrototype: (() => void | Promise<void>) | undefined;
  if (import.meta.env.VITE_DATA_SOURCE === 'mock') {
    const { startPrototype } = await import('./mocks/browser.js');
    onResetPrototype = await startPrototype();
  }
  const { App } = await import('./App.js');
  if (rootElement === null) return;
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider
        router={createBrowserRouter([
          {
            path: '*',
            element: <App dataSource={dataSource} onResetPrototype={onResetPrototype} />,
          },
        ])}
      />
    </StrictMode>,
  );
}

void start().catch((error: unknown) => {
  rootElement.setAttribute('role', 'alert');
  rootElement.textContent =
    error instanceof Error ? error.message : 'Admin could not start. Reload and try again.';
});
