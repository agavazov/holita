import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { messages } from './app/i18n/messages';
import { readAdminConfig } from './app/core/config/admin-config';

// PrimeNG requires its license in the bootstrap providers, before its initializer runs.
async function start(): Promise<void> {
  const response = await fetch('/config.json', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Could not load public admin configuration.');
  const value: unknown = await response.json();
  await bootstrapApplication(App, appConfig(readAdminConfig(value)));
}

void start().catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('holita-root');
  if (root) root.textContent = messages.bg.configurationError;
});
