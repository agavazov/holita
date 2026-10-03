import { Refine, type DataProvider } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';

import { createDataProvider } from './data/data-provider.js';
import { StoreWorkspace } from './features/stores/store-workspace.js';
import { LocalizationProvider } from './localization/localization-provider.js';
import { localeFromPathname, normalizeLocalePathname } from './localization/locale.js';
import { AuroraTheme } from './theme/aurora-theme.js';
import './app.css';

function Admin({
  dataProvider,
  referenceEnabled,
}: {
  dataProvider?: DataProvider | undefined;
  referenceEnabled: boolean;
}) {
  const [provider] = useState(
    () =>
      dataProvider ??
      createDataProvider(import.meta.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:11080/graphql'),
  );
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPathname = normalizeLocalePathname(location.pathname);
  const locale = localeFromPathname(normalizedPathname) ?? 'bg';

  useEffect(() => {
    if (location.pathname !== normalizedPathname) {
      void navigate(
        { pathname: normalizedPathname, search: location.search, hash: location.hash },
        { replace: true },
      );
    }
  }, [location.hash, location.pathname, location.search, navigate, normalizedPathname]);

  if (location.pathname !== normalizedPathname) return null;

  return (
    <LocalizationProvider locale={locale}>
      <Refine
        dataProvider={provider}
        routerProvider={routerProvider}
        options={{ disableTelemetry: true, reactQuery: { clientConfig: queryClient } }}
      >
        <Routes>
          <Route
            path="/:locale"
            element={<StoreWorkspace referenceEnabled={referenceEnabled} />}
          />
          <Route
            path="/:locale/stores/:storeId/products/*"
            element={<StoreWorkspace referenceEnabled={referenceEnabled} />}
          />
          <Route
            path="/:locale/stores/:storeId/reference/*"
            element={<StoreWorkspace referenceEnabled={referenceEnabled} />}
          />
          <Route path="*" element={<Navigate to={`/${locale}`} replace />} />
        </Routes>
      </Refine>
    </LocalizationProvider>
  );
}

export function App({
  dataProvider,
  referenceEnabled = import.meta.env.VITE_REFERENCE_ENABLED !== 'false',
}: {
  dataProvider?: DataProvider;
  referenceEnabled?: boolean;
}) {
  return (
    <AuroraTheme>
      <Admin dataProvider={dataProvider} referenceEnabled={referenceEnabled} />
    </AuroraTheme>
  );
}
