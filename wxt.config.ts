import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'MR Header Injector',
    description: '按页面域名注入 GitLab MR 请求头',
    version: '0.1.0',
    permissions: ['storage', 'declarativeNetRequest'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'MR Header Injector',
    },
    ...(browser !== 'firefox' ? { minimum_chrome_version: '101' } : {}),
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'mr-header-injector@quinngetty.dev',
              strict_min_version: '113.0',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
});
