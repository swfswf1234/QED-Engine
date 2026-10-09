/**
 * 学习链路三栏件（M1 裁决 D1：三栏工作台内「链路」模式，D2 块绑真实解析产物，D3 勾选式推进）
 * - ChainTreePane＝左栏：从目录生成链路 → 两级确认 → 编译；块带 confirmed/covered/gen_status/drift 标记
 * - ChainBodyPane＝中栏：选中块的正文（有页窗＝按批取解析产物按版式渲染；无页窗＝骨架占位文本＋待生成标记）
 * - ChainProgressPane＝右栏：只读渲染 `GET …/progress`（total/done/skipped/percent/completed）＋ 结课面板 ＋ 学完/跳过/撤销
 * 规格正本：docs/history/plans/2026-10/2026-09-23-learning-ui-rendering.md「UI-2~UI-4 实施方案」；数据一律经 8900（ADR 0007）
 */
import { Alert, Button, Empty, Progress, Space, Spin, Tag, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import BlockList from '../parsing/BlockList';
import { blocksOf } from '../parsing/CompareView';
import type { TypographyPrefs } from '../parsing/typography';
import type { LearnUnit, OutlineRow } from '../../api/learn';
import { CHAIN_PAGE_BATCH, useLearnChainStore, windowOfUnit } from '../../stores/learnChain';

const { Text } = Typography;

export interface ChainPanesProps {
  courseId: string;
  outline: OutlineRow[];
  bookId: string | null;
  typography: TypographyPrefs;
}

function statusTag(unit: LearnUnit): { label: string; color: string } {
  if (unit.covered) return { label: '已学完', color: 'success' };
  if (unit.gen_status === 'generated') return { label: '待学', color: 'default' };
  return { label: '未编译', color: 'warning' };
}

/** 左栏：链路生成与确认门 + 块序列导航 */
export function ChainTreePane({ outline, bookId }: ChainPanesProps) {
  const learnCourse = useLearnChainStore((s) => s.learnCourse);
  const units = useLearnChainStore((s) => s.units);
  const selectedUnitId = useLearnChainStore((s) => s.selectedUnitId);
  const busy = useLearnChainStore((s) => s.busy);
  const compiling = useLearnChainStore((s) => s.compiling);
  const notice = useLearnChainStore((s) => s.notice);
  const generateFromOutline = useLearnChainStore((s) => s.generateFromOutline);
  const confirmAll = useLearnChainStore((s) => s.confirmAll);
  const compile = useLearnChainStore((s) => s.compile);
  const selectUnit = useLearnChainStore((s) => s.selectUnit);
  const clearNotice = useLearnChainStore((s) => s.clearNotice);
  const navigate = useNavigate();

  if (!learnCourse) {
    return (
      <Empty description="这门课还没有登记学习课程" image={Empty.PRESENTED_IMAGE_SIMPLE}>
        <Button size="small" type="primary" onClick={() => navigate('/learn')}>去书架创建</Button>
      </Empty>
    );
  }

  const sections = units.filter((u) => u.level === 'section');
  const blocks = units.filter((u) => u.level === 'unit');
  const allConfirmed = blocks.length > 0 && blocks.every((u) => u.confirmed);

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Button
          size="small"
          type="primary"
          loading={busy}
          disabled={!bookId || outline.length === 0}
          onClick={() => void generateFromOutline(outline, bookId ?? '')}
        >
          从目录生成链路
        </Button>
        <Button size="small" disabled={blocks.length === 0 || allConfirmed} onClick={() => void confirmAll()}>
          全部确认
        </Button>
        <Button size="small" loading={compiling} disabled={blocks.length === 0} onClick={() => void compile()}>
          编译链路
        </Button>
      </Space>
      {blocks.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          还没有学习链路：在「阅读」模式导入目录后，点「从目录生成链路」（章→节两级，块带原书页窗）。
        </Text>
      ) : (
        <ul data-testid="chain-tree" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {sections.map((section) => (
            <li key={section.unit_id} style={{ marginTop: 6 }}>
              <Text strong style={{ fontSize: 13 }}>{section.title}</Text>
              <ul style={{ margin: 0, paddingLeft: 12, listStyle: 'none' }}>
                {blocks
                  .filter((unit) => unit.parent_id === section.unit_id)
                  .map((unit) => {
                    const tag = statusTag(unit);
                    return (
                      <li key={unit.unit_id}>
                        <Button
                          type={unit.unit_id === selectedUnitId ? 'primary' : 'text'}
                          size="small"
                          block
                          style={{ textAlign: 'left' }}
                          onClick={() => void selectUnit(unit.unit_id)}
                        >
                          {unit.title}
                          <Tag style={{ marginLeft: 6 }} color={tag.color}>{tag.label}</Tag>
                          {!unit.confirmed && <Tag color="warning">未确认</Tag>}
                          {unit.drift && <Tag color="error">过期</Tag>}
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {notice} <Button size="small" type="link" onClick={clearNotice}>清除</Button>
        </Text>
      )}
    </Space>
  );
}

/** 中栏：块正文（页窗＝真实解析产物；无页窗＝骨架占位） */
export function ChainBodyPane({ typography }: ChainPanesProps) {
  const units = useLearnChainStore((s) => s.units);
  const selectedUnitId = useLearnChainStore((s) => s.selectedUnitId);
  const bookId = useLearnChainStore((s) => s.bookId);
  const pages = useLearnChainStore((s) => s.pages);
  const loadedThrough = useLearnChainStore((s) => s.loadedThrough);
  const loadMorePages = useLearnChainStore((s) => s.loadMorePages);

  const unit = units.find((u) => u.unit_id === selectedUnitId) ?? null;
  if (!unit) return <Empty description="先在左栏选中一个学习块" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const window = windowOfUnit(unit);
  if (!window) {
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space size={6} wrap>
          <Text strong>{unit.title}</Text>
          <Tag>{unit.type ?? 'text'}</Tag>
        </Space>
        <div data-testid="chain-skeleton-body">
          <Tag color="orange">骨架占位（M-2 生成后替换）</Tag>
          <Text>{String(unit.payload?.text ?? '这个块还没有正文：编译时未绑定书页窗。')}</Text>
        </div>
      </Space>
    );
  }

  const pageNumbers = Object.keys(pages).map(Number).sort((a, b) => a - b);
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Text strong>{unit.title}</Text>
        <Tag>{unit.type ?? 'text'}</Tag>
        <Tag color="blue" icon={<LinkOutlined />}>第 {window.page_start}–{window.page_end} 页</Tag>
      </Space>
      {bookId && pageNumbers.map((pageNo) => {
        const entry = pages[pageNo];
        if (!entry || entry.loading) return <Spin key={pageNo} size="small" />;
        if (!entry.parsed) {
          return (
            <Text key={pageNo} type="secondary">
              第 {pageNo} 页：{entry.error ?? '无解析产物'}
            </Text>
          );
        }
        const blocks = blocksOf(entry.data);
        return (
          <div key={pageNo}>
            <Text type="secondary" style={{ fontSize: 12 }}>第 {pageNo} 页</Text>
            <BlockList
              bookId={bookId}
              pageNo={pageNo}
              blocks={blocks}
              edits={{}}
              renderMode="layout"
              imageSize={null}
              pageImageUrl={entry.data?.image_url ?? null}
              typography={typography}
              selectedIndex={-1}
              editMode={false}
              onSelect={() => undefined}
              onSubmit={async () => false}
            />
          </div>
        );
      })}
      {loadedThrough < window.page_end && (
        <Button size="small" onClick={() => void loadMorePages()}>
          继续加载 {Math.max(0, Math.min(CHAIN_PAGE_BATCH, window.page_end - loadedThrough))} 页
        </Button>
      )}
    </Space>
  );
}

/** 右栏：看板与推进（只读派生 + 学习者勾选） */
export function ChainProgressPane() {
  const learnCourse = useLearnChainStore((s) => s.learnCourse);
  const progress = useLearnChainStore((s) => s.progress);
  const units = useLearnChainStore((s) => s.units);
  const selectedUnitId = useLearnChainStore((s) => s.selectedUnitId);
  const mark = useLearnChainStore((s) => s.mark);
  const jumpToCurrent = useLearnChainStore((s) => s.jumpToCurrent);

  if (!learnCourse || !progress) {
    return <Empty description="本课未登记学习课程，无进度可读" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  const selected = units.find((u) => u.unit_id === selectedUnitId) ?? null;
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      {progress.completed && (
        <Alert
          data-testid="chain-completion"
          type="success"
          showIcon
          message="已结课"
          description={`已学 ${progress.done}/${progress.total} · 跳过 ${progress.skipped} —— 块序列已全部推进完；掌握门与判分归主链 M-3。`}
        />
      )}
      <Progress percent={progress.percent} size="small" />
      <Text type="secondary" style={{ fontSize: 12 }}>
        已学 {progress.done}/{progress.total} · 跳过 {progress.skipped}
      </Text>
      <Space size={6} wrap>
        <Button size="small" onClick={() => void jumpToCurrent()}>回到断点</Button>
        <Button size="small" type="primary" disabled={!selected} onClick={() => selected && void mark(selected.unit_id, 'done')}>
          标记学完
        </Button>
        <Button size="small" disabled={!selected} onClick={() => selected && void mark(selected.unit_id, 'skipped')}>
          跳过
        </Button>
        <Button size="small" disabled={!selected} onClick={() => selected && void mark(selected.unit_id, 'pending')}>
          撤销
        </Button>
      </Space>
      <Text type="secondary" style={{ fontSize: 12 }}>
        进度由服务端读时派生（重算非累加）；掌握门与判分归主链 M-3。
      </Text>
    </Space>
  );
}
