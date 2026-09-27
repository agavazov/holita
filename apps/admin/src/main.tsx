import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import 'antd/dist/reset.css';

import { App } from './App.js';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Missing root element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={createBrowserRouter([{ path: '*', element: <App /> }])} />
  </StrictMode>,
);
