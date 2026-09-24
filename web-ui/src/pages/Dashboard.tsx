/**
 * 仪表盘（`#/admin/dashboard`，2026-09-24 REQ-033 三块制·用户五改形态）
 * - 块一＝一张卡上下两段：「服务详情」卡（extra「QED服务及本地模型启动详情」保留）＝
 *   四服务徽章段 + 「本地模型列表」常驻分节（左右两栏：文字在左图像在右，固定列宽）
 * - 块二 文档下载情况（无 extra）：四统计数字（领域数/课程数/书目数/验收通过）+ 领域按钮行
 *   （四态小圆点，>5 折叠前 5+「更多▾」下拉）+ 单领域大卡：课程逐行＝名称｜状态｜
 *   教程数（如有）｜一书一格进度（tooltip 书名），末尾一行颜色图例，其他不写
 * - 块三 文档解析情况（无 extra、无描述）：KPI 顺序＝课程数/书目数/解析中/已完成；
 *   判定基座＝af_books 书目字段（ADR 0007），分组/分页/降级逻辑与四改一致
 * - 三块卡标题字体参照控制台「服务管理」＝ Typography.Title level={4}（五改裁决 8）
 * - 只读看板：一切操作归控制台；30s 轮询 fetchSlots/fetchParse 保鲜
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Button, Card, Col, Dropdown, Layout, Pagination, Row, Space, Statistic, Tag, Tooltip, Typography,
} from 'antd';
import { ReloadOutlined, DatabaseOutlined, FileSearchOutlined, DesktopOutlined } from '@ant-design/icons';
import LocalModelStatus from '../components/dashboard/LocalModelStatus';
import { statusBadge } from '../components/StatusBadge';
import { describeError } from '../api/client';
import { useRuntimeStore, withWebServiceFallback } from '../stores/runtime';
import {
  useDashboardStore,
  buildDomainDownloadDetail,
  buildDomainStateMap,
  buildParseGroups,
  buildDashboardStats,
  BUCKET_ORDER,
  type BookCell,
  type CourseProgressRow,
  type ParseBookRow,
} from '../stores/dashboard';

const { Title, Text } = Typography;

/** 卡标题统一样式：参照控制台「服务管理」Title level 4（五改裁决 8） */
function CardTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return <Title level={4} style={{ margin: 0 }}>{icon} {text}</Title>;
}

/** 块二领域四态色（按钮小圆点 + 大卡标题 Tag 同一口径） */
const DOMAIN_STATE_COLOR: Record<string, { dot: string; tag: string }> = {
  '未开始': { dot: '#bfbfbf', tag: 'default' },
  '探索中': { dot: '#1677ff', tag: 'blue' },
  '下载中': { dot: '#fa8c16', tag: 'orange' },
  '下载完成': { dot: '#52c41a', tag: 'green' },
};

/** 块二课程状态四词色（未探索/探索中/下载中/完成） */
const COURSE_STATE_COLOR: Record<string, string> = {
  '未探索': 'default',
  '探索中': 'blue',
  '下载中': 'orange',
  '完成': 'green',
};

/** 块二格子色（一书一格，四桶口径；图例与格子同一映射） */
const BUCKET_COLOR: Record<string, string> = {
  '未开始下载': '#d9d9d9',
  '下载中': '#fa8c16',
  '下载完成': '#1677ff',
  '验证完成': '#52c41a',
};

const LEGEND_LABEL: Record<string, string> = {
  '未开始下载': '未开始下载',
  '下载中': '下载中(含失败)',
  '下载完成': '下载完成',
  '验证完成': '验证完成',
};

/** 块三书级状态色（判定见 stores/dashboard parseBookLabel） */
const PARSE_LABEL_TAG: Record<string, string> = {
  '解析中': 'processing',
  '已完成': 'blue',
  '部分生效': 'geekblue',
  '未生效': 'gold',
  'partial': 'cyan',
  '失败': 'red',
  '中断': 'volcano',
  '未入库': 'default',
  '未开始': 'default',
};

/** 每书堆叠条：done 蓝 / failed 红 / 剩余灰底（分母＝page_count 全书页数） */
function ParseBookBar({ done, failed, total }: { done: number; failed: number; total: number }) {
  const pct = (n: number) => `${total > 0 ? Math.min((n / total) * 100, 100) : 0}%`;
  const rest = Math.max(total - done - failed, 0);
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f0f0f0', flex: 1, minWidth: 120 }}>
      <div style={{ width: pct(done), background: '#1677ff' }} />
      <div style={{ width: pct(failed), background: '#ff4d4f' }} />
      <div style={{ width: pct(rest), background: 'transparent' }} />
    </div>
  );
}

function ParseBookItem({ row }: { row: ParseBookRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Text style={{ width: 240, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>
        {row.title}
      </Text>
      <Tag color={PARSE_LABEL_TAG[row.label] ?? 'default'} style={{ width: 68, textAlign: 'center', marginInlineEnd: 0 }}>
        {row.label}
      </Tag>
      <ParseBookBar done={row.done} failed={row.failed} total={row.total} />
      <Text type="secondary" style={{ width: 130, flexShrink: 0, fontSize: 12 }}>
        {row.total > 0 ? `${row.done}/${row.total} 页` : '—'}
        {row.failed > 0 && ` · 失败 ${row.failed}`}
      </Text>
    </div>
  );
}

/** 一书一格进度（11 本＝11 格；悬停 tooltip 书名） */
function BookCellBar({ cells }: { cells: BookCell[] }) {
  return (
    <div data-course-cells style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1, minWidth: 120 }}>
      {cells.map((c) => (
        <Tooltip key={c.bookId} title={c.title}>
          <span
            data-book-cell={c.bookId}
            style={{ width: 12, height: 12, borderRadius: 2, background: BUCKET_COLOR[c.bucket], display: 'inline-block' }}
          />
        </Tooltip>
      ))}
    </div>
  );
}

/** 块二单领域大卡（五改 F2）：课程行＝名称｜状态｜教程数（如有）｜格子；末尾图例，其他不写 */
function DomainDetailCard({ detail }: { detail: NonNullable<ReturnType<typeof buildDomainDownloadDetail>> }) {
  const st = DOMAIN_STATE_COLOR[detail.domainState] ?? DOMAIN_STATE_COLOR['未开始'];
  const rows: CourseProgressRow[] = detail.courses;
  return (
    <Card
      size="small"
      style={{ marginTop: 12 }}
      title={<Space><Title level={4} style={{ margin: 0 }}>{detail.domain}</Title><Tag color={st.tag}>{detail.domainState}</Tag></Space>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 860 }}>
        {rows.length === 0 ? (
          <Text type="secondary">本领域暂无课程</Text>
        ) : rows.map((c) => (
          <div key={c.courseId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text style={{ width: 240, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
              {c.name}
            </Text>
            <Tag color={COURSE_STATE_COLOR[c.state] ?? 'default'} style={{ width: 64, textAlign: 'center', marginInlineEnd: 0 }}>
              {c.state}
            </Tag>
            {c.tutorialCount > 0 && (
              <Text type="secondary" style={{ width: 64, flexShrink: 0, fontSize: 12 }}>教程×{c.tutorialCount}</Text>
            )}
            {c.state !== '未探索' && <BookCellBar cells={c.cells} />}
          </div>
        ))}
      </div>
      {/* 末尾一行颜色图例（BUCKET_ORDER 序），其他不写 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {BUCKET_ORDER.map((name) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: BUCKET_COLOR[name], marginRight: 4, display: 'inline-block' }} />
            {LEGEND_LABEL[name]}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** 领域选择按钮（领域名 + 四态小圆点） */
function DomainButton({ name, state, active, onClick }: {
  name: string; state: string; active: boolean; onClick: () => void;
}) {
  const st = DOMAIN_STATE_COLOR[state] ?? DOMAIN_STATE_COLOR['未开始'];
  return (
    <Button size="small" type={active ? 'primary' : 'default'} onClick={onClick}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: st.dot, marginRight: 6 }} />
      {name}
    </Button>
  );
}

/**
 * 仪表盘：块一「服务详情」合卡（徽章段 + 本地模型列表左右两栏分节）→ 块二文档下载
 * （格子大卡 + 图例）→ 块三文档解析（KPI 课程数/书目数/解析中/已完成 + 课程分组进度，
 * 在飞置顶、分页）。只读，8901/8902 独立降级。
 */
export default function Dashboard() {
  const {
    knowledge, details, courseSystem, parseBooks, parseJobs,
    loading, error, dataError, courseError, parseError, fetchAll, fetchParse,
  } = useDashboardStore();
  const services = useRuntimeStore((s) => s.services);
  const fetchSlots = useRuntimeStore((s) => s.fetchSlots);

  const [domainId, setDomainId] = useState<string>('');
  const [parsePage, setParsePage] = useState(1);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // 保鲜轮询（块一模型分节 + 块三解析在飞）：30s tick；页面隐藏暂停
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      void fetchSlots();
      void fetchParse();
    }, 30_000);
    return () => clearInterval(timer);
  }, [fetchSlots, fetchParse]);

  const stats = useMemo(() => buildDashboardStats(courseSystem, details), [courseSystem, details]);
  const domainStates = useMemo(() => buildDomainStateMap(courseSystem, details), [courseSystem, details]);
  const healthItems = useMemo(() => withWebServiceFallback(services), [services]);
  const parse = useMemo(() => buildParseGroups(parseBooks, parseJobs), [parseBooks, parseJobs]);

  // 所选领域失效（数据刷新/首载）时回落第一个领域
  const activeDomain = courseSystem.some((d) => d.domain_id === domainId)
    ? domainId
    : courseSystem[0]?.domain_id ?? '';
  const detail = useMemo(
    () => (activeDomain ? buildDomainDownloadDetail(courseSystem, details, activeDomain, knowledge) : null),
    [courseSystem, details, activeDomain, knowledge],
  );

  const PARSE_PAGE_SIZE = 3;
  const pagedGroups = parse.groups.slice((parsePage - 1) * PARSE_PAGE_SIZE, parsePage * PARSE_PAGE_SIZE);
  const hasTrackerData = knowledge.length > 0 || courseSystem.length > 0;

  const DOMAIN_BTN_SHOW = 5;
  const shownDomains = courseSystem.slice(0, DOMAIN_BTN_SHOW);
  const foldedDomains = courseSystem.slice(DOMAIN_BTN_SHOW);

  return (
    <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>仪表盘</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchAll()}>
          刷新
        </Button>
      </div>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="仪表盘数据获取失败"
          description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
        />
      )}

      {/* 块一：一张卡上下两段（徽章段 + 本地模型列表左右两栏分节）；extra 保留（裁决 3） */}
      <Card
        size="small"
        title={<CardTitle icon={<DesktopOutlined />} text="服务详情" />}
        extra={<Text type="secondary">QED服务及本地模型启动详情</Text>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 8]}>
          {healthItems.map((svc) => (
            <Col xs={12} md={6} key={svc.name}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>{svc.label}</Text>
                {statusBadge(svc.status, svc.reason)}
              </Space>
            </Col>
          ))}
        </Row>
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 12, paddingTop: 10 }}>
          <LocalModelStatus />
        </div>
      </Card>

      {/* 块二：文档下载情况＝四统计 + 领域按钮（>5 更多▾折叠）+ 单领域格子大卡（无 extra） */}
      <Card
        size="small"
        title={<CardTitle icon={<DatabaseOutlined />} text="文档下载情况" />}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16} style={{ marginBottom: 8 }}>
          <Col xs={12} md={6}>
            <Statistic title="领域数" value={stats.totalDomains} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="课程数" value={stats.totalCourses} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="书目数" value={stats.totalBooks} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="验收通过" value={stats.verifiedBooks} />
          </Col>
        </Row>
        {dataError ? (
          <Alert
            type="warning" showIcon
            message="QED-Tracker 数据不可达"
            description={`${describeError(dataError)}。8901 离线时本块降级，不阻塞其他块。`}
          />
        ) : courseError ? (
          <Alert
            type="warning" showIcon
            message="课程体系不可达"
            description={`${describeError(courseError)}。本块内容暂时不可用。`}
          />
        ) : !hasTrackerData ? (
          <Text type="secondary">暂无下载主线数据（/knowledge 与 /courses 均为空）。</Text>
        ) : courseSystem.length === 0 ? (
          <Text type="secondary">暂无领域数据</Text>
        ) : (
          <>
            <Space size={8} wrap>
              {shownDomains.map((d) => (
                <DomainButton
                  key={d.domain_id}
                  name={d.name}
                  state={domainStates[d.domain_id] ?? '未开始'}
                  active={d.domain_id === activeDomain}
                  onClick={() => setDomainId(d.domain_id)}
                />
              ))}
              {foldedDomains.length > 0 && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: foldedDomains.map((d) => ({
                      key: d.domain_id,
                      label: (
                        <span>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: (DOMAIN_STATE_COLOR[domainStates[d.domain_id] ?? '未开始'] ?? DOMAIN_STATE_COLOR['未开始']).dot, marginRight: 6 }} />
                          {d.name}（{domainStates[d.domain_id] ?? '未开始'}）
                        </span>
                      ),
                    })),
                    onClick: ({ key }) => setDomainId(String(key)),
                  }}
                >
                  <Button size="small">更多 ▾</Button>
                </Dropdown>
              )}
            </Space>
            {detail ? <DomainDetailCard detail={detail} /> : <Text type="secondary">请选择领域</Text>}
          </>
        )}
      </Card>

      {/* 块三：文档解析情况＝KPI（课程数/书目数/解析中/已完成）+ 课程分组进度（无 extra 无描述） */}
      <Card
        size="small"
        title={<CardTitle icon={<FileSearchOutlined />} text="文档解析情况" />}
      >
        {parseError ? (
          <Alert
            type="warning" showIcon
            message="文档解析数据不可达"
            description={`${describeError(parseError)}。8902 离线时本块降级（独立性铁律），不阻塞块一、块二。`}
          />
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 8 }}>
              <Col xs={12} md={6}>
                <Statistic title="课程数" value={parse.stats.totalCourses} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="书目数" value={parse.stats.totalBooks} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="解析中" value={parse.stats.runningBooks} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="已完成" value={parse.stats.finishedBooks} />
              </Col>
            </Row>
            {parse.groups.length === 0 ? (
              <Text type="secondary">暂无书目（af_books 为空，先在解析管理页同步书目）。</Text>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 920 }}>
                  {pagedGroups.map((g) => (
                    <div key={g.courseId || 'unassigned'}>
                      <Text strong style={{ fontSize: 13 }}>
                        {g.courseName}
                        {g.running && (
                          <Tooltip title="本组有书目解析在飞">
                            <span style={{ marginLeft: 8, color: '#1677ff' }}>●</span>
                          </Tooltip>
                        )}
                      </Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        {g.books.map((row) => <ParseBookItem key={row.bookId} row={row} />)}
                      </div>
                    </div>
                  ))}
                </div>
                {parse.groups.length > PARSE_PAGE_SIZE && (
                  <Pagination
                    size="small" style={{ marginTop: 10 }}
                    current={parsePage} pageSize={PARSE_PAGE_SIZE}
                    total={parse.groups.length}
                    showSizeChanger={false}
                    onChange={setParsePage}
                  />
                )}
              </>
            )}
          </>
        )}
      </Card>
    </Layout.Content>
  );
}
