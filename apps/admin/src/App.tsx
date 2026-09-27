import { Refine, type DataProvider } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { QueryClient } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { createDataProvider } from './data/data-provider.js';
import { StoreWorkspace } from './features/stores/store-workspace.js';
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
  return (
    <Refine
      dataProvider={provider}
      routerProvider={routerProvider}
      options={{ disableTelemetry: true, reactQuery: { clientConfig: queryClient } }}
    >
      <Routes>
        <Route path="/" element={<StoreWorkspace referenceEnabled={referenceEnabled} />} />
        <Route
          path="/stores/:storeId/products/*"
          element={<StoreWorkspace referenceEnabled={referenceEnabled} />}
        />
        <Route
          path="/stores/:storeId/reference/*"
          element={<StoreWorkspace referenceEnabled={referenceEnabled} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Refine>
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
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#315ed0',
          colorTextHeading: '#17243a',
          colorTextSecondary: '#637086',
          colorTextDescription: '#637086',
          colorBgLayout: '#f5f7fb',
          colorBorderSecondary: '#e6ebf2',
          borderRadius: 8,
        },
      }}
    >
      <AntApp>
        <Admin dataProvider={dataProvider} referenceEnabled={referenceEnabled} />
      </AntApp>
    </ConfigProvider>
  );
}
