export function loadDesignPage() {
  return import('./design-page').then((module) => module.DesignPage);
}
