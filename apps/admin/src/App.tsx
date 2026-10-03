import { Refine, type DataProvider } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import { flushSync } from 'react-dom';

import { createDataProvider } from './data/data-provider.js';
import { graphqlEndpoint, readDataSource, type DataSource } from './config.js';
import { PrototypeControls } from './features/prototype/prototype-controls.js';
import { StoreWorkspace } from './features/stores/store-workspace.js';
import { AuroraTheme } from './theme/aurora-theme.js';
import './app.css';

function Admin({
  dataProvider,
  referenceEnabled,
  dataSource,
  onResetPrototype,
}: {
  dataProvider?: DataProvider | undefined;
  referenceEnabled: boolean;
  dataSource: DataSource;
  onResetPrototype: (() => void | Promise<void>) | undefined;
}) {
  const [provider] = useState(
    () =>
      dataProvider ??
      createDataProvider(graphqlEndpoint(dataSource, import.meta.env.VITE_GATEWAY_URL)),
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
      options={{ disableTelemetry: true, reactQuery: { clientConfig: queryClient } }}
    >
      <Routes>
        <Route path="/" element={workspace} />
        <Route path="/stores/:storeId/products/*" element={workspace} />
        <Route path="/stores/:storeId/reference/*" element={workspace} />
        <Route path="/stores/:storeId/ui-catalog" element={workspace} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
  const [prototypeGeneration, setPrototypeGeneration] = useState(0);
  const navigate = useNavigate();
  const resetPrototype = onResetPrototype
    ? async () => {
        await onResetPrototype();
        // Remount Refine and dirty editors before navigating to fresh store discovery.
        flushSync(() => {
          setPrototypeGeneration((generation) => generation + 1);
        });
        void navigate('/', { replace: true });
      }
    : undefined;
  return (
    <AuroraTheme>
      <Admin
        key={prototypeGeneration}
        dataProvider={dataProvider}
        referenceEnabled={referenceEnabled}
        dataSource={dataSource}
        onResetPrototype={resetPrototype}
      />
    </AuroraTheme>
  );
}
