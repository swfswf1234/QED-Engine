import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App, Button, Input, Modal, Space, Table, Typography,
} from 'antd';
import { describeError } from '../api/client';
import { confirmCourseKnowledge } from '../api/explore-helpers';
import { getDomainExploreStatus, updateCourse, updateDomain } from '../api/tracker';
import type { CourseRecord, DomainSystem } from '../stores';
import { parseExplorePending } from '../stores/downloads';

const { TextArea } = Input;
const { Text } = Typography;

/** 模块级空数组常量：稳定引用，避免「非导入模式」每次渲染新建 [] 导致 useMemo/useEffect 失效循环 */
type ImportCourses = Extract<NonNullable<DomainSystem['explore_pending']>, { kind: 'import_courses' }>['courses'];
const EMPTY_COURSES: ImportCourses = [];

interface CourseDraft {
  stage: string;
  track: string;
  description: string;
}

/** 课程确认清单条目（审阅统一形态；key 与后端 _course_key 对齐：course_id 优先退回名称） */
interface ReviewCourse {
  key: string;
  /** 既有课程行 id（原生待确认清单尚无课程行，仅审阅勾选） */
  courseId?: string;
  name: string;
  stage: string;
  track: string;
  description: string;
}

interface ReviewSourceEntry {
  course_id?: string;
  name: string;
  stage?: string;
  track?: string;
  description?: string;
  summary?: string;
}

function toReviewCourses(entries: ReviewSourceEntry[]): ReviewCourse[] {
  return entries.map((c) => ({
    key: c.course_id || c.name,
    courseId: c.course_id || undefined,
    name: c.name,
    stage: c.stage || '',
    track: c.track || '',
    description: c.description || c.summary || '',
  }));
}

/** 用既有课程行补全展示字段（挂起清单仅名称/id，修订值以课程行为准） */
function enrichFromRows(courses: ReviewCourse[], rows: CourseRecord[]): ReviewCourse[] {
  const byId = new Map(rows.map((r) => [r.course_id, r]));
  const byName = new Map(rows.map((r) => [r.name, r]));
  return courses.map((c) => {
    const row = (c.courseId ? byId.get(c.courseId) : undefined) ?? byName.get(c.name);
    if (!row) return c;
    return {
      ...c,
      courseId: c.courseId || row.course_id,
      stage: c.stage || row.stage || '',
      track: c.track || row.track || '',
      description: c.description || row.description || '',
    };
  });
}

interface CourseConfirmModalProps {
  domain: DomainSystem | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 课程信息确认界面（REQ-067；PLAN-033 §4 状态机对接）
 *
 * 支持两种数据源：
 * 1. 导入课程（explore_pending.kind === 'import_courses'）：课程从挂起载荷读取，
 *    确认后走 confirm-knowledge 导入分支（建行+清 pending+已完成，离线收口）。
 * 2. 审阅清单（待确认）：课程从行级 pending / explore-status 合成（courses.json）读取，
 *    勾选保留/移除，确认后走 confirm-knowledge 审阅分支（桥接建行+apply-results 级联删除）。
 *
 * 状态流转（前端禁写 exploration_stage，PLAN-033 §2：写点归后端门面端点）。
 */
export default function CourseConfirmModal({ domain, open, onClose }: CourseConfirmModalProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [drafts, setDrafts] = useState<Record<string, CourseDraft>>({});
  /** 非导入模式课程清单（异步合成：行级 pending > explore-status > 既有课程行） */
  const [reviewCourses, setReviewCourses] = useState<ReviewCourse[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  /** 勾选保留的课程键（默认全选；导入模式全量入库无勾选） */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 判断是否为导入课程模式（类型收窄；explore_pending 可能来自共享表 JSON 字符串）
  const ep = domain ? parseExplorePending(domain.explore_pending) : null;
  const importMode = ep?.kind === 'import_courses';
  // 空数组用模块级常量：避免每次渲染新建引用 → sourceCourses/useEffect 失效循环（2026-09-06 DEFECT 修复）
  const importCourses = importMode && ep?.kind === 'import_courses' ? ep.courses : EMPTY_COURSES;

  // 课程数据源：导入模式用挂起载荷，审阅模式用合成清单
  const sourceCourses: ReviewCourse[] = useMemo(() => {
    if (importMode) {
      return importCourses.map((c, i) => ({
        key: `import_${i}`,
        name: c.name,
        stage: c.stage || '',
        track: c.track || '',
        description: c.description || '',
      }));
    }
    return reviewCourses;
  }, [importMode, importCourses, reviewCourses]);

  // 打开时拉取审阅清单（原生任务链「待确认」不写行级 pending，经 explore-status 从 courses.json 合成）
  useEffect(() => {
    if (!domain || !open) return;
    setDescription(domain.description || '');
    setListError(null);
    const epNow = parseExplorePending(domain.explore_pending);
    if (epNow?.kind === 'import_courses') return; // 导入模式：清单来自挂起载荷
    let cancelled = false;
    const rows = domain.courses ?? [];
    if (epNow?.kind === 'review_results' && epNow.courses.length > 0) {
      setReviewCourses(enrichFromRows(toReviewCourses(epNow.courses), rows));
      return;
    }
    const load = async () => {
      try {
        const status = await getDomainExploreStatus(domain.domain_id);
        if (cancelled) return;
        const pending = status.explore_pending;
        const pendingCourses = pending?.kind === 'review_results' ? (pending.courses ?? []) : [];
        if (pendingCourses.length > 0) {
          setReviewCourses(enrichFromRows(toReviewCourses(pendingCourses), rows));
          return;
        }
      } catch {
        /* explore-status 失败：回落既有课程行 */
      }
      if (rows.length > 0) {
        setReviewCourses(toReviewCourses(rows));
        return;
      }
      if (!cancelled) {
        setListError('课程清单不可用（courses.json 缺失或为空），请重新确认领域生成');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [domain, open]);

  // 初始化草稿与勾选（清单就绪后执行；异步合成晚到时重置为初始态）
  useEffect(() => {
    if (!domain || !open) return;
    const next: Record<string, CourseDraft> = {};
    for (const c of sourceCourses) {
      next[c.key] = {
        stage: c.stage || '',
        track: c.track || '',
        description: c.description || '',
      };
    }
    setDrafts(next);
    setSelectedKeys(sourceCourses.map((c) => c.key));
  }, [domain, open, sourceCourses]);

  const setDraft = useCallback((key: string, patch: Partial<CourseDraft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  // 有修改的课程列表
  const changedCourses = useMemo(() => {
    return sourceCourses.filter((c) => {
      const d = drafts[c.key];
      if (!d) return false;
      return (
        d.stage !== (c.stage || '')
        || d.track !== (c.track || '')
        || d.description !== (c.description || '')
      );
    });
  }, [sourceCourses, drafts]);

  const handleSubmit = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    try {
      if (importMode) {
        // 导入路径：内容保存 + confirm-knowledge 导入分支（建行+清 pending+已完成）
        await updateDomain(domain.domain_id, { description });
        await confirmCourseKnowledge(domain.domain_id);
        onClose();
        return;
      }
      if (selectedKeys.length === 0) {
        message.warning('请至少勾选一门需要保留的课程');
        return;
      }
      const allSelected = selectedKeys.length === sourceCourses.length;
      // 审阅路径：待确认→已完成（桥接建行 + apply-results 级联删除未勾选课程行）
      await confirmCourseKnowledge(domain.domain_id, allSelected ? undefined : selectedKeys);
      // 用户修订补写：桥接先按探索结果写课程行，人工编辑以最后写入为准
      //（仅既有课程行；原生新建行可在确认后经左侧树「编辑课程」修订）
      await updateDomain(domain.domain_id, { description });
      const keep = new Set(selectedKeys);
      for (const c of changedCourses) {
        if (!c.courseId || !keep.has(c.key)) continue;
        const d = drafts[c.key];
        if (!d) continue;
        await updateCourse(c.courseId, {
          stage: d.stage.trim() || undefined,
          track: d.track.trim() || undefined,
          description: d.description.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      message.error(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [domain, description, importMode, selectedKeys, sourceCourses.length, changedCourses, drafts, message, onClose]);

  return (
    <Modal
      title={`课程信息确认 · ${domain?.name || ''}`}
      open={open}
      onCancel={onClose}
      width={1080}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {importMode ? '确认导入' : '确认课程名单'}
          </Button>
        </Space>
      }
    >
      {domain && (
        <div>
          {/* 领域名称（不可修改） */}
          <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: 12 }}>
            <div>
              <Text type="secondary">领域名称：</Text>
              <Text strong>{domain.name}</Text>
              <Text type="secondary" style={{ marginLeft: 12 }}>
                {sourceCourses.length} 门课程
              </Text>
            </div>
            <div>
              <Text type="secondary">领域描述（可编辑）</Text>
              <TextArea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="领域描述"
              />
            </div>
          </Space>

          {/* 课程清单（审阅模式勾选保留，导入模式全量入库） */}
          <Table
            size="small"
            rowKey="key"
            dataSource={sourceCourses}
            pagination={false}
            rowSelection={importMode
              ? undefined
              : {
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys.map(String)),
              }}
            locale={listError ? { emptyText: listError } : undefined}
            columns={[
              {
                title: '课程',
                dataIndex: 'name',
                width: 180,
                render: (name: string) => <Text strong>{name}</Text>,
              },
              {
                title: '所属阶段',
                width: 150,
                render: (_: unknown, c: ReviewCourse) => (
                  <Input
                    size="small"
                    value={drafts[c.key]?.stage ?? ''}
                    onChange={(e) => setDraft(c.key, { stage: e.target.value })}
                    placeholder={(domain.stages || []).join('/')}
                  />
                ),
              },
              {
                title: '学术方向',
                width: 150,
                render: (_: unknown, c: ReviewCourse) => (
                  <Input
                    size="small"
                    value={drafts[c.key]?.track ?? ''}
                    onChange={(e) => setDraft(c.key, { track: e.target.value })}
                    placeholder="如：分析学"
                  />
                ),
              },
              {
                title: '课程介绍',
                render: (_: unknown, c: ReviewCourse) => (
                  <Input
                    size="small"
                    value={drafts[c.key]?.description ?? ''}
                    onChange={(e) => setDraft(c.key, { description: e.target.value })}
                    placeholder="课程介绍"
                  />
                ),
              },
            ]}
          />

          <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <Text type="secondary">
              {importMode
                ? '确认后，导入课程将写入数据库，领域探索完成。'
                : '确认后，勾选课程将保留、未勾选课程将被移除，课程体系进入「已完成」。'}
              {!importMode && selectedKeys.length < sourceCourses.length
                ? ` 当前保留 ${selectedKeys.length}/${sourceCourses.length} 门。`
                : ''}
              {!importMode && changedCourses.length > 0
                ? ` 将更新 ${changedCourses.length} 门课程的信息。`
                : ''}
            </Text>
          </div>
        </div>
      )}
    </Modal>
  );
}
