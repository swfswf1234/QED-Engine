import { useState } from 'react';
import {
  Button, Card, Col, Layout, Row, Space, Typography,
} from 'antd';
import {
  BookOutlined, ReadOutlined, SolutionOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader, { AdminEntryButton } from '../components/AppHeader';
import HelpModal from '../components/HelpModal';
import { HELP_PAGES } from '../help/sections';
import { heroGradient } from '../theme';

const { Title, Paragraph, Text } = Typography;

/**
 * 三大学习入口（三卡各指独立面：知识探索 → #/knowledge，课程学习 → #/learn，课后练习 → #/practice）
 * 一句话文案取总册三条入口（`help/sections.ts` 单一事实源，卡片与手册不漂移）。
 */
const ENTRANCES = ([
  { key: 'explore', page: 'knowledge', title: '知识探索', href: '/knowledge', icon: <BookOutlined style={{ fontSize: 32, color: '#1677ff' }} /> },
  { key: 'course', page: 'course', title: '课程学习', href: '/learn', icon: <ReadOutlined style={{ fontSize: 32, color: '#1677ff' }} /> },
  { key: 'quiz', page: 'practice', title: '课后练习', href: '/practice', icon: <SolutionOutlined style={{ fontSize: 32, color: '#1677ff' }} /> },
] as const).map((entry) => ({
  ...entry,
  desc: HELP_PAGES.center.entries?.find((e) => e.page === entry.page)?.desc ?? '',
}));

/**
 * 主界面（QED-Engine 学习中心，`#/`）
 * - Hero 欢迎区 + QED 简介 + 三大入口卡（各指一面，REQ-106 起三面齐备）
 * - 右上角：使用手册（学习中心总册）+ 后台管理
 * - 零后台痕迹：不展示任何服务状态
 */
export default function Home() {
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Space>
            <Button onClick={() => setHelpOpen(true)} style={{ color: '#ffffff', borderColor: '#ffffff', background: 'transparent' }}>
              使用手册
            </Button>
            <AdminEntryButton />
          </Space>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
        {/* Hero 区：浅蓝渐变卡面 */}
        <Card style={{ background: heroGradient, border: '1px solid #d6e4ff', marginBottom: 24 }}>
          <Title level={1} style={{ marginBottom: 12 }}>
            QED-Engine 学习中心
          </Title>
          <Paragraph style={{ fontSize: 15, marginBottom: 0 }}>
            从公理到证明，重构数学认知边界。以高等数学起步，逐步构建你的
            <Text strong>个人图书馆</Text>。
          </Paragraph>
        </Card>

        {/* 三大入口卡（等高：Card 撑满 Col，描述区固定两行对齐） */}
        <Row gutter={[16, 16]}>
          {ENTRANCES.map((e) => (
            <Col xs={24} sm={8} key={e.key}>
              <Card
                hoverable
                onClick={() => navigate(e.href)}
                style={{ height: '100%' }}
                styles={{ body: { textAlign: 'center', padding: 32 } }}
              >
                <div style={{ marginBottom: 12 }}>{e.icon}</div>
                <Title level={4} style={{ marginBottom: 8 }}>
                  {e.title}
                </Title>
                <Paragraph
                  style={{ marginBottom: 0, color: '#333333', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {e.desc}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </Layout.Content>

      {/* 使用手册弹窗（四页册，此处落学习中心总册） */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Layout>
  );
}