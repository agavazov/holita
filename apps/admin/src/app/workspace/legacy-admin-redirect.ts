import { inject } from '@angular/core';
import {
  RedirectCommand,
  Router,
  UrlSegment,
  type CanMatchFn,
  type UrlMatcher,
} from '@angular/router';

const segment = (path: string) => new UrlSegment(path, {});

/** Rewrite only section/tab segments; IDs, matrix parameters and drawer suffixes survive. */
function destination(segments: UrlSegment[]): UrlSegment[] | null {
  const [branch, section, resource, record, tab, ...tail] = segments;
  if (!branch) {
    return null;
  }
  const fleet = [branch, segment('fleet')];
  const dashboard = [...fleet, segment('dashboard')];
  if (section?.path === 'control-center') {
    if (!resource) {
      return [...dashboard, segment('overview')];
    }
    if (resource.path === 'sms' && !record) {
      return [...fleet, segment('devices')];
    }
    if (resource.path === 'devices' && record) {
      return [...fleet, resource, record, ...deviceTab(tab), ...tail];
    }
  }
  if (section?.path === 'reference' && !resource) {
    return [...dashboard, segment('overview')];
  }
  if (section?.path !== 'fleet') {
    return null;
  }
  if (!resource) {
    return [...dashboard, segment('overview')];
  }
  if (resource.path === 'overview' || resource.path === 'alerts' || resource.path === 'trips') {
    const target = resource.path === 'alerts' ? 'problems' : resource.path;
    return [...dashboard, segment(target), ...segments.slice(3)];
  }
  if (resource.path === 'dashboard' && !record) {
    return [...dashboard, segment('overview')];
  }
  if (resource.path === 'vehicles' && record && tab) {
    const target =
      tab.path === 'alerts' ? 'problems' : tab.path === 'service' ? 'maintenance' : null;
    return target
      ? [...fleet, resource, record, new UrlSegment(target, tab.parameters), ...tail]
      : null;
  }
  if (resource.path === 'devices' && record && record.path !== 'new') {
    if (!tab || ['diagnostics', 'alarms', 'sms', 'events', 'frames'].includes(tab.path)) {
      return [...fleet, resource, record, ...deviceTab(tab), ...tail];
    }
  }
  return null;
}

function deviceTab(tab: UrlSegment | undefined): UrlSegment[] {
  if (!tab) {
    return [segment('overview')];
  }
  if (tab.path === 'diagnostics' || tab.path === 'alarms') {
    return [new UrlSegment('problems', tab.parameters)];
  }
  if (tab.path === 'sms') {
    return [new UrlSegment('sms-commands', tab.parameters)];
  }
  if (tab.path === 'events' || tab.path === 'frames') {
    return [segment('technical-details'), tab];
  }
  return [tab];
}

export const legacyFleetRoute: UrlMatcher = (segments) =>
  segments[1]?.path !== 'control-center' && destination(segments) ? { consumed: segments } : null;

/** Compatibility navigation never leaves an obsolete entry in browser history. */
export const redirectLegacyAdminUrl: CanMatchFn = () => {
  const router = inject(Router);
  const navigation = router.currentNavigation();
  if (!navigation) {
    return false;
  }
  const url = router.parseUrl(router.serializeUrl(navigation.extractedUrl));
  const primary = url.root.children['primary'];
  const language = primary?.segments[0];
  const previous = primary?.segments.slice(1) ?? [];
  const next = destination(previous);
  if (!primary || !language || !next) {
    return false;
  }
  primary.segments = [language, ...next];
  if (previous[1]?.path === 'control-center' && previous[2]?.path === 'sms') {
    url.queryParams = { ...url.queryParams, hint: 'choose-device-sms' };
  }
  return new RedirectCommand(url, { replaceUrl: true });
};
