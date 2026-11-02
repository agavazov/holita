import type { StoryObj } from '@storybook/angular-vite';
import { AdminWorkspace } from '../app/workspace/admin-workspace';
import { KarmaWorkspace } from '../app/features/karma-client/karma-workspace';
import { routeAt, StoryApp } from './story-config';

/** Opens a real Karma page in the toolbar language, with the shared story transport. */
export function karmaRoute(path: string): NonNullable<StoryObj['render']> {
  const render = routeAt(`karma-client/${path}`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}
