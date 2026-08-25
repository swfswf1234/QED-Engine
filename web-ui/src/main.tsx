import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import { theme } from './theme';
import App from './App';

// 探索 mock 开关（localStorage `qed-explore-mock`：'1' 开 / 其他或缺省关）。
// 2026-08-24 用户裁决：移除 DEV 自动种子——QED-Tracker 已上线，默认走真实 API；
// 需要 mock 预览时在控制台显式 setItem('qed-explore-mock','1') 后刷新。

const root = document.getElementById('root');
if (!root) {
  throw new Error('root element not found');
}

createRoot(root).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);