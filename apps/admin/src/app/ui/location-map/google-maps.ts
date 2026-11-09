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
function configureGoogleMaps(key: string): void {
  if (!configured) {
    window.gm_authFailure = () => {
      authenticationFailed.set(true);
    };
    setOptions({ key, v: 'quarterly' });
    configured = true;
  }
}

export function loadGoogleMaps(key: string) {
  configureGoogleMaps(key);
  return Promise.all([importLibrary('maps'), importLibrary('marker')]);
}

export function loadGoogleStreetView(key: string) {
  configureGoogleMaps(key);
  return importLibrary('streetView');
}
