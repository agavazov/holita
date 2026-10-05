import 'i18next';

import type { defaultNamespace, resources } from './i18n.js';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNamespace;
    resources: typeof resources.en;
    enableSelector: false;
  }
}
