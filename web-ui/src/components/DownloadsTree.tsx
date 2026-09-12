/**
 * 文档下载管理左树 v2（2026-08-24 REQ-059 交互改版）
 * - 真实领域课程体系三层层级：领域 → 课程 → 教程叶子（math-qe 冻结目录退出 UI）
 * - 右键菜单（antd Dropdown contextMenu，口径见 PLAN-033 §2.3/§2.5 统一表）：
 *   领域 = 编辑领域知识｜探索领域知识（未开始/待确认重探/失败重试；探索中除删除外禁用）
 *          ｜导入领域知识｜添加课程｜删除领域(danger)
 *   课程 = 编辑课程｜探索课程（探索中/已完成禁用）｜导入课程知识｜删除课程(danger)
 * - 树底「＋添加领域」为纯手工表单（POST /domains），与探索流解耦（用户裁决 2026-08-24）
 * - hover 🔍 取消（课程探索走右键菜单）；色点三态保留
 * - 手工维护端点未上线（8901 404）时报错降级提示，不阻塞浏览
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CaretRightFilled, HolderOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Form, Input, InputNumber, Modal, Select } from 'antd';
import type { MenuProps } from 'antd';
import { ApiError, describeError } from '../api/client';
import {
  createCourse, createDomain, deleteCourse, deleteDomain, updateCourse, updateDomain,
  importDomain, importCourseKnowledge,
} from '../api/tracker';
import {
  startDomainExplore,
  startCourseExplore,
} from '../api/explore-helpers';
import type { CourseNode, DomainNode, TutorialNode } from '../stores/downloads';
import { buildTreeNodes, useDownloadsStore, TREE_WIDTH_MIN, TREE_WIDTH_MAX } from '../stores/downloads';
import { exploreStatusOf } from '../stores/explore';
import type { CourseRecord, DomainSystem } from '../stores';

/** 右键菜单触发的表单动作 */
type TreeFormAction =
  | { kind: 'add-course'; domain: DomainSystem }
  | { kind: 'edit-domain'; domain: DomainSystem }
  | { kind: 'edit-course'; course: CourseRecord };/** §8 手工维护错误友好化：后端已把「端点未上线」归一为结构化 404，前端给明确指引 */
function friendlyError(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) {
    const code = (err.detail as { code?: string } | null | undefined)?.code;
    if (code === 'UPSTREAM_NOT_IMPLEMENTED') {
      return 'QED-Tracker 尚未提供该手工维护端点（REQ-059 承接中），请稍后再试';
    }
  }
  return describeError(err);
}

// --- 叶子/分支组件 ---

/**
 * 教程叶子：只展示 name + 验收进度（verified/total 已验收），不可点击、不可展开。
 * 书籍明细只在右侧栏查看（ARCH-015）。
 */
function TutorialLeaf({ node }: { node: TutorialNode }) {
  return (
    <div
      className="dl-tree-node dl-tree-tutorial"
      onContextMenu={(e) => e.stopPropagation()}
    >
      <span className="dl-tree-caret dl-tree-caret-disabled" />
      <span className="dl-tree-name dl-tree-tutorial-name" title={node.label}>
        {node.label}
      </span>
      {node.total > 0 && <span className="dl-tree-progress">{node.verified}/{node.total} 已验收</span>}
    </div>
  );
}

/** 课程分支：可折叠显示教程叶子；点击名称 → 选中 + 联动筛选；右键菜单（v2 取消 hover 🔍） */
function CourseBranch({ course, onImportKnowledge, onEditCourse }: {
  course: CourseNode;
  onImportKnowledge: (courseId: string) => void;
  onEditCourse: (course: CourseRecord) => void;
}) {
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const domains = useDownloadsStore((s) => s.domains);
  const { message, modal } = App.useApp();
  const [expanded, setExpanded] = useState(false);
  const isSelected = selected?.kind === 'course' && selected.id === course.id;

  // 探索状态（F4：优先读共享表 exploration_stage；缺失时回退 ≤4/≥2 计算规则）：
  // stage 映射——已完成=ready(绿) / 已生成=insufficient(黄) / 其余=none(灰)
  const tutorialCount = course.tutorials.length;
  const completedCount = course.tutorials.filter((t) => t.knowledge.status === 'completed').length;
  const courseRecord: CourseRecord | undefined = useMemo(
    () => domains.flatMap((d) => d.courses).find((c) => c.course_id === course.id),
    [domains, course.id],
  );
  const stage = courseRecord?.exploration_stage ?? '';
  const status = stage === '已完成'
    ? ('ready' as const)
    : stage === '已生成'
      ? ('insufficient' as const)
      : exploreStatusOf(tutorialCount, completedCount);

  const confirmDelete = () => {
    modal.confirm({
      title: `删除课程「${course.name}」？`,
      content: tutorialCount > 0
        ? `该课程下还有 ${tutorialCount} 个教程，上游将拒绝删除（409 保护）。请先处理教程。`
        : '删除后不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteCourse(course.id);
          message.success('课程已删除');
          void useDownloadsStore.getState().fetchAll();
        } catch (err) {
          message.error(friendlyError(err));
          return Promise.reject(err); // 失败保持弹窗打开
        }
      },
    });
  };

  // 课程层三态菜单口径（PLAN-033 §2.5）：探索课程在 探索中/已完成 禁用，导入课程知识在 已完成 禁用
  const courseStage = courseRecord?.exploration_stage ?? '';
  const exploreDisabled = courseStage === '探索中' || courseStage === '已完成';

  const menu: MenuProps = {
    items: [
      { key: 'edit', label: '编辑课程' },
      { key: 'explore', label: '探索课程', disabled: exploreDisabled },
      { key: 'import', label: '导入课程知识',
        disabled: courseStage === '已完成' },
      { type: 'divider' },
      { key: 'delete', label: '删除课程', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'edit') {
        if (courseRecord) onEditCourse(courseRecord);
      } else if (key === 'delete') {
        confirmDelete();
      } else if (key === 'explore') {
        // 无弹窗直触：立即调用探索接口
        if (!exploreDisabled) {
          void startCourseExplore(course.id);
        }
      } else if (key === 'import') {
        // 导入课程知识：选择 JSON 文件
        onImportKnowledge(course.id);
      }
    },
  };

  return (
    <Dropdown menu={menu} trigger={['contextMenu']}>
      <div
        className={`dl-tree-node dl-tree-course${expanded ? ' expanded' : ''}${isSelected ? ' selected' : ''}`}
        // 2026-08-24 缺陷修复：阻断 contextmenu 冒泡，防止外层领域 Dropdown 同时弹出双菜单
        onContextMenu={(e) => e.stopPropagation()}
      >
        <span
          className="dl-tree-caret"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <CaretRightFilled rotate={expanded ? 90 : 0} />
        </span>
        <span
          className="dl-tree-name"
          onClick={() => {
            if (!expanded) setExpanded(true);
            selectNode({ kind: 'course', id: course.id });
          }}
        >
          <span className={`explore-dot explore-dot-${status}`} aria-label={`探索状态：${status === 'none' ? '未探索' : status === 'insufficient' ? '探索不足' : '已达标'}`} />
          {course.name}
        </span>
        {course.tutorials.length > 0 && <span className="dl-tree-count">{course.tutorials.length} 教程</span>}
        {expanded && (
          <div className="dl-tree-children">
            {course.tutorials.length === 0 ? (
              <div className="dl-tree-empty">暂无教程</div>
            ) : (
              course.tutorials.map((t) => (
                <TutorialLeaf key={t.key} node={t} />
              ))
            )}
          </div>
        )}
      </div>
    </Dropdown>
  );
}

// --- 表单弹窗（树内聚：新增课程 / 修改领域 / 修改课程） ---

export function TreeFormModal({ action, onClose }: { action: TreeFormAction | null; onClose: () => void }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const domains = useDownloadsStore((s) => s.domains);
  const initializedRef = useRef(false);

  const title =
    action?.kind === 'add-course' ? `新增课程（${action.domain.name}）`
      : action?.kind === 'edit-domain' ? `修改领域（${action.domain.name}）`
        : action?.kind === 'edit-course' ? `修改课程（${action.course.name}）`
          : '';

  // 获取当前领域数据（用于edit-course）
  const currentDomain = action?.kind === 'edit-course' 
    ? domains.find(d => d.courses.some(c => c.course_id === action.course.course_id))
    : null;

  const initialValues = action?.kind === 'add-course'
    ? {}
    : action?.kind === 'edit-domain'
      ? {
          description: action.domain.description ?? '',
          level: action.domain.level ?? '',
          stages: action.domain.stages?.join(', ') ?? '',
          classic_tracks: action.domain.classic_tracks ?? [],
          scope: action.domain.scope ?? '',
        }
      : action?.kind === 'edit-course'
        ? {
            description: action.course.description ?? '',
            stage: action.course.stage ?? '',
            track: action.course.track ?? '',
            aliases: action.course.aliases?.join(', ') ?? '',
            prerequisites: action.course.prerequisites?.join(', ') ?? '',
          }
        : {};

  useEffect(() => {
    if (action) {
      if (!initializedRef.current) {
        form.resetFields();
        form.setFieldsValue(initialValues);
        initializedRef.current = true;
      }
    } else {
      initializedRef.current = false;
    }
  }, [action, form, initialValues]);
  const submit = async (values: Record<string, unknown>) => {
    try {
      if (action?.kind === 'add-course') {
        // 解析逗号分隔的字符串为数组
        const aliases = values.aliases ? String(values.aliases).split(',').map(s => s.trim()).filter(Boolean) : undefined;
        const prerequisites = values.prerequisites ? String(values.prerequisites).split(',').map(s => s.trim()).filter(Boolean) : undefined;
        
        await createCourse(action.domain.domain_id, {
          name: String(values.name).trim(),
          description: String(values.description ?? ''),
          stage: String(values.stage ?? ''),
          track: String(values.track ?? ''),
          sort_order: values.sort_order !== undefined ? Number(values.sort_order) : undefined,
          aliases,
          prerequisites,
          note: String(values.note ?? ''),
        });
        message.success('课程已创建');
      } else if (action?.kind === 'edit-domain') {
        // 解析逗号分隔的字符串为数组
        const stages = values.stages ? String(values.stages).split(',').map(s => s.trim()).filter(Boolean) : undefined;
        
        await updateDomain(action.domain.domain_id, {
          description: String(values.description ?? ''),
          level: String(values.level ?? ''),
          stages,
          classic_tracks: Array.isArray(values.classic_tracks)
            ? values.classic_tracks
                .filter((t: { name?: string }) => t.name?.trim())
                .map((t: { name: string; summary?: string; kind?: string }) => ({
                  name: t.name.trim(),
                  summary: (t.summary || '').trim(),
                  kind: t.kind || 'main',
                }))
            : undefined,
          scope: String(values.scope ?? ''),
        });
        message.success('领域已更新');
      } else if (action?.kind === 'edit-course') {
        const body: Record<string, unknown> = {
          description: String(values.description ?? ''),
          stage: String(values.stage ?? ''),
          track: String(values.track ?? ''),
        };
        // 解析逗号分隔的字符串为数组
        if (values.aliases) body.aliases = String(values.aliases).split(',').map(s => s.trim()).filter(Boolean);
        if (values.prerequisites) body.prerequisites = String(values.prerequisites).split(',').map(s => s.trim()).filter(Boolean);
        await updateCourse(action.course.course_id, body);
        message.success('课程已更新');
      }
      onClose();
      void fetchAll();
    } catch (err) {
      message.error(friendlyError(err));
      throw err; // 失败保持弹窗
    }
  };

  return (
    <Modal
      title={title}
      open={action !== null}
      onCancel={onClose}
      destroyOnHidden
      width={960}
      okText="保存"
      cancelText="取消"
      onOk={() => form.validateFields().then((v) => submit(v)).catch(() => { /* 校验失败：表单内联提示 */ })}
    >
      <Form form={form} layout="vertical" initialValues={initialValues} preserve={false}>
        {(action?.kind === 'add-course') && (
          <>
            <Form.Item name="name" label="课程名（必填；创建后不可改）" rules={[{ required: true, message: '请填写课程名' }]}>
              <Input placeholder="如：复变函数" />
            </Form.Item>
            <Form.Item name="description" label="描述（必填）" rules={[{ required: true, message: '请填写课程描述' }]}>
              <Input.TextArea rows={3} placeholder="课程介绍" />
            </Form.Item>
            <Form.Item name="stage" label="阶段（必填；选项来自领域学习阶段）" rules={[{ required: true, message: '请选择阶段' }]}>
              {/* B5（PLAN-033 §4）：选项源改 domain.stages 下拉，对齐 edit-course */}
              <Select placeholder="请选择阶段">
                {action.domain.stages?.map((stage) => (
                  <Select.Option key={stage} value={stage}>{stage}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="track" label="学术方向（选项来自领域课程方向）">
              <Select placeholder="请选择学术方向" allowClear>
                {action.domain.classic_tracks?.map((t) => (
                  <Select.Option key={t.name} value={t.name}>{t.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="aliases" label="别名（可选，逗号分隔）">
              <Input placeholder="如：复变,复变函数论" />
            </Form.Item>
            <Form.Item name="prerequisites" label="前置课程（可选，逗号分隔）">
              <Input placeholder="如：微积分,线性代数" />
            </Form.Item>
            <Form.Item name="sort_order" label="排序">
              <InputNumber min={0} max={9999} style={{ width: '100%' }} placeholder="如：3" />
            </Form.Item>
            <Form.Item name="note" label="备注（可选）">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}
        {(action?.kind === 'edit-domain') && (
          <>
            <Form.Item label="领域名">
              <Input value={action.domain.name} disabled />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="领域定位说明" />
            </Form.Item>
            <Form.Item name="level" label="探索范围">
              <Input placeholder="如：本科" />
            </Form.Item>
            <Form.Item name="stages" label="学习阶段">
              <Input placeholder="如：基础,主干,分支,前沿" />
            </Form.Item>
            <Form.Item name="scope" label="学科知识">
              <Input.TextArea rows={2} placeholder="学科知识（当前可置空）" />
            </Form.Item>
            <Form.Item label="课程方向（classic tracks）">
              <Form.List name="classic_tracks">
                {(fields, { add, remove }) => (
                  <div>
                    {fields.map((field) => (
                      <div key={field.key} style={{
                        display: 'flex', gap: 8, marginBottom: 8,
                        padding: '8px 12px', background: '#fafafa', borderRadius: 6,
                        alignItems: 'flex-start',
                      }}>
                        <Form.Item {...field} name={[field.name, 'name']} noStyle
                          rules={[{ required: true, message: '方向名称必填' }]}>
                          <Input placeholder="方向名称" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'summary']} noStyle>
                          <Input.TextArea rows={2} placeholder="方向描述（可选）" style={{ flex: 1 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'kind']} noStyle>
                          <Select style={{ width: 100 }} options={[
                            { value: 'main', label: '主干' },
                            { value: 'branch', label: '分支' },
                          ]} />
                        </Form.Item>
                        <MinusCircleOutlined
                          style={{ marginTop: 8, color: '#999' }}
                          onClick={() => remove(field.name)}
                        />
                      </div>
                    ))}
                    <Button type="dashed" onClick={() => add({ name: '', summary: '', kind: 'main' })} block
                      icon={<PlusOutlined />}>
                      添加课程方向
                    </Button>
                  </div>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}
        {(action?.kind === 'edit-course') && (
          <>
            <Form.Item label="课程名">
              <Input value={action.course.name} disabled />
            </Form.Item>
            <Form.Item name="description" label="课程描述" rules={[{ required: true, message: '请填写课程描述' }]}>
              <Input.TextArea rows={3} placeholder="课程介绍" />
            </Form.Item>
            <Form.Item name="stage" label="学习阶段" rules={[{ required: true, message: '请选择阶段' }]}>
              <Select placeholder="请选择阶段">
                {currentDomain?.stages?.map(stage => (
                  <Select.Option key={stage} value={stage}>{stage}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="track" label="学术方向">
              <Select placeholder="请选择学术方向">
                {currentDomain?.classic_tracks?.map(track => (
                  <Select.Option key={track.name} value={track.name}>{track.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="aliases" label="别名（可选，逗号分隔）">
              <Input placeholder="如：复变,复变函数论" />
            </Form.Item>
            <Form.Item name="prerequisites" label="依赖课程（可选）">
              <Select mode="multiple" placeholder="请选择前置课程">
                {currentDomain?.courses
                  ?.filter(c => c.course_id !== action.course.course_id)
                  .map(course => (
                    <Select.Option key={course.course_id} value={course.name}>{course.name}</Select.Option>
                  ))}
              </Select>
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

/**
 * 文档下载管理左树 v2
 * - 领域可折叠（默认展开）；点击名称 → 选中 + 清课程筛选（显示全部）；右键菜单四动作
 * - 课程可折叠（默认折叠），点击名称 → 选中 + 联动右侧筛选；右键菜单三动作
 * - 教程为叶子，只展示名称 + 验收进度，不可点击/展开
 * - 树宽拖拽：右侧手柄（280–640px，localStorage 记忆）
 */
export default function DownloadsTree({ onEditCourse }: { onEditCourse?: (course: CourseRecord) => void } = {}) {
  const domains = useDownloadsStore((s) => s.domains);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const details = useDownloadsStore((s) => s.details);
  const tree = useMemo(() => buildTreeNodes(domains, knowledge, details), [domains, knowledge, details]);
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const treeWidth = useDownloadsStore((s) => s.treeWidth);
  const setTreeWidth = useDownloadsStore((s) => s.setTreeWidth);
  const systemError = useDownloadsStore((s) => s.systemError);
  const knowledgeError = useDownloadsStore((s) => s.knowledgeError);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const { message, modal } = App.useApp();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [formAction, setFormAction] = useState<TreeFormAction | null>(null);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [addForm] = Form.useForm();
  const dragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<string | null>(null);
  const courseFileInputRef = useRef<HTMLInputElement>(null);
  const courseImportTargetRef = useRef<string | null>(null);

  const handleCourseImportKnowledge = useCallback((courseId: string) => {
    courseImportTargetRef.current = courseId;
    courseFileInputRef.current?.click();
  }, []);

  const toggleDomain = (domainId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  };

  const confirmDeleteDomain = (d: DomainSystem) => {
    modal.confirm({
      title: `删除领域「${d.name}」？`,
      content: d.courses.length > 0
        ? `该领域下还有 ${d.courses.length} 门课程，上游将拒绝删除（409 保护）。请先删除或移空课程。`
        : '删除后不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteDomain(d.domain_id);
          message.success('领域已删除');
          void fetchAll();
        } catch (err) {
          message.error(friendlyError(err));
          return Promise.reject(err);
        }
      },
    });
  };

  /** REQ-067 B3：导入领域知识 — 文件选择 → JSON 校验 → POST /domains/import */
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 重置 input 以便重复选择同名文件
    e.target.value = '';
    try {
      const text = await file.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        message.error('JSON 解析失败，请检查文件格式');
        return;
      }
      // 基本校验：domain / name / description / stages / courses 字段
      if (!data.domain || typeof data.domain !== 'string') {
        message.error('缺少 domain 字段（slug，如 "computer-science"）');
        return;
      }
      if (!data.name || typeof data.name !== 'string') {
        message.error('缺少 name 字段（领域名称）');
        return;
      }
      if (!data.description || typeof data.description !== 'string') {
        message.error('缺少 description 字段（领域描述）');
        return;
      }
      if (!Array.isArray(data.stages) || data.stages.length === 0) {
        message.error('缺少 stages 字段（学习阶段数组）');
        return;
      }
      if (!Array.isArray(data.courses) || data.courses.length === 0) {
        message.error('缺少 courses 数组（需至少一门课程）');
        return;
      }
      const result = await importDomain(data, importTargetRef.current || undefined);
      importTargetRef.current = null;
      message.success(`导入成功：${result.courses_created} 门新建，${result.courses_updated} 门更新`);
      void fetchAll();
    } catch (err) {
      message.error(describeError(err));
    }
  };

  /** 课程知识导入 — 文件选择 → JSON 校验 → POST /courses/{courseId}/knowledge */
  const handleImportCourseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        message.error('JSON 解析失败，请检查文件格式');
        return;
      }
      // 基本校验：tutorials 数组
      if (!Array.isArray(data.tutorials) || data.tutorials.length === 0) {
        message.error('缺少 tutorials 数组（需至少一篇教程）');
        return;
      }
      const courseId = courseImportTargetRef.current;
      if (!courseId) return;
      const result = await importCourseKnowledge(courseId, data);
      courseImportTargetRef.current = null;
      message.success(`导入成功：${result.tutorials_created ?? 0} 篇教程已导入`);
      void fetchAll();
    } catch (err) {
      message.error(describeError(err));
    }
  };

  // 领域菜单口径（PLAN-033 §2.3 统一表 + PLAN-041）：探索触发=未开始/已生成/待确认（重探）/失败（重试）；
  // 探索中除删除外全部禁用；添加课程在 未开始/已生成 禁用（用户裁决 2026-09-11）
  const domainMenu = (d: DomainSystem): MenuProps => {
    const stage = d.exploration_stage || '未开始';
    const running = stage === '探索中';
    const exploreEnabled = ['未开始', '已生成', '待确认', '失败'].includes(stage);
    return {
      items: [
        { key: 'edit', label: '编辑领域知识', disabled: running },
        { key: 'explore', label: stage === '失败' ? '重试探索' : '探索领域知识',
          disabled: !exploreEnabled },
        { key: 'import', label: '导入领域知识',
          disabled: running || stage === '已完成' },
        { key: 'add-course', label: '添加课程',
          disabled: running || stage === '未开始' || stage === '已生成' },
        { type: 'divider' },
        { key: 'delete', label: '删除领域', danger: true },
      ],
      onClick: ({ key }) => {
        if (key === 'explore') {
          // 无弹窗直触：立即调用探索接口（未开始发起 / 待确认重探 / 失败重试）
          if (exploreEnabled) {
            void startDomainExplore(d.domain_id);
          }
        } else if (key === 'import') {
          // 导入领域知识：选择 JSON 文件
          importTargetRef.current = d.domain_id;
          fileInputRef.current?.click();
        } else if (key === 'add-course') {
          setFormAction({ kind: 'add-course', domain: d });
        } else if (key === 'edit') {
          setFormAction({ kind: 'edit-domain', domain: d });
        } else if (key === 'delete') {
          confirmDeleteDomain(d);
        }
      },
    };
  };

  // 添加领域（纯手工表单，POST /domains；只采集名称+描述，阶段由探索流产生）
  const submitAddDomain = async (values: { 
    name: string; 
    description: string;
    level: string;
    stages: string;
    scope: string;
  }) => {
    try {
      await createDomain({
        name: values.name.trim(),
        description: values.description,
        level: values.level,
        stages: values.stages.split(',').map(s => s.trim()).filter(Boolean),
        classic_tracks: [],
        scope: values.scope,
      });
      message.success('领域已创建');
      setAddDomainOpen(false);
      void fetchAll();
    } catch (err) {
      message.error(friendlyError(err));
      throw err; // 失败保持弹窗
    }
  };

  const onDragStart = (e: ReactPointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setTreeWidth(e.clientX - rect.left);
  };
  const onDragEnd = (e: ReactPointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="dl-tree-wrap" style={{ width: treeWidth, minWidth: TREE_WIDTH_MIN, maxWidth: TREE_WIDTH_MAX }}>
      <div className="dl-tree" role="tree" aria-label="课程目录树">
        {tree.length === 0 ? (
          <div className="dl-tree-empty">
            {(systemError || knowledgeError)
              ? '课程体系数据不可达（8900/8901 未启动或离线）'
              : '暂无领域：点下方「添加领域」创建，或对既有领域发起探索'}
          </div>
        ) : (
          tree.map((domain: DomainNode) => {
            const expanded = !collapsed.has(domain.domainId);
            const isSelected = selected?.kind === 'domain' && selected.id === domain.domainId;
            const domainRecord = domains.find((x) => x.domain_id === domain.domainId);
            return (
              <Dropdown key={domain.domainId} menu={domainMenu(domainRecord!)} trigger={['contextMenu']}>
                <div
                  className={`dl-tree-node dl-tree-domain${expanded ? ' expanded' : ''}${isSelected ? ' selected' : ''}`}
                  role="treeitem"
                >
                  <span
                    className="dl-tree-caret dl-tree-caret-domain"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDomain(domain.domainId);
                    }}
                  >
                    <CaretRightFilled rotate={expanded ? 90 : 0} />
                  </span>
                  <span
                    className="dl-tree-name"
                    onClick={() => selectNode({ kind: 'domain', id: domain.domainId })}
                  >
                    {domain.name}
                  </span>
                  <span className="dl-tree-count">{domain.courses.length} 门课程</span>
                  {expanded && (
                    <div className="dl-tree-children">
                      {domain.courses.length === 0 ? (
                        <div className="dl-tree-empty">暂无课程（可右键新增或对该领域探索）</div>
                      ) : (
                        domain.courses.map((c) => (
                          <CourseBranch key={c.id} course={c} onImportKnowledge={handleCourseImportKnowledge} onEditCourse={onEditCourse ?? (() => {})} />
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Dropdown>
            );
          })
        )}
      </div>
      {/* 左栏底部固定：添加领域（纯手工表单，2026-08-24 用户裁决；空树亦可用） */}
      <div className="dl-tree-footer">
        <Button
          block size="small" type="dashed"
          icon={<PlusOutlined />}
          aria-label="添加领域"
          onClick={() => {
            addForm.resetFields();
            setAddDomainOpen(true);
          }}
        >
          添加领域
        </Button>
      </div>

      {/* 添加领域（纯表单 POST /domains，不经探索流） */}
      <Modal
        title="添加领域"
        open={addDomainOpen}
        onCancel={() => setAddDomainOpen(false)}
        destroyOnHidden
        width={960}
        okText="创建"
        cancelText="取消"
        onOk={() => addForm.validateFields().then((v) => submitAddDomain(v)).catch(() => { /* 校验失败：表单内联提示 */ })}
      >
        <Form
          form={addForm}
          layout="vertical"
          initialValues={{
            description: '这是一个新的学科领域，等待探索完善。',
            level: '本科',
            stages: '基础,主干,分支,前沿',
            scope: '',
          }}
        >
          <Form.Item name="name" label="领域名（必填；创建后不可改）" rules={[{ required: true, message: '请填写领域名' }]}>
            <Input placeholder="如：高等数学" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="level" label="探索范围（可选）">
            <Input />
          </Form.Item>
          <Form.Item name="stages" label="学习阶段（可选，逗号分隔）">
            <Input />
          </Form.Item>
          <Form.Item name="scope" label="学科知识（可选）">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <div style={{ color: '#999', fontSize: 12 }}>
          创建后可在右侧面板点「探索课程体系」由 LLM 提议课程结构（阶段随探索产生）。
        </div>
      </Modal>

      {/* 右键菜单表单（新增课程 / 修改领域 / 修改课程） */}
      <TreeFormModal action={formAction} onClose={() => setFormAction(null)} />
      {/* REQ-067 B3：导入领域知识文件选择器（隐藏） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      {/* 课程知识导入文件选择器（隐藏） */}
      <input
        ref={courseFileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportCourseFile}
      />
      <div
        className="dl-tree-resizer"
        title="拖拽调整宽度"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <HolderOutlined />
      </div>
    </div>
  );
}
