import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createAdminI18n, type Language } from '../i18n/i18n.js';
import { AuroraTheme } from '../theme/aurora-theme.js';

export function TestProviders({
  children,
  language = 'en',
}: {
  children: ReactNode;
  language?: Language;
}) {
  const [i18n] = useState(() => createAdminI18n(language));
  return (
    <I18nextProvider i18n={i18n}>
      <AuroraTheme language={language}>{children}</AuroraTheme>
    </I18nextProvider>
  );
}
