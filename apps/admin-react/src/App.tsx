import { Refine, type DataProvider } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { flushSync } from 'react-dom';
import { I18nextProvider } from 'react-i18next';

import { createDataProvider } from './data/data-provider.js';
import { graphqlEndpoint, readDataSource, type DataSource } from './config.js';
import { PrototypeControls } from './features/prototype/prototype-controls.js';
import { StoreWorkspace } from './features/stores/store-workspace.js';
import { AuroraTheme } from './theme/aurora-theme.js';
import { createAdminI18n, defaultLanguage, isLanguage, type Language } from './i18n/i18n.js';
import { useRefineI18nProvider } from './i18n/use-refine-i18n-provider.js';
import { languagePath, useLanguage } from './i18n/routing.js';
import './app.css';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

type AdminProps = {
  dataProvider?: DataProvider | undefined;
  referenceEnabled: boolean;
  dataSource: DataSource;
  onResetPrototype: (() => void | Promise<void>) | undefined;
  queryClient: QueryClient;
};

function LocalizedAdmin({ language, ...props }: AdminProps & { language: Language }) {
  const [i18n] = useState(() => createAdminI18n(language));
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <I18nextProvider i18n={i18n}>
      <Admin {...props} />
    </I18nextProvider>
  );
}

function Admin({
  dataProvider,
  referenceEnabled,
  dataSource,
  onResetPrototype,
  queryClient,
}: AdminProps) {
  const language = useLanguage();
  const i18nProvider = useRefineI18nProvider();
  const [provider] = useState(
    () =>
      dataProvider ??
      createDataProvider(graphqlEndpoint(dataSource, import.meta.env.VITE_GATEWAY_URL), language),
  );
  const workspace = (
    <StoreWorkspace
      referenceEnabled={referenceEnabled}
      dataSource={dataSource}
      controls={
        dataSource === 'mock' && onResetPrototype ? (
          <PrototypeControls onReset={onResetPrototype} />
        ) : undefined
      }
    />
  );
  return (
    <Refine
      dataProvider={provider}
      routerProvider={routerProvider}
      i18nProvider={i18nProvider}
      options={{ disableTelemetry: true, reactQuery: { clientConfig: queryClient } }}
    >
      <Routes>
        <Route index element={workspace} />
        <Route path="stores/:storeId/products/*" element={workspace} />
        <Route path="stores/:storeId/reference/*" element={workspace} />
        <Route path="stores/:storeId/ui-catalog" element={workspace} />
        <Route path="*" element={<Navigate to={languagePath('/', language)} replace />} />
      </Routes>
    </Refine>
  );
}

export function App({
  dataProvider,
  dataSource = readDataSource(import.meta.env.VITE_DATA_SOURCE),
  referenceEnabled = dataSource === 'mock' || import.meta.env.VITE_REFERENCE_ENABLED !== 'false',
  onResetPrototype,
}: {
  dataProvider?: DataProvider;
  referenceEnabled?: boolean;
  dataSource?: DataSource;
  onResetPrototype?: (() => void | Promise<void>) | undefined;
}) {
  const [queryClient, setQueryClient] = useState(createQueryClient);
  const [prototypeGeneration, setPrototypeGeneration] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.split('/')[1] ?? '';
  const hasLanguage = isLanguage(prefix);
  const language = hasLanguage ? prefix : defaultLanguage;
  const resetPrototype = onResetPrototype
    ? async () => {
        await onResetPrototype();
        // Remount Refine and dirty editors before navigating to fresh store discovery.
        flushSync(() => {
          setPrototypeGeneration((generation) => generation + 1);
          setQueryClient(createQueryClient());
        });
        void navigate(languagePath('/', language), {
          replace: true,
        });
      }
    : undefined;
  return (
    <AuroraTheme language={language}>
      <Routes key={prototypeGeneration}>
        <Route
          path="/:language?/*"
          element={
            hasLanguage ? (
              <LocalizedAdmin
                key={language}
                language={language}
                dataProvider={dataProvider}
                referenceEnabled={referenceEnabled}
                dataSource={dataSource}
                onResetPrototype={resetPrototype}
                queryClient={queryClient}
              />
            ) : (
              <Navigate
                to={languagePath(
                  location.pathname + location.search + location.hash,
                  defaultLanguage,
                )}
                replace
              />
            )
          }
        />
      </Routes>
    </AuroraTheme>
  );
}
