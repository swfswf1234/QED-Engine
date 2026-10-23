/**
 * 使用手册弹窗（`help/sections.ts` 四页正本渲染）
 * 各子界面传入自己的册：`#/` → 总册，`#/knowledge`／`#/learn`／`#/practice` → 对应子册；
 * 总册的三条入口排在「使用说明」之后，子页可返回总册。轻触发不发请求。
 * 节名一律由 `HELP_BLOCK_TITLES[block.kind]` 给出，弹层不自带措辞。
 * 配色＝蓝框白底深字（frontend-overview §2 使用手册弹窗承载，2026-10-16 用户改判撤销同日 C12）：
 * 深蓝只作外框、节标题与入口名，正文一律落在白底上；入口卡内箭头列定宽，名称行与说明行左缘同列。
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { Button, Modal, Typography } from 'antd';
import { ArrowLeftOutlined, CloseOutlined, RightOutlined } from '@ant-design/icons';
import { HELP_BLOCK_TITLES, HELP_CENTER_KEY, HELP_PAGES, type HelpPageKey } from '../help/sections';
import './helpModal.css';

const { Title, Paragraph } = Typography;

const PANEL_FRAME = '#0b2472';
const PANEL_INK = '#14253f';
const PANEL_SUBTLE = '#4a5a78';
const PANEL_LINK = '#1677ff';

/** 入口卡版面：箭头列定宽 + 文本列，名称行与说明行同列左缘齐平（卡面配色见 helpModal.css） */
const ENTRY_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '18px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  width: '100%',
  textAlign: 'left',
};
const ENTRY_ROW: CSSProperties = { display: 'block' };

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  /** 打开时落哪一册（默认学习中心总册） */
  page?: HelpPageKey;
}

export default function HelpModal({ open, onClose, page = HELP_CENTER_KEY }: HelpModalProps) {
  const [view, setView] = useState<HelpPageKey>(page);

  useEffect(() => {
    if (open) setView(page);
  }, [open, page]);

  const current = HELP_PAGES[view];

  return (
    <Modal
      title={<span style={{ color: PANEL_FRAME, fontWeight: 600 }}>使用手册 · {current.title}</span>}
      open={open}
      onCancel={onClose}
      closeIcon={<CloseOutlined style={{ color: PANEL_FRAME }} />}
      footer={null}
      width={720}
      styles={{
        content: { background: '#ffffff', border: `2px solid ${PANEL_FRAME}`, color: PANEL_INK },
        header: { background: '#ffffff', color: PANEL_FRAME },
        body: { color: PANEL_INK, maxHeight: '72vh', overflowY: 'auto' },
      }}
    >
      {view !== HELP_CENTER_KEY && (
        <Button
          type="link"
          style={{ paddingInline: 0, marginBottom: 8 }}
          icon={<ArrowLeftOutlined />}
          onClick={() => setView(HELP_CENTER_KEY)}
        >
          学习中心总手册
        </Button>
      )}

      {current.blocks.map((block, blockIndex) => (
        <div key={block.kind}>
          <Title
            level={5}
            style={{ marginTop: blockIndex === 0 ? 0 : 20, marginBottom: 8, color: PANEL_FRAME }}
          >
            {HELP_BLOCK_TITLES[block.kind]}
          </Title>
          {block.paragraphs?.map((text, i) => (
            <Paragraph key={i} style={{ marginBottom: 6, color: PANEL_INK }}>{text}</Paragraph>
          ))}
          {block.steps && (
            <ol className="help-steps" style={{ color: PANEL_INK }}>
              {block.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          {block.kind === 'usage' && current.entries && (
            <div className="help-entries" style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              {current.entries.map((entry) => (
                <button
                  key={entry.page}
                  type="button"
                  className="help-entry"
                  style={ENTRY_GRID}
                  onClick={() => setView(entry.page)}
                >
                  <RightOutlined style={{ color: PANEL_LINK, marginTop: 4 }} />
                  <span className="help-entry-text" style={ENTRY_ROW}>
                    <span className="help-entry-name" style={{ ...ENTRY_ROW, color: PANEL_FRAME }}>{entry.name}</span>
                    <span className="help-entry-desc" style={{ ...ENTRY_ROW, color: PANEL_SUBTLE }}>{entry.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </Modal>
  );
}
