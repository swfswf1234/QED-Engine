import { useEffect, useMemo } from 'react';
import { Alert, Button, Layout, Select, Space, Typography } from 'antd';
import { ReloadOutlined, CloudServerOutlined } from '@ant-design/icons';
import AppHeader from '../components/AppHeader';
import DownloadsTree from '../components/DownloadsTree';
import { describeError } from '../api/client';
import { DOMAIN_MAP, DOMAIN_ORDER, DOMAIN_OTHER, useDownloadsStore } from '../stores/downloads';
import '../downloads.css';

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: 'candidate', label: '候选' },
  { value: 'confirmed', label: '确认' },
  { value: 'backup', label: '备选' },
];

function domainOfCourse(courseId: string): string {
  return DOMAIN_MAP[courseId] ?? DOMAIN_OTHER;
}

/** 筛选栏（领域/课程/状态，与树选择单向联动：树 → 筛选；筛选只作用于书目卡片列表） */
function FilterBar() {
  const filters = useDownloadsStore((s) => s.filters);
  const setFilter = useDownloadsStore((s) => s.setFilter);
  const catalogTargets = useDownloadsStore((s) => s.catalogTargets);
  const selections = useDownloadsStore((s) => s.selections);

  const courseOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const t of catalogTargets) ids.add(t.course_id);
    for (const s of selections) ids.add(s.course_id);
    const nameOf = (cid: string) =>
      catalogTargets.find((t) => t.course_id === cid)?.course_name ?? cid;
    return [...ids].sort().map((cid) => ({ value: cid, label: nameOf(cid) }));
  }, [catalogTargets, selections]);

  const domainOptions = useMemo(() => {
    const used = new Set<string>();
    for (const t of catalogTargets) used.add(domainOfCourse(t.course_id));
    for (const s of selections) used.add(domainOfCourse(s.course_id));
    return [...DOMAIN_ORDER.filter((d) => used.has(d)), ...(used.has(DOMAIN_OTHER) ? [DOMAIN_OTHER] : [])]
      .map((d) => ({ value: d, label: d }));
  }, [catalogTargets, selections]);

  return (
    <Space size={8} wrap>
      <Text type="secondary">筛选</Text>
      <Select
        allowClear placeholder="领域" style={{ width: 150 }} aria-label="领域筛选"
        value={filters.domain || undefined}
        options={domainOptions}
        onChange={(v) => setFilter('domain', v ?? '')}
      />
      <Select
        allowClear placeholder="课程" style={{ width: 190 }} aria-label="课程筛选"
        value={filters.course || undefined}
        options={courseOptions}
        onChange={(v) => setFilter('course', v ?? '')}
      />
      <Select
        allowClear placeholder="状态" style={{ width: 120 }} aria-label="状态筛选"
        value={filters.status || undefined}
        options={STATUS_OPTIONS}
        onChange={(v) => setFilter('status', v ?? '')}
      />
    </Space>
  );
}

/** 右侧面板（Phase 4a 骨架：筛选摘要 + 书目卡片区占位，4b 填充卡片） */
function RightPanel() {
  const filters = useDownloadsStore((s) => s.filters);
  const selected = useDownloadsStore((s) => s.selected);
  const selections = useDownloadsStore((s) => s.selections);

  const filtered = useMemo(
    () =>
      selections.filter((s) => {
        if (filters.domain && domainOfCourse(s.course_id) !== filters.domain) return false;
        if (filters.course && s.course_id !== filters.course) return false;
        if (filters.status && s.status !== filters.status) return false;
        return true;
      }),
    [selections, filters],
  );

  const selectedLabel =
    selected?.kind === 'domain'
      ? `领域：${selected.id}`
      : selected?.kind === 'course'
        ? `课程：${selected.id}`
        : selected?.kind === 'tutorial'
          ? `教程：${selected.key}`
          : '未选中';

  return (
    <div className="dl-right">
      <div className="dl-filter-bar"><FilterBar /></div>
      <div className="dl-summary">
        <Space direction="vertical" size={4}>
          <Text strong>当前选择：{selectedLabel}</Text>
          <Text type="secondary">筛选结果：{filtered.length} 条表1 书目（rejected/superseded 由数据层隐藏）</Text>
        </Space>
      </div>
      <div className="dl-content">
        <div className="dl-placeholder">
          <CloudServerOutlined style={{ fontSize: 40, color: '#bbb' }} />
          <Text type="secondary">书目卡片区将在 4b 填充（教程行横排卡片 + 详情弹窗）</Text>
        </div>
      </div>
    </div>
  );
}

/**
 * 下载管理（`#/admin/downloads`，Phase 4a）
 * - 左树（领域→课程→教程）+ 右侧面板骨架 + 筛选栏（与树选择单向联动）
 * - 独立降级：8900 不可达 → 整体横幅；catalog/selections 各自失败 → 树区/汇总提示
 */
export default function Downloads() {
  const loading = useDownloadsStore((s) => s.loading);
  const error = useDownloadsStore((s) => s.error);
  const selectionsError = useDownloadsStore((s) => s.selectionsError);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Button
            type="primary" ghost icon={<ReloadOutlined />} loading={loading}
            style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => void fetchAll()}
          >
            刷新
          </Button>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1500, width: '94%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>文档下载管理</Title>

        {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="下载管理数据获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}
        {!error && selectionsError && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="表1 数据不可达"
            description={`${describeError(selectionsError)}。8901 离线时展示降级，不阻塞树目录。`}
          />
        )}

        <div className="dl-layout">
          <DownloadsTree />
          <RightPanel />
        </div>
      </Layout.Content>
    </Layout>
  );
}