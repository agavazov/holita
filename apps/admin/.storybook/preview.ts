import { applicationConfig, type Preview } from '@storybook/angular-vite';
import { prepareStory, storybookApplicationConfig } from '../src/storybook/story-config';

const preview: Preview = {
  decorators: [applicationConfig(storybookApplicationConfig())],
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'bg', title: 'Български' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', locale: 'bg' },
  parameters: {
    layout: 'fullscreen',
    // Report accessibility violations in the panel; stories become strict once the theme passes.
    a11y: { test: 'todo' },
  },
  beforeEach: ({ globals, parameters }) => {
    prepareStory(parameters['holita'], globals['theme'], globals['locale']);
  },
};

export default preview;
