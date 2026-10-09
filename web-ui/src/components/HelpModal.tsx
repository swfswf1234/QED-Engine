/**
 * 使用手册弹窗（HELP_SECTIONS 正本渲染）
 * 主界面与知识梳理星图页共用；轻触发不发请求，纯前端内容。
 */
import { Modal, Space, Typography } from 'antd';
import { ScheduleOutlined } from '@ant-design/icons';
import { HELP_SECTIONS } from '../help/sections';

const { Title } = Typography;

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      title={<Space><ScheduleOutlined />使用手册</Space>}
      open={open}
      onCancel={onClose}
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
  );
}
