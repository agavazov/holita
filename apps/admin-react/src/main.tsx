import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { readDataSource } from './config.js';
import { adminMessages, defaultLanguage, isLanguage } from './i18n/i18n.js';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Missing root element.');
}

const start = async () => {
  const dataSource = readDataSource(import.meta.env.VITE_DATA_SOURCE);
  let onResetPrototype: (() => void | Promise<void>) | undefined;
  if (dataSource === 'mock') {
    const { startPrototype } = await import('./mocks/browser.js');
    onResetPrototype = await startPrototype();
  }
  const { App } = await import('./App.js');
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
};

void start().catch((error: unknown) => {
  const prefix = window.location.pathname.split('/')[1] ?? defaultLanguage;
  const language = isLanguage(prefix) ? prefix : defaultLanguage;
  const t = adminMessages.getFixedT(language, 'common');
  document.documentElement.lang = language;
  rootElement.setAttribute('role', 'alert');
  rootElement.textContent = t('errors.startup');
  if (error instanceof Error) {
    const details = document.createElement('p');
    details.textContent = error.message;
    rootElement.append(details);
  }
});
