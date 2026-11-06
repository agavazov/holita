/// <reference types="google.maps" />
import { signal } from '@angular/core';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const authenticationFailed = signal(false);
export const googleMapsAuthenticationFailed = authenticationFailed.asReadonly();
let configured = false;

/** The official loader is configured once for every map in the browser. */
export function loadGoogleMaps(key: string) {
  if (!configured) {
    window.gm_authFailure = () => {
      authenticationFailed.set(true);
    };
    setOptions({ key, v: 'quarterly' });
    configured = true;
  }
  return Promise.all([importLibrary('maps'), importLibrary('marker')]);
}
