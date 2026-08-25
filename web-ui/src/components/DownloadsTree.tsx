/**
 * 文档下载管理左树 v2（2026-08-24 REQ-059 交互改版）
 * - 真实领域课程体系三层层级：领域 → 课程 → 教程叶子（math-qe 冻结目录退出 UI）
 * - 右键菜单（antd Dropdown contextMenu）：
 *   领域 = 新增课程｜修改领域｜探索课程体系｜删除领域(danger)
 *   课程 = 修改课程｜探索教程｜删除课程(danger)
 * - 树底「＋添加领域」为纯手工表单（POST /domains），与探索流解耦（用户裁决 2026-08-24）
 * - hover 🔍 取消（课程探索走右键菜单）；色点三态保留
 * - 手工维护端点未上线（8901 404）时报错降级提示，不阻塞浏览
 */
import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CaretRightFilled, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Form, Input, InputNumber, Modal, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { ApiError, describeError } from '../api/client';
import {
  createCourse, createDomain, deleteCourse, deleteDomain, updateCourse, updateDomain,
} from '../api/tracker';
import type { CourseNode, DomainNode, TutorialNode } from '../stores/downloads';
import { buildTreeNodes, useDownloadsStore, TREE_WIDTH_MIN, TREE_WIDTH_MAX } from '../stores/downloads';
import { exploreStatusOf, isCourseLocked, useExploreUiStore } from '../stores/explore';
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
 * 书行明细只在右侧栏查看（ARCH-015）。
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
function CourseBranch({ course, onMenuAction }: {
  course: CourseNode;
  onMenuAction: (action: TreeFormAction) => void;
}) {
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const domains = useDownloadsStore((s) => s.domains);
  const openFlow = useExploreUiStore((s) => s.openFlow);
  const { message, modal } = App.useApp();
  const [expanded, setExpanded] = useState(false);
  const isSelected = selected?.kind === 'course' && selected.id === course.id;

  // 探索状态（≤4/≥2 规则）：完成按知识行 status=completed 计，与书行验收解耦
  const tutorialCount = course.tutorials.length;
  const completedCount = course.tutorials.filter((t) => t.knowledge.status === 'completed').length;
  const status = exploreStatusOf(tutorialCount, completedCount);
  const locked = isCourseLocked(tutorialCount, completedCount);

  const courseRecord: CourseRecord | undefined = useMemo(
    () => domains.flatMap((d) => d.courses).find((c) => c.course_id === course.id),
    [domains, course.id],
  );

  const confirmDelete = () => {
    modal.confirm({
      title: `删除课程「${course.name}」？`,
      content: tutorialCount > 0
        ? `该课程下还有 ${tutorialCount} 个教程知识行，上游将拒绝删除（409 保护）。请先处理知识行。`
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

  const menu: MenuProps = {
    items: [
      { key: 'edit', label: '修改课程' },
      { key: 'explore', label: tutorialCount >= 4 ? `探索教程（已达上限 ${tutorialCount}/4）` : locked ? '探索教程（已完成 ≥2 套，锁定）' : '探索教程' },
      { type: 'divider' },
      { key: 'delete', label: '删除课程', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'edit') {
        if (courseRecord) onMenuAction({ kind: 'edit-course', course: courseRecord });
      } else if (key === 'delete') {
        confirmDelete();
      } else if (key === 'explore') {
        if (locked) {
          message.warning(
            tutorialCount >= 4
              ? `该课程已有 ${tutorialCount} 个教程，达到上限 4`
              : `已完成 ${completedCount} 套审核（≥2），停止自动加入新教程`,
          );
          return;
        }
        openFlow({ variant: 'course', courseId: course.id, courseName: course.name });
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

function TreeFormModal({ action, onClose }: { action: TreeFormAction | null; onClose: () => void }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const fetchAll = useDownloadsStore((s) => s.fetchAll);

  const title =
    action?.kind === 'add-course' ? `新增课程（${action.domain.name}）`
      : action?.kind === 'edit-domain' ? `修改领域（${action.domain.name}）`
        : action?.kind === 'edit-course' ? `修改课程（${action.course.name}）`
          : '';

  const initialValues = action?.kind === 'add-course'
    ? {}
    : action?.kind === 'edit-domain'
      ? { description: action.domain.description ?? '' }
      : action?.kind === 'edit-course'
        ? { stage: action.course.stage ?? '', note: action.course.note ?? '' }
        : {};
  const submit = async (values: Record<string, unknown>) => {
    try {
      if (action?.kind === 'add-course') {
        await createCourse(action.domain.domain_id, {
          name: String(values.name).trim(),
          stage: String(values.stage ?? ''),
          note: String(values.note ?? ''),
        });
        message.success('课程已创建');
      } else if (action?.kind === 'edit-domain') {
        await updateDomain(action.domain.domain_id, {
          description: String(values.description ?? ''),
        });
        message.success('领域已更新');
      } else if (action?.kind === 'edit-course') {
        const body: Record<string, unknown> = {
          stage: String(values.stage ?? ''),
          note: String(values.note ?? ''),
        };
        // sort_order 留空 = 不变（undefined 不入请求体）
        if (values.sort_order !== undefined && values.sort_order !== null) body.sort_order = Number(values.sort_order);
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
            <Form.Item name="stage" label="阶段（可选）">
              <Input placeholder="如：本科一年级" />
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
          </>
        )}
        {(action?.kind === 'edit-course') && (
          <>
            <Form.Item label="课程名">
              <Input value={action.course.name} disabled />
            </Form.Item>
            <Form.Item name="stage" label="阶段（可选）">
              <Input placeholder="如：本科一年级" />
            </Form.Item>
            <Form.Item name="sort_order" label="排序（同领域内展示顺序，留空保持不变）">
              <InputNumber min={0} max={9999} style={{ width: '100%' }} placeholder="如：3" />
            </Form.Item>
            <Form.Item name="note" label="备注（可选）">
              <Input.TextArea rows={2} />
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
export default function DownloadsTree() {
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
  const openFlow = useExploreUiStore((s) => s.openFlow);
  const { message, modal } = App.useApp();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [formAction, setFormAction] = useState<TreeFormAction | null>(null);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [addForm] = Form.useForm();
  const dragging = useRef(false);

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

  const domainMenu = (d: DomainSystem): MenuProps => ({
    items: [
      { key: 'add-course', label: '新增课程' },
      { key: 'edit', label: '修改领域' },
      { key: 'explore', label: d.courses.length === 0 ? '探索课程体系（初始）' : '探索课程体系（重探）' },
      { type: 'divider' },
      { key: 'delete', label: '删除领域', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'add-course') setFormAction({ kind: 'add-course', domain: d });
      else if (key === 'edit') setFormAction({ kind: 'edit-domain', domain: d });
      else if (key === 'delete') confirmDeleteDomain(d);
      else if (key === 'explore') openFlow({ variant: 'curriculum', domainId: d.domain_id, domainName: d.name });
    },
  });

  // 添加领域（纯手工表单，POST /domains；只采集名称+描述，阶段由探索流产生）
  const submitAddDomain = async (values: { name: string; description?: string }) => {
    try {
      await createDomain({
        name: values.name.trim(),
        description: values.description ?? '',
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
                  <Tooltip title="右键：新增课程 / 修改 / 探索 / 删除">
                    <span
                      className="dl-tree-name"
                      onClick={() => selectNode({ kind: 'domain', id: domain.domainId })}
                    >
                      {domain.name}
                    </span>
                  </Tooltip>
                  <span className="dl-tree-count">{domain.courses.length} 门课程</span>
                  {expanded && (
                    <div className="dl-tree-children">
                      {domain.courses.length === 0 ? (
                        <div className="dl-tree-empty">暂无课程（可右键新增或对该领域探索）</div>
                      ) : (
                        domain.courses.map((c) => (
                          <CourseBranch key={c.id} course={c} onMenuAction={setFormAction} />
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
        okText="创建"
        cancelText="取消"
        onOk={() => addForm.validateFields().then((v) => submitAddDomain(v)).catch(() => { /* 校验失败：表单内联提示 */ })}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="name" label="领域名（必填；创建后不可改）" rules={[{ required: true, message: '请填写领域名' }]}>
            <Input placeholder="如：高等数学" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea rows={3} placeholder="领域定位说明" />
          </Form.Item>
        </Form>
        <div style={{ color: '#999', fontSize: 12 }}>
          创建后可在右侧面板点「探索课程体系」由 LLM 提议课程结构（阶段随探索产生）。
        </div>
      </Modal>

      {/* 右键菜单表单（新增课程 / 修改领域 / 修改课程） */}
      <TreeFormModal action={formAction} onClose={() => setFormAction(null)} />
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
