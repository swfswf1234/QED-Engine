import { useMemo, useState } from 'react';
import { Button, Layout, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChartOutlined, ControlOutlined, DownloadOutlined, FileSearchOutlined,
  HomeOutlined, PictureOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const MENU_ITEMS = [
  { key: '/admin', icon: <ControlOutlined />, label: '控制台' },
  { key: '/admin/dashboard', icon: <BarChartOutlined />, label: '仪表盘' },
  { key: '/admin/downloads', icon: <DownloadOutlined />, label: '下载管理' },
  { key: '/admin/parsing', icon: <FileSearchOutlined />, label: '解析进度' },
  { key: '/admin/compare', icon: <PictureOutlined />, label: '原始文档对照' },
];

/** 管理台统一布局：左侧导航（控制台/仪表盘/下载管理/解析进度/原始文档对照互切）+ 内容区（嵌套路由） */
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/admin/dashboard')) return '/admin/dashboard';
    if (location.pathname.startsWith('/admin/downloads')) return '/admin/downloads';
    if (location.pathname.startsWith('/admin/parsing')) return '/admin/parsing';
    if (location.pathname.startsWith('/admin/compare')) return '/admin/compare';
    return '/admin';
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
      <Layout>
        <Outlet />
      </Layout>
    </Layout>
  );
}