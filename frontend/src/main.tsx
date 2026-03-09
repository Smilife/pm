import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { RouterProvider } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { router } from './router';
import './styles.css';

dayjs.locale('zh-cn');

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1f7a6d',
          colorInfo: '#1f7a6d',
          borderRadius: 16,
          fontFamily: 'IBM Plex Sans, Noto Sans SC, Segoe UI, sans-serif',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>,
);
