import {
  render as testingLibraryRender,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactNode } from 'react';

import { LocalizationProvider } from '../localization/localization-provider.js';
import type { AdminLocale } from '../localization/locale.js';

export * from '@testing-library/react';

export function render(
  ui: ReactNode,
  options: RenderOptions & { locale?: AdminLocale } = {},
): RenderResult {
  const { locale = 'en', wrapper: Wrapper, ...renderOptions } = options;

  return testingLibraryRender(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <LocalizationProvider locale={locale}>
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </LocalizationProvider>
    ),
  });
}
