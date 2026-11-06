import type { Routes, UrlMatcher } from '@angular/router';
import { redirectLegacyAdminUrl } from '../../workspace/legacy-admin-redirect';

const legacyControlCenterRoute: UrlMatcher = (segments) =>
  segments[1]?.path === 'control-center' ? { consumed: segments } : null;

export const controlCenterRoutes: Routes = [
  { matcher: legacyControlCenterRoute, canMatch: [redirectLegacyAdminUrl], children: [] },
];
