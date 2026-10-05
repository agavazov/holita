import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { messages } from './app/i18n/messages';

bootstrapApplication(App, appConfig).catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('holita-root');
  if (root) root.textContent = messages.bg.configurationError;
});
