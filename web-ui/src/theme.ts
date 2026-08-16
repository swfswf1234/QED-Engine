import type { ThemeConfig } from 'antd';

/**
 * QED-Engine 全局主题（设计：frontend-react-refactor「主题与视觉规范」）
 * - 蓝白主体：主色 AntD 蓝色系 #1677ff（深蓝端 #0d5bd4 渐变），背景浅灰蓝，
 *   卡片白色/浅蓝渐变卡面，边框淡蓝
 * - 黑字高对比：文字一律深色（#000 / #333），任何情况下字体与背景保持大区分
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorInfo: '#1677ff',
    colorLink: '#1677ff',
    colorLinkHover: '#4096ff',
    colorBorder: '#d6e4ff',
    colorBorderSecondary: '#e6efff',
    // 高对比：正文纯黑、次级深灰，禁用 AntD 浅灰文字
    colorText: '#000000',
    colorTextSecondary: '#333333',
    colorTextTertiary: '#444444',
    colorTextQuaternary: '#555555',
    colorBgLayout: '#eef3fb',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorPrimaryBg: '#e6f4ff',
    borderRadius: 6,
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Card: {
      headerBg: '#f7faff',
    },
    Button: {
      primaryShadow: '0 2px 6px rgba(22, 119, 255, 0.25)',
    },
  },
};

/** 顶部导航条渐变（蓝白主体的蓝色基准） */
export const headerGradient = 'linear-gradient(90deg, #0d5bd4 0%, #1677ff 100%)';

/** 浅蓝渐变卡面（Hero / 欢迎区） */
export const heroGradient = 'linear-gradient(135deg, #e6f4ff 0%, #ffffff 60%, #f0f5ff 100%)';