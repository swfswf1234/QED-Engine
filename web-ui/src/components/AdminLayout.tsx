import { useEffect, useMemo, useState } from 'react';
import { Button, Layout, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChartOutlined, ControlOutlined, DownloadOutlined, FileSearchOutlined,
  HistoryOutlined, HomeOutlined,
} from '@ant-design/icons';
import AppHeader from './AppHeader';
import { useRuntimeStore } from '../stores/runtime';

const { Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: '/admin', icon: <ControlOutlined />, label: '控制台' },
  { key: '/admin/dashboard', icon: <BarChartOutlined />, label: '仪表盘' },
  { key: '/admin/downloads', icon: <DownloadOutlined />, label: '文档下载管理' },
  { key: '/admin/parsing', icon: <FileSearchOutlined />, label: '文档解析管理' },
  { key: '/admin/llm-calls', icon: <HistoryOutlined />, label: '模型调用记录' },
];

/**
 * 管理台统一布局（2026-08-24 布局重构）：全宽品牌顶栏置顶，左侧菜单与内容区在其下展开
 * （此前各页自带 AppHeader 被夹在 Sider 右侧，视觉上菜单「顶出」上边栏）。
 * - 左侧导航：控制台 / 仪表盘 / 文档下载管理 / 文档解析管理 / 模型调用记录互切 + 主界面返回
 *   （2026-08-18：解析进度改名「文档解析管理」，原始文档对照能力并入其右侧，D7 裁决）
 * - 挂载时经全局 runtime store 拉取一次服务/GPU/依赖探测快照——数据层共享，跨页存活
 *   不重复拉取；fetchAll 自带 loading 防重入（页面补拉只发一轮）
 * - 各页动作按钮（刷新/同步等）由页面自持，置于其标题行右侧（动作下沉，方案 A）
 */
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    void useRuntimeStore.getState().fetchAll();
  }, []);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/admin/dashboard')) return '/admin/dashboard';
    if (location.pathname.startsWith('/admin/downloads')) return '/admin/downloads';
    if (location.pathname.startsWith('/admin/parsing')) return '/admin/parsing';
    if (location.pathname.startsWith('/admin/llm-calls')) return '/admin/llm-calls';
    return '/admin';
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 全宽品牌顶栏：QED-Engine 从公理到证明（无 actions；页面按钮已下沉各自标题行） */}
      <AppHeader />
      <Layout style={{ background: '#eef3fb', minHeight: 'calc(100vh - 56px)' }}>
        <Sider
          collapsible collapsed={collapsed} onCollapse={setCollapsed}
          theme="light" width={200}
          style={{ borderRight: '1px solid #e8e8e8', position: 'relative' }}
        >
          <div
            style={{
              height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 16, color: '#1677ff', whiteSpace: 'nowrap',
            }}
          >
            {collapsed ? 'QED' : 'QED 管理台'}
          </div>
          <Menu
            mode="inline" selectedKeys={[selectedKey]}
            items={MENU_ITEMS} onClick={({ key }) => navigate(key)}
            style={{ borderInlineEnd: 'none' }}
          />
          <div style={{ position: 'absolute', bottom: 16, width: '100%', textAlign: 'center' }}>
            <Button type="link" icon={<HomeOutlined />} onClick={() => navigate('/')}>
              {collapsed ? '' : '主界面'}
            </Button>
          </div>
        </Sider>
        <Content>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
