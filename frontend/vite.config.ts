import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function packageChunkName(id: string) {
  const [, modulePath] = id.split('node_modules/');
  if (!modulePath) {
    return undefined;
  }

  const segments = modulePath.split('/');
  const packageName = segments[0].startsWith('@')
    ? `${segments[0].slice(1)}-${segments[1] ?? 'pkg'}`
    : segments[0];

  if (['react', 'react-dom', 'scheduler'].includes(packageName)) {
    return 'vendor-react';
  }

  if (['react-router', 'react-router-dom'].includes(packageName)) {
    return 'vendor-router';
  }

  if (packageName.startsWith('tanstack-')) {
    return 'vendor-query';
  }

  if (packageName === 'dayjs') {
    return 'vendor-date';
  }

  if (['ant-design-icons', 'ant-design-icons-svg'].includes(packageName)) {
    return 'vendor-antd-icons';
  }

  if (packageName === 'antd') {
    if (/\/(date-picker|calendar|time-picker)\//.test(id)) {
      return 'vendor-antd-date';
    }

    if (/\/(table|tabs|tree|cascader|select|form|transfer)\//.test(id)) {
      return 'vendor-antd-data';
    }

    return 'vendor-antd-core';
  }

  if (['rc-picker', 'rc-select', 'rc-tree', 'rc-table', 'rc-field-form'].includes(packageName)) {
    return `vendor-${packageName}`;
  }

  if (packageName.startsWith('rc-')) {
    return 'vendor-rc-misc';
  }

  if (packageName.startsWith('emotion-')) {
    return 'vendor-emotion';
  }

  if (packageName.startsWith('ant-design-')) {
    return 'vendor-antd-support';
  }

  return 'vendor-misc';
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          return packageChunkName(id);
        },
      },
    },
  },
});