import type { BranchNavigation } from '@osnova/ui/app';

export function branchNavigation(fleetEnabled: boolean): BranchNavigation {
  return {
    defaultDestination: (language, id) => ['/', language, id, 'fleet', 'live'],
    selectionDestination: (language, id, section) => {
      const resource = section[2]?.path;
      const tab = section[3]?.path;
      let destination = ['live'];
      if (fleetEnabled && section[1]?.path === 'fleet') {
        if (resource === 'dashboard' && tab && ['overview', 'problems', 'trips'].includes(tab)) {
          destination = ['dashboard', tab];
        } else if (resource === 'settings' && (tab === 'groups' || tab === 'general')) {
          destination = ['settings', tab];
        } else if (
          resource &&
          ['vehicles', 'devices', 'drivers', 'maintenance', 'notifications'].includes(resource)
        ) {
          destination = [resource];
        }
      }
      return ['/', language, id, 'fleet', ...destination];
    },
  };
}
