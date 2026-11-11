import { messages, type Language } from '../i18n/messages';
import type { PageContext } from '../layout/navigation';

/**
 * Page destinations that are more specific than the sidebar. Account and notification entries
 * reserve their metadata for the packages that add those pages; they do not create routes.
 */
export function pageMetadata(language: Language, path: string): PageContext | null {
  const text = messages[language];
  const segments = (path.split(/[?#]/, 1)[0] ?? path).split('/').filter(Boolean);
  const [routeLanguage, branchId, namespace, resource, recordId, tab, detail] = segments;
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
      group: text.system,
      page: text.users,
      pageLink: ['/', language, 'settings', 'users'],
    };
  }
  if (!branchId || namespace !== 'fleet') {
    return null;
  }
  const fleet = ['/', language, branchId, 'fleet'];
  if (resource === 'settings' && (recordId === 'general' || recordId === 'groups')) {
    return {
      group: text.system,
      page: text.settings,
      pageLink: [...fleet, 'settings', 'general'],
      tab: recordId === 'general' ? text.settingsGeneral : text.vehicleGroups,
    };
  }
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
          group: text.dashboardOld,
          page,
          title: `${page} · ${text.dashboardOld}`,
          pageLink: [...fleet, 'dashboard', recordId ?? 'overview'],
        }
      : null;
  }
  if (resource === 'drivers' && recordId && tab === 'scorecard') {
    return {
      group: text.fleet,
      page: text.drivers,
      pageLink: [...fleet, 'drivers'],
      recordLink: [...fleet, 'drivers', recordId],
      tab: text.driverScorecard,
    };
  }
  if (resource === 'vehicles' && recordId && tab && tab !== 'edit') {
    const vehicleTab =
      tab === 'overview'
        ? text.overview
        : tab === 'problems'
          ? text.problems
          : tab === 'trips'
            ? text.trips
            : tab === 'maintenance'
              ? text.maintenance
              : tab === 'commands'
                ? text.commands
                : null;
    // Drawers opened from a profile tab: the tab is their parent unless it is the overview.
    const drawer =
      detail === 'odometer'
        ? text.odometerReading
        : detail === 'edit'
          ? text.editRecord
          : !segments[7]
            ? null
            : detail === 'trips'
              ? text.tripDetail
              : detail === 'alerts'
                ? text.alertDetail
                : detail === 'service'
                  ? text.serviceTask
                  : null;
    return vehicleTab
      ? {
          group: text.fleet,
          page: text.vehicles,
          pageLink: [...fleet, 'vehicles'],
          ...(drawer
            ? {
                recordLink: [...fleet, 'vehicles', recordId, 'overview'],
                ...(tab === 'overview'
                  ? {}
                  : {
                      ancestors: [
                        { label: vehicleTab, link: [...fleet, 'vehicles', recordId, tab] },
                      ],
                    }),
                tab: drawer,
              }
            : tab === 'overview'
              ? {}
              : { recordLink: [...fleet, 'vehicles', recordId, 'overview'], tab: vehicleTab }),
        }
      : null;
  }
  if (resource !== 'devices' || !recordId || !tab || tab === 'edit') {
    return null;
  }
  const deviceTab =
    tab === 'overview'
      ? text.deviceOverview
      : tab === 'problems'
        ? text.problems
        : tab === 'commands'
          ? text.commands
          : tab === 'console'
            ? text.commandConsole
            : tab === 'sms-commands'
              ? text.smsCommands
              : tab === 'parameters'
                ? text.parameters
                : tab === 'technical-details' && detail === 'events'
                  ? text.events
                  : tab === 'technical-details' && detail === 'frames'
                    ? text.frames
                    : null;
  return deviceTab
    ? {
        group: text.fleet,
        page: text.devices,
        pageLink: [...fleet, 'devices'],
        recordLink: [...fleet, 'devices', recordId, 'overview'],
        ...(tab === 'technical-details'
          ? {
              ancestors: [
                {
                  label: text.technicalDetails,
                  link: [...fleet, 'devices', recordId, 'technical-details', 'events'],
                },
              ],
            }
          : {}),
        tab: deviceTab,
      }
    : null;
}
