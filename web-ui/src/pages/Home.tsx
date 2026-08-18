import { useState } from 'react';
import {
  App, Button, Card, Col, Layout, Modal, Row, Space, Typography,
} from 'antd';
import {
  BookOutlined, ReadOutlined, ScheduleOutlined, SolutionOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader, { AdminEntryButton } from '../components/AppHeader';
import { heroGradient } from '../theme';
import { HELP_SECTIONS } from '../help/sections';

const { Title, Paragraph, Text } = Typography;

/** 三大学习入口（课程学习已开放 → #/knowledge；其余占位卡：入口可见、点击提示建设中） */
const ENTRANCES = [
  {
    key: 'explore',
    icon: <BookOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
    title: '知识探索',
    desc: '知识图谱：按知识节点逐步深入，建立完整认知链路。',
  },
  {
    key: 'course',
    icon: <ReadOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
    title: '课程学习',
    desc: '领域 → 课程依赖 → 知识点梳理，按序推进学习。',
    href: '/knowledge',
  },
  {
    key: 'quiz',
    icon: <SolutionOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
    title: '课后练习',
    desc: '习题训练与自测，检验理解程度。',
  },
];

const ENTRANCE_NAMES: Record<string, string> = Object.fromEntries(
  ENTRANCES.map((e) => [e.key, e.title]),
);

/**
 * 主界面（QED-Engine 学习中心，`#/`）
 * - Hero 欢迎区 + QED 简介 + 三大入口占位卡（点击提示建设中）
 * - 右上角：使用手册（HELP_SECTIONS 五阶段内容迁移）+ 后台管理
 * - 零后台痕迹：不展示任何服务状态
 */
export default function Home() {
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onEntranceClick = (key: string) => {
    const entrance = ENTRANCES.find((e) => e.key === key);
    if (entrance?.href) {
      navigate(entrance.href);
      return;
    }
    message.info(`「${ENTRANCE_NAMES[key]}」建设中，将在后续轮次开放`);
  };

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
          <Paragraph style={{ fontSize: 15, marginBottom: 8 }}>
            从公理到证明，重构数学认知边界。以高等数学起步，逐步构建你的
            <Text strong>个人图书馆</Text>。
          </Paragraph>
          <Paragraph style={{ marginBottom: 0, color: '#333333' }}>
            学习中心仍在建设中：功能随数据管线逐步开放，入口已就位。
          </Paragraph>
        </Card>

        {/* 三大入口卡（等高：Card 撑满 Col，描述区固定两行对齐） */}
        <Row gutter={[16, 16]}>
          {ENTRANCES.map((e) => (
            <Col xs={24} sm={8} key={e.key}>
              <Card
                hoverable
                onClick={() => onEntranceClick(e.key)}
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

      {/* 使用手册弹窗（迁移 HELP_SECTIONS） */}
      <Modal
        title={<Space><ScheduleOutlined />使用手册</Space>}
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={null}
        width={720}
      >
        {HELP_SECTIONS.map((s) => (
          <div key={s.title} style={{ marginBottom: 20 }}>
            <Title level={5} style={{ marginBottom: 8 }}>
              {s.title}
            </Title>
            <ol style={{ marginTop: 0, paddingLeft: 22, color: '#000000' }}>
              {s.steps.map((step, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </Modal>
    </Layout>
  );
}