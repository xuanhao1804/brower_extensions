import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Speedable — Video Speed Controller',
    description:
      'Control HTML5 video speed with shortcuts, mouse gestures, and presets.',
    permissions: ['storage'],
    browser_specific_settings: {
      gecko: {
        id: '@video-speed-controller.local',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
