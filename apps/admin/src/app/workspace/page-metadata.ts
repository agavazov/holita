import { messages, type Language } from '../i18n/messages';
import type { PageContext } from '../layout/navigation';

/**
 * Page destinations that are more specific than the sidebar. Account and notification entries
 * reserve their metadata for the packages that add those pages; they do not create routes.
 */
export function pageMetadata(language: Language, path: string): PageContext | null {
  const text = messages[language];
  const segments = (path.split(/[?#]/, 1)[0] ?? path).split('/').filter(Boolean);
  const [routeLanguage, branchId, namespace, resource, recordId, tab, technicalTab] = segments;
  if (routeLanguage !== language) {
    return null;
  }
  if (segments.length === 2 && branchId === 'profile') {
    return { group: '', page: text.profile };
  }
  if (segments.length === 2 && branchId === 'sign-in') {
    return { group: '', page: text.signIn };
  }
  if (branchId === 'settings' && namespace === 'users') {
    return {
      group: text.settings,
      page: text.users,
      pageLink: ['/', language, 'settings', 'users'],
    };
  }
  if (!branchId || namespace !== 'fleet') {
    return null;
  }
  const fleet = ['/', language, branchId, 'fleet'];
  if (resource === 'notifications') {
    return {
      group: '',
      page: text.notifications,
      pageLink: [...fleet, 'notifications'],
    };
  }
  if (resource === 'dashboard') {
    const page =
      recordId === 'overview'
        ? text.overview
        : recordId === 'problems'
          ? text.problems
          : recordId === 'trips'
            ? text.trips
            : null;
    return page
      ? {
          group: text.dashboard,
          page,
          title: `${page} · ${text.dashboard}`,
          pageLink: [...fleet, 'dashboard', recordId ?? 'overview'],
        }
      : null;
  }
  if (resource !== 'devices' || !recordId || !tab || tab === 'edit') {
    return null;
  }
  const deviceTab =
    tab === 'overview'
      ? text.overview
      : tab === 'problems'
        ? text.problems
        : tab === 'commands'
          ? text.commands
          : tab === 'sms-commands'
            ? text.smsCommands
            : tab === 'parameters'
              ? text.parameters
              : tab === 'technical-details' && technicalTab === 'events'
                ? `${text.technicalDetails} — ${text.events}`
                : tab === 'technical-details' && technicalTab === 'frames'
                  ? `${text.technicalDetails} — ${text.frames}`
                  : null;
  return deviceTab
    ? { group: '', page: text.devices, pageLink: [...fleet, 'devices'], tab: deviceTab }
    : null;
}
