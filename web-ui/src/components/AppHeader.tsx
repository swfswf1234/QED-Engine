import { Button, Layout, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { headerGradient } from '../theme';

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  /** 右侧动作区（按钮组），如「后台管理」「返回主界面」 */
  actions?: React.ReactNode;
}

/**
 * 全局顶部导航（蓝底白字渐变，QED 统一视觉；黑字高对比：蓝底配白字）
 * 共用组件：全部界面（Home / Console / Dashboard / Downloads）统一骨架。
 */
export default function AppHeader({ actions }: AppHeaderProps) {
  return (
    <Header
      style={{
        background: headerGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: 32,
        height: 56,
        lineHeight: '56px',
      }}
    >
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Space size={8}>
          <Text strong style={{ color: '#ffffff', fontSize: 18, letterSpacing: 1 }}>
            QED-Engine
          </Text>
          <Text style={{ color: '#d6e4ff', fontSize: 13 }}>从公理到证明</Text>
        </Space>
      </Link>
      {actions ? <Space>{actions}</Space> : null}
    </Header>
  );
}

/** 「后台管理」入口按钮（主界面动作用） */
export function AdminEntryButton() {
  return (
    <Link to="/admin">
      <Button type="primary" ghost style={{ color: '#ffffff', borderColor: '#ffffff' }}>
        后台管理
      </Button>
    </Link>
  );
}