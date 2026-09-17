import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Video Speed Controller',
    description:
      'Điều chỉnh tốc độ video bằng phím tắt, chuột và các tốc độ cài sẵn.',
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
