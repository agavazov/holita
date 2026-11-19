import { loadLocalConfig, loadRuntimeConfig } from '@osnova/ui/app';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { messages, readLanguage } from './app/i18n/messages';
import { readAdminConfig, readLocalAdminConfig } from './app/core/config/admin-config';

// PrimeNG requires its license in the bootstrap providers, before its initializer runs.
async function start(): Promise<void> {
  const config = await loadRuntimeConfig(readAdminConfig);
  const local = await loadLocalConfig(readLocalAdminConfig, {});
  await bootstrapApplication(App, appConfig({ ...config, ...local }));
}

void start().catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('discocan-root');
  if (root) {
    const language = readLanguage(window.location.pathname.split('/')[1] ?? null);
    const text = messages[language];
    document.documentElement.lang = language;
    root.setAttribute('role', 'alert');
    root.textContent = text.configurationError;
  }
});
