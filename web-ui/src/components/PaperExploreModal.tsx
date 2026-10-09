/**
 * 论文探索管理弹窗（REQ-102 W4，downloads-ui.md §4.4；形态对齐 ExploreFlowModal）
 * - 三段流转：发起（配方 前沿|核心 + 目标 + 可选 arXiv 分类）→ 轮询（store 驱动，每 5 秒）
 *   → 评审与落位（逐条勾选 + 逐条落位选择器 领域|该领域下课程 → 确认采纳）→ 采纳结果
 * - ⑤′ 论文没有默认桶：落位领域恒取当前弹窗领域，不由前端补任何默认 scope
 * - 采纳不自动下载（对方裁决 #5）：结果段提示书行停在待下载，取书在书目详情弹窗显式发起
 * - 关闭不打断后台轮询；「待评审/失败」徽标重开直达评审段（幂等，不重复发起任务）
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Checkbox, Modal, Radio, Select, Space, Spin, Tag, Typography,
} from 'antd';
import { useDownloadsStore } from '../stores/downloads';
import {
  isCandidateInStock, paperFlowPhase, usePaperExploreStore,
} from '../stores/paperExplore';
import type { CourseRecord } from '../stores';
import type { PaperRecipe } from '../stores/paperExplore';

const { Text } = Typography;

const EMPTY_COURSES: CourseRecord[] = [];

export default function PaperExploreModal() {
  const modalOpen = usePaperExploreStore((s) => s.modalOpen);
  const domainId = usePaperExploreStore((s) => s.domainId);
  const domainName = usePaperExploreStore((s) => s.domainName);
  const task = usePaperExploreStore((s) => s.task);
  const selection = usePaperExploreStore((s) => s.selection);
  const adopted = usePaperExploreStore((s) => s.adopted);
  const error = usePaperExploreStore((s) => s.error);
  const launching = usePaperExploreStore((s) => s.launching);
  const adopting = usePaperExploreStore((s) => s.adopting);
  const start = usePaperExploreStore((s) => s.start);
  const adopt = usePaperExploreStore((s) => s.adopt);
  const closeModal = usePaperExploreStore((s) => s.closeModal);
  const clearError = usePaperExploreStore((s) => s.clearError);

  const [recipe, setRecipe] = useState<PaperRecipe>('frontier');
  const [goal, setGoal] = useState('');
  const [categories, setCategories] = useState('');
  const [pickedRanks, setPickedRanks] = useState<number[]>([]);
  const [placements, setPlacements] = useState<Record<number, string>>({});

  const paperBooks = useDownloadsStore((s) => s.paperBooks);
  const domains = useDownloadsStore((s) => s.domains);
  // zustand v5 选择器必须返回稳定引用：课程列表在组件内派生，不在选择器里 ?? [] 造新数组
  const courses = useMemo(
    () => domains.find((d) => d.domain_id === domainId)?.courses ?? EMPTY_COURSES,
    [domains, domainId],
  );
  const stockTitles = useMemo(
    () => paperBooks.filter((b) => b.kind === 'paper').map((b) => b.title),
    [paperBooks],
  );

  const phase = paperFlowPhase({ task, selection, adopted, error });

  // 换报告即重置评审勾选（避免跨报告残留 rank）
  useEffect(() => {
    setPickedRanks([]);
    setPlacements({});
  }, [selection?.selection_id]);

  const entries = selection?.assessments ?? [];
  const recommendedRanks = useMemo(
    () => new Set((selection?.recommendations ?? []).map((rank) => Number(rank))),
    [selection],
  );

  const placementOptions = [
    { value: '', label: `本领域（${domainName || domainId || ''}）` },
    ...courses.map((c) => ({ value: c.course_id, label: c.name })),
  ];

  const submitAdopt = () => {
    const picks = [...pickedRanks].sort((a, b) => a - b).map((rank) => ({
      rank,
      domain_id: domainId ?? '',
      course_id: placements[rank] ?? '',
    }));
    void adopt(picks);
  };

  let footer;
  if (phase === 'form') {
    footer = [
      <Button key="cancel" onClick={closeModal}>取消</Button>,
      <Button
        key="start" type="primary" loading={launching}
        disabled={!domainId}
        onClick={() => {
          const list = categories.split(',').map((item) => item.trim()).filter(Boolean);
          void start({ domainId: domainId ?? '', recipe, ...(goal.trim() ? { goal: goal.trim() } : {}), ...(list.length > 0 ? { categories: list } : {}) });
        }}
      >
        开始探索
      </Button>,
    ];
  } else if (phase === 'running') {
    footer = [<Button key="bg" onClick={closeModal}>后台运行</Button>];
  } else if (phase === 'review') {
    footer = [
      <Button key="close" onClick={closeModal}>关闭</Button>,
      <Button key="adopt" type="primary" loading={adopting} disabled={pickedRanks.length === 0} onClick={submitAdopt}>
        确认采纳({pickedRanks.length})
      </Button>,
    ];
  } else if (phase === 'failed') {
    footer = [
      <Button key="back" onClick={clearError}>返回修改</Button>,
      <Button key="close" type="primary" onClick={closeModal}>关闭</Button>,
    ];
  } else {
    footer = [<Button key="close" type="primary" onClick={closeModal}>关闭</Button>];
  }

  return (
    <Modal
      title={`论文探索 · ${domainName}`}
      open={modalOpen}
      onCancel={closeModal}
      width={760}
      footer={footer}
      data-testid="paper-explore-modal"
    >
      {error && phase !== 'review' && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />
      )}

      {phase === 'form' && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">检索配方</Text>
            <div>
              <Radio.Group value={recipe} onChange={(e) => setRecipe(e.target.value as PaperRecipe)}>
                <Radio value="frontier">前沿</Radio>
                <Radio value="core">核心</Radio>
              </Radio.Group>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              前沿=近年新工作优先；核心=奠基性/经典论文优先。
            </Text>
          </div>
          <div>
            <Text type="secondary">探索目标（可选）</Text>
            <Inputish placeholder="本次探索目标（可空，默认取领域描述）" value={goal} onChange={setGoal} />
          </div>
          <div>
            <Text type="secondary">arXiv 分类（可选）</Text>
            <Inputish placeholder="如 cs.AI, math.NA（领域映射不到 arXiv 分类时必填）" value={categories} onChange={setCategories} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            探索仅由领域发起；确认后的论文可逐条落位到本领域或本领域下课程。
          </Text>
        </Space>
      )}

      {phase === 'running' && task && (
        <Space direction="vertical">
          <Space>
            <Spin size="small" />
            <Text strong>探索进行中 · {task.progress}%</Text>
            <Text type="secondary">每 5 秒轮询 · 会话 {task.task_id}</Text>
          </Space>
          {task.message && <Text type="secondary">{task.message}</Text>}
          <Text type="secondary" style={{ fontSize: 12 }}>可点「后台运行」关闭弹窗，检索继续在后台执行。</Text>
        </Space>
      )}

      {phase === 'review' && selection && (
        <>
          <div style={{ marginBottom: 8 }}>
            <Text strong>候选（{entries.length} 篇）</Text>
            <Text type="secondary"> · 仅勾选取舍并逐条选落位，采纳后写入 kind=paper 书行</Text>
          </div>
          {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}
          <div className="paper-candidate-list">
            {entries.map((item) => {
              const arxivId = item.candidate.identifiers?.arxiv ?? item.candidate.provider_id;
              const inStock = isCandidateInStock(item, stockTitles);
              const selectable = recommendedRanks.has(item.rank) && !inStock;
              const checked = pickedRanks.includes(item.rank);
              return (
                <div key={item.rank} className="paper-candidate-row" style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Space align="start" style={{ width: '100%' }}>
                    <Checkbox
                      checked={checked}
                      disabled={!selectable}
                      onChange={(e) => setPickedRanks((prev) => (
                        e.target.checked ? [...prev, item.rank] : prev.filter((rank) => rank !== item.rank)
                      ))}
                    />
                    <div style={{ flex: 1 }}>
                      <Space wrap size={6}>
                        <Text strong>{item.candidate.title}</Text>
                        {inStock && <Tag color="default">已在库</Tag>}
                        {!recommendedRanks.has(item.rank) && <Tag>未达推荐线</Tag>}
                        <Tag color="blue">总分 {item.score}</Tag>
                        <Text type="secondary">相关度 {item.assessment.goal_fit}</Text>
                      </Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {[item.candidate.authors.join('、'), item.candidate.year, arxivId].filter(Boolean).join(' · ')}
                        </Text>
                      </div>
                      <div>
                        <Text style={{ fontSize: 12 }}>{item.assessment.reason}</Text>
                      </div>
                    </div>
                    <Select
                      aria-label={`落位 ${item.candidate.title}`}
                      size="small"
                      style={{ width: 180 }}
                      disabled={!selectable}
                      value={placements[item.rank] ?? ''}
                      options={placementOptions}
                      onChange={(value) => setPlacements((prev) => ({ ...prev, [item.rank]: value }))}
                    />
                  </Space>
                </div>
              );
            })}
          </div>
        </>
      )}

      {phase === 'adopted' && adopted && (
        <Space direction="vertical">
          <Alert
            type="success" showIcon
            message={`已建书行 ${adopted.filter((row) => row.status === 'created').length} 条（重复 ${adopted.filter((row) => row.status !== 'created').length} 条）`}
            description="论文书行停在待下载：采纳不自动下载，在论文行点开条目可在书目详情发起自动下载。"
          />
          {adopted.map((row) => (
            <Text key={`${row.rank}-${row.book_id}`} type="secondary" style={{ fontSize: 12 }}>
              序号 {row.rank} · {row.book_id || row.arxiv_id} · {row.status === 'created' ? '已建' : `未重复建（${row.reason ?? '已在库'}）`}
            </Text>
          ))}
        </Space>
      )}

      {phase === 'failed' && (
        <Space direction="vertical">
          <Text type="secondary">检索未产生候选或任务失败，可返回修改目标/分类后重试。</Text>
        </Space>
      )}
    </Modal>
  );
}

/** 受控单行输入（弹窗内轻量封装，避免每个字段写一遍 onChange） */
function Inputish({ placeholder, value, onChange }: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="ant-input"
      style={{ width: '100%', marginTop: 4 }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
