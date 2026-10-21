import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { messages, readLanguage } from './app/i18n/messages';
import {
  readAdminConfig,
  readLocalAdminConfig,
  type LocalAdminConfig,
} from './app/core/config/admin-config';

/**
 * The optional, Git-ignored `config.local.json` holds developer browser keys. A 404, or a
 * server's HTML fallback page instead of JSON, means there is none.
 */
async function loadLocalConfig(): Promise<LocalAdminConfig> {
  const response = await fetch('/config.local.json', { signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) {
    return {};
  }
  if (!response.ok) {
    throw new Error('Could not load local admin configuration.');
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return {};
  }
  const value: unknown = await response.json();
  return readLocalAdminConfig(value);
}

// PrimeNG requires its license in the bootstrap providers, before its initializer runs.
async function start(): Promise<void> {
  const response = await fetch('/config.json', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error('Could not load public admin configuration.');
  }
  const value: unknown = await response.json();
  const config = readAdminConfig(value);
  const local = await loadLocalConfig();
  await bootstrapApplication(App, appConfig({ ...config, ...local }));
}

void start().catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('holita-root');
  if (root) {
    const language = readLanguage(window.location.pathname.split('/')[1] ?? null);
    const text = messages[language];
    document.documentElement.lang = language;
    root.setAttribute('role', 'alert');
    root.textContent = text.configurationError;
  }
});
