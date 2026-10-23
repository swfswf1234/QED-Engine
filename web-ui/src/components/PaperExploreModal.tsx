/**
 * 论文探索管理弹窗（REQ-102 W4 起，REQ-108 I3~I5 五段，REQ-109 I9~I11 第二轮；REQ-107 壳 §5~§7、§11）
 * - 五段：段①探索设置（检索方向四值／领域描述／可选目标／可选分类／历史探索清单收成单按钮）→ 段②轮询
 *   → 段③检索口径（先看怎么检索）→ 段④候选评审与落位 → 段⑤采纳回执
 * - 段①不露推荐上限：一次探索恒 `top=5`，参数由 `paperDirections` 纯函数按检索方向映射（R8/R9）
 * - 段③→段④ 是唯一前进路径；段④只列**未采纳且达线**（§11.5），未达线与已剔除都折叠只读
 * - 历史清单只列待决定报告（新的在前），点行**直达段④**继续确认／否定（§11.4 第二轮修订，R11）
 * - ⑤′ 论文没有默认桶：落位领域恒取当前弹窗领域，不由前端补任何默认 scope
 * - 采纳不自动下载（对方裁决 #5）：结果段提示书行停在待下载，取书在书目详情弹窗显式发起
 * - 关闭不打断后台轮询；三处入口首屏一律段①（§4）
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Checkbox, Collapse, Modal, Radio, Select, Space, Spin, Table, Tag, Typography,
} from 'antd';
import { useDownloadsStore } from '../stores/downloads';
import {
  isCandidateInStock, paperFlowPhase, usePaperExploreStore,
} from '../stores/paperExplore';
import {
  PAPER_DIRECTIONS, PAPER_TOP_PER_LAUNCH, composePaperLaunch, directionPolicy,
} from '../paperDirections';
import type { PaperDirection } from '../paperDirections';
import { buildShortlist, candidateArxivId } from '../paperShortlist';
import PaperCandidateDetail from './PaperCandidateDetail';
import type {
  CourseRecord, PaperCandidateEntry, PaperSearchPlanEntry, PaperSelectionDetail,
} from '../stores';

const { Text } = Typography;

const EMPTY_COURSES: CourseRecord[] = [];

/** 历史清单的状态列（8901 报告 status → 中文；未识别值原样显示） */
const HISTORY_STATUS_LABEL: Record<string, string> = {
  planning: '计划中',
  ranked: '待评审',
  no_candidates: '无候选',
  no_recommendations: '无达线',
  downloaded: '已取书',
};

function shortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return (iso || '').slice(0, 16).replace('T', ' ');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PaperExploreModal() {
  const modalOpen = usePaperExploreStore((s) => s.modalOpen);
  const domainId = usePaperExploreStore((s) => s.domainId);
  const domainName = usePaperExploreStore((s) => s.domainName);
  const courseName = usePaperExploreStore((s) => s.courseName);
  const task = usePaperExploreStore((s) => s.task);
  const selection = usePaperExploreStore((s) => s.selection);
  const adopted = usePaperExploreStore((s) => s.adopted);
  const error = usePaperExploreStore((s) => s.error);
  const launching = usePaperExploreStore((s) => s.launching);
  const adopting = usePaperExploreStore((s) => s.adopting);
  const stage = usePaperExploreStore((s) => s.stage);
  const history = usePaperExploreStore((s) => s.history);
  const start = usePaperExploreStore((s) => s.start);
  const adopt = usePaperExploreStore((s) => s.adopt);
  const closeModal = usePaperExploreStore((s) => s.closeModal);
  const clearError = usePaperExploreStore((s) => s.clearError);
  const toPlan = usePaperExploreStore((s) => s.toPlan);
  const toReview = usePaperExploreStore((s) => s.toReview);
  const toSettings = usePaperExploreStore((s) => s.toSettings);
  const loadHistory = usePaperExploreStore((s) => s.loadHistory);
  const openReport = usePaperExploreStore((s) => s.openReport);

  const [direction, setDirection] = useState<PaperDirection>('frontier');
  const [goal, setGoal] = useState('');
  const [categories, setCategories] = useState('');
  const [pickedRanks, setPickedRanks] = useState<number[]>([]);
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

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
  const domainDescription = useMemo(
    () => domains.find((d) => d.domain_id === domainId)?.description ?? '',
    [domains, domainId],
  );

  const phase = paperFlowPhase({ task, selection, adopted, error, stage });
  const policy = directionPolicy(direction);
  const launch = useMemo(
    () => composePaperLaunch({
      domainId: domainId ?? '',
      direction,
      goal,
      domainDescription,
      categories: categories.split(',').map((item) => item.trim()).filter(Boolean),
    }),
    [domainId, direction, goal, domainDescription, categories],
  );

  // 段①打开即拉历史清单（旁路面，失败静默）
  useEffect(() => {
    if (modalOpen && phase === 'form' && domainId) void loadHistory(domainId);
  }, [modalOpen, phase, domainId, loadHistory]);

  // 换领域或重开弹窗时收起历史清单（I13：清单默认不展开）
  useEffect(() => { setHistoryOpen(false); }, [modalOpen, domainId]);

  // 换报告即重置评审勾选与展开（避免跨报告残留 rank）
  useEffect(() => {
    setPickedRanks([]);
    setPlacements({});
    setExpandedRank(null);
  }, [selection?.selection_id]);

  const entries = selection?.assessments ?? [];
  // 剔除集合＝后端已入库（报告 excluded_existing）∪ 前端已采纳（本地 paper 书行命中）
  const stockArxivIds = useMemo(() => {
    const set = new Set(selection?.excluded_existing ?? []);
    for (const item of entries) {
      if (isCandidateInStock(item, stockTitles)) set.add(candidateArxivId(item));
    }
    return set;
  }, [entries, stockTitles, selection]);
  const shortlist = useMemo(() => buildShortlist(entries, stockArxivIds), [entries, stockArxivIds]);

  // 段④默认全选待选区间（未采纳且达线），用户可改
  useEffect(() => {
    if (phase !== 'review') return;
    setPickedRanks(shortlist.eligible.map((item) => item.rank));
  }, [phase, shortlist]);

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
        disabled={!domainId || Boolean(launch.error) || launch.body === null}
        onClick={() => { if (launch.body) void start(launch.body); }}
      >
        发起探索
      </Button>,
    ];
  } else if (phase === 'running') {
    footer = [<Button key="bg" onClick={closeModal}>后台运行</Button>];
  } else if (phase === 'plan') {
    footer = [
      <Button key="settings" onClick={toSettings}>回段①调参</Button>,
      <Button key="close" onClick={closeModal}>关闭</Button>,
      <Button key="review" type="primary" onClick={toReview}>进入候选评审</Button>,
    ];
  } else if (phase === 'review') {
    footer = [
      <Button key="back" onClick={toPlan}>看检索口径</Button>,
      <Button key="close" onClick={closeModal}>关闭</Button>,
      <Button key="adopt" type="primary" loading={adopting} disabled={pickedRanks.length === 0} onClick={submitAdopt}>
        采纳所选（不自动下载）({pickedRanks.length})
      </Button>,
    ];
  } else if (phase === 'failed') {
    footer = [
      <Button key="back" onClick={clearError}>改参数重试</Button>,
      <Button key="close" type="primary" onClick={closeModal}>关闭</Button>,
    ];
  } else {
    footer = [<Button key="close" type="primary" onClick={closeModal}>关闭</Button>];
  }

  return (
    <Modal
      title={`论文探索 · ${domainName}${courseName ? `（${courseName}）` : ''}`}
      open={modalOpen}
      onCancel={closeModal}
      width={820}
      footer={footer}
      data-testid="paper-explore-modal"
    >
      {error && phase !== 'review' && phase !== 'plan' && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />
      )}

      {phase === 'form' && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">检索方向</Text>
            <div>
              <Radio.Group
                value={direction}
                onChange={(e) => setDirection(e.target.value as PaperDirection)}
              >
                {PAPER_DIRECTIONS.map((item) => (
                  <Radio key={item.direction} value={item.direction}>{item.label}</Radio>
                ))}
              </Radio.Group>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>{policy.hint}</Text>
          </div>
          {domainDescription && (
            <div>
              <Text type="secondary">领域描述（本次探索目标缺省取此）</Text>
              <div><Text style={{ fontSize: 12 }}>{domainDescription}</Text></div>
            </div>
          )}
          <div>
            <Text type="secondary">探索目标（可选）</Text>
            <Inputish placeholder="本次探索目标（可空，默认取领域描述）" value={goal} onChange={setGoal} />
            {launch.error && (
              <Text type="danger" style={{ fontSize: 12 }} data-testid="direction-error">{launch.error}</Text>
            )}
          </div>
          <div>
            <Text type="secondary">arXiv 分类（可选）</Text>
            <Inputish placeholder="如 cs.AI, math.NA（领域映射不到 arXiv 分类时必填）" value={categories} onChange={setCategories} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }} data-testid="launch-summary">
            本次下发：方向 {policy.label} ｜ 配方 {policy.recipe} ｜ 年窗 {yearsLabel(policy.yearsLimit)}
            {' ｜ '}每组抓取 {limitLabel(policy.limit)} ｜ 一次推荐 {PAPER_TOP_PER_LAUNCH} 篇
          </Text>
          {launch.body?.goal && (
            <Text type="secondary" style={{ fontSize: 12 }} data-testid="launch-goal">
              实际下发的探索目标：{launch.body.goal}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            上述参数决定本次检索的年窗、抓取量与分类范围；具体检索计划由模型在任务内生成，任务成功后可查看。
          </Text>
          <div>
            <Button
              size="small"
              data-testid="history-toggle"
              disabled={history.length === 0}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              历史探索清单（{history.length}）
            </Button>
            {history.length === 0 && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }} data-testid="history-empty">本领域没有待决定的探索报告</Text>
              </div>
            )}
            {historyOpen && history.length > 0 && (
              <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 6 }}>
                {history.map((row) => (
                  <div key={row.selection_id} data-testid="history-row">
                    <Button
                      type="link" style={{ padding: 0, height: 'auto', textAlign: 'left' }}
                      onClick={() => void openReport(row.selection_id)}
                    >
                      <Text style={{ fontSize: 12 }}>
                        {shortTime(row.created_at)} ｜ {row.recipe || '—'} ｜{' '}
                        {HISTORY_STATUS_LABEL[row.status] ?? row.status} ｜ 达线 {row.recommendation_count} 篇
                      </Text>
                    </Button>
                  </div>
                ))}
              </Space>
            )}
          </div>
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

      {phase === 'plan' && selection && <PlanSegment selection={selection} />}

      {phase === 'review' && selection && (
        <>
          <div style={{ marginBottom: 8 }}>
            <Text strong data-testid="shortlist-summary">{shortlist.summaryLine}</Text>
            <Text type="secondary"> · 待选区间只列未采纳且达线的论文，默认全选可改；采纳后写入 kind=paper 书行</Text>
            <div>
              <Button size="small" onClick={toPlan}>查看检索口径</Button>
            </div>
          </div>
          {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}
          {shortlist.eligible.length === 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary" data-testid="shortlist-empty">{shortlist.emptyText}</Text>
              <Space>
                <Button size="small" onClick={toSettings}>回段①换检索方向再探</Button>
              </Space>
            </Space>
          ) : (
            <div className="paper-candidate-list">
              {shortlist.eligible.map((item) => (
                <CandidateRow
                  key={item.rank}
                  item={item}
                  checked={pickedRanks.includes(item.rank)}
                  expanded={expandedRank === item.rank}
                  placement={placements[item.rank] ?? ''}
                  placementOptions={placementOptions}
                  onCheck={(checked) => setPickedRanks((prev) => (
                    checked ? [...prev, item.rank] : prev.filter((rank) => rank !== item.rank)
                  ))}
                  onToggle={() => setExpandedRank((prev) => (prev === item.rank ? null : item.rank))}
                  onPlacement={(value) => setPlacements((prev) => ({ ...prev, [item.rank]: value }))}
                />
              ))}
            </div>
          )}
          {shortlist.excluded.length + shortlist.settled.length > 0 && (
            <Collapse
              size="small"
              style={{ marginTop: 12 }}
              items={[{
                key: 'excluded',
                label: `查看未入选（${shortlist.excluded.length + shortlist.settled.length} 篇，不可勾选）`,
                children: (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {[...shortlist.excluded, ...shortlist.settled].map(({ item, reason }) => (
                      <div key={item.rank} data-testid="excluded-row">
                        <Space wrap size={6}>
                          <Text style={{ fontSize: 12 }}>{item.candidate.title}</Text>
                          <Tag color="default">{reason}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            相关度 {item.assessment.goal_fit} ｜ 总分 {item.score}
                          </Text>
                        </Space>
                      </div>
                    ))}
                  </Space>
                ),
              }]}
            />
          )}
        </>
      )}

      {phase === 'adopted' && adopted && (
        <Space direction="vertical">
          <Alert
            type="success" showIcon
            message={`已建书行 ${adopted.filter((row) => row.status === 'created').length} 条（重复 ${adopted.filter((row) => row.status !== 'created').length} 条）`}
            description="论文书行停在待下载：采纳不自动下载，在左栏「论文」节点点开条目可在书目详情发起自动下载。"
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
          <Text type="secondary">检索未产生候选或任务失败，可改探索目标／arXiv 分类或换检索方向后重试。</Text>
        </Space>
      )}
    </Modal>
  );
}

/** 段①参数摘要的年窗／抓取量措辞（null＝随配方缺省，不下发该字段） */
function yearsLabel(yearsLimit: number | null): string {
  if (yearsLimit === null) return '随配方';
  return yearsLimit === 0 ? '不限（显式下发 0）' : `近 ${yearsLimit} 年`;
}

function limitLabel(limit: number | null): string {
  return limit === null ? '随配方' : String(limit);
}

/** 段③检索口径：计划由模型在任务内生成，成功后在这里看（REQ-107 壳 §5 段③、§9 降级矩阵） */
function PlanSegment({ selection }: { selection: PaperSelectionDetail }) {
  const plan: PaperSearchPlanEntry[] = selection.search_plan ?? [];
  const coverage = selection.plan_coverage ?? [];
  const yearsLimit = selection.profile?.years_limit ?? null;
  const candidateCount = selection.candidates?.length ?? selection.assessments.length;
  const excludedCount = selection.excluded_existing?.length ?? 0;
  const failures = selection.search_failures ?? [];
  const fallback = selection.plan_source === 'fallback';

  const rows = plan.length > 0
    ? plan
    : coverage.map((row) => ({
      plan_index: row.plan_index, terms: row.terms, category: row.category, reason: '',
      fetched: row.fetched, kept: row.kept,
    }));

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space wrap size={6}>
        <Text strong>本次检索口径</Text>
        {selection.plan_source && (
          <Tag color={fallback ? 'warning' : 'blue'} data-testid="plan-source">
            {fallback ? '兜底计划（模型计划生成失败，按领域关键词确定性检索）' : '模型计划'}
          </Tag>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {yearsLimit ? `年窗 近 ${yearsLimit} 年` : '年窗 不限'} ｜ 配方 {selection.recipe ?? '—'}
        </Text>
      </Space>

      {selection.temporary_goal && (
        <Text type="secondary" style={{ fontSize: 12 }}>本次目标：{selection.temporary_goal}</Text>
      )}
      {(selection.profile?.goals?.length || selection.profile?.topics?.length) ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          领域要点：{[...(selection.profile?.goals ?? []), ...(selection.profile?.topics ?? [])].join('、')}
        </Text>
      ) : null}
      {(selection.allowed_categories?.length ?? 0) > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>arXiv 分类：{selection.allowed_categories!.join('、')}</Text>
      )}

      <Text style={{ fontSize: 12 }} data-testid="plan-counts">
        排除已在库 {excludedCount} 篇 ｜ 去重后候选 {candidateCount} 篇（服务端上限 40）
      </Text>

      {rows.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="plan-missing">
          本次报告未携带检索计划（早期报告无该字段），可直接进入候选评审。
        </Text>
      ) : (
        <Table
          size="small"
          rowKey={(row) => String(row.plan_index)}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '#', dataIndex: 'plan_index', width: 44 },
            {
              title: '关键词',
              dataIndex: 'terms',
              render: (terms: string[]) => (
                <Space wrap size={4}>{terms.map((term) => <Tag key={term} style={{ marginInlineEnd: 0 }}>{term}</Tag>)}</Space>
              ),
            },
            { title: '分类', dataIndex: 'category', width: 96 },
            { title: '生成理由', dataIndex: 'reason', ellipsis: true },
            { title: '抓取', dataIndex: 'fetched', width: 60 },
            { title: '保留', dataIndex: 'kept', width: 60 },
          ]}
        />
      )}

      {selection.status === 'no_candidates' && (
        <Alert type="warning" showIcon message="本次检索没有取回候选" description="多为分类映射不到或年窗过窄；回段①放宽年窗、显式填 arXiv 分类或换检索方向（深度／匹配）再探。" />
      )}
      {selection.status === 'no_recommendations' && (
        <Alert type="warning" showIcon message="有候选，但没有一条达到服务端推荐线" description="进段④可看未入选逐条归因，或回段①换检索方向再探。" />
      )}

      {failures.length > 0 && (
        <div data-testid="plan-failures">
          <Text type="secondary" style={{ fontSize: 12 }}>检索失败 {failures.length} 条：</Text>
          {failures.map((f, idx) => (
            <div key={`${f.category}-${idx}`}>
              <Text type="danger" style={{ fontSize: 12 }}>
                {f.category || '未限定分类'} ｜ {f.terms.join('、')} ｜ {f.error}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Space>
  );
}

/** 段④条目：一行概要 + 点行就地展开详情（标题／摘要／评审小结，§7） */
function CandidateRow({ item, checked, expanded, placement, placementOptions, onCheck, onToggle, onPlacement }: {
  item: PaperCandidateEntry;
  checked: boolean;
  expanded: boolean;
  placement: string;
  placementOptions: Array<{ value: string; label: string }>;
  onCheck: (checked: boolean) => void;
  onToggle: () => void;
  onPlacement: (value: string) => void;
}) {
  const arxivId = candidateArxivId(item);
  return (
    <div className="paper-candidate-row" style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
      <Space align="start" style={{ width: '100%' }}>
        <Checkbox checked={checked} onChange={(e) => onCheck(e.target.checked)} />
        <div style={{ flex: 1 }}>
          <Space wrap size={6}>
            <Button type="link" className="paper-candidate-title" onClick={onToggle} style={{ padding: 0, height: 'auto' }}>
              <Text strong>{item.candidate.title}</Text>
            </Button>
            <Tag color="blue">总分 {item.score}</Tag>
            <Text type="secondary">相关度 {item.assessment.goal_fit}</Text>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[item.candidate.authors.join('、'), item.candidate.year].filter(Boolean).join(' · ')}
              {arxivId && (
                <>
                  {' · '}
                  <a
                    href={item.candidate.page_url || `https://arxiv.org/abs/${arxivId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    arXiv: {arxivId}
                  </a>
                </>
              )}
            </Text>
          </div>
          {expanded && (
            <PaperCandidateDetail
              candidate={item.candidate}
              assessment={item.assessment}
              score={item.score}
              recommended={item.recommended}
              testId="candidate-detail"
            />
          )}
        </div>
        <Select
          aria-label={`落位 ${item.candidate.title}`}
          size="small"
          style={{ width: 180 }}
          value={placement}
          options={placementOptions}
          onChange={onPlacement}
        />
      </Space>
    </div>
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
