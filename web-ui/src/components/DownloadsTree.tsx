import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Tag } from 'antd';
import { CaretRightFilled, HolderOutlined } from '@ant-design/icons';
import type { DomainNode, TutorialNode } from '../stores/downloads';
import { buildTreeNodes, useDownloadsStore, TREE_WIDTH_MIN, TREE_WIDTH_MAX } from '../stores/downloads';
import type { SelectionRecord } from '../stores';

/** 角色中文名（表1 roles） */
const ROLE_LABELS: Record<string, string> = {
  textbook: '教材',
  exercises: '习题集',
  solutions: '题解',
  reference: '参考',
  supplement: '配套资料',
};

function roleLabel(roles: string[]): string {
  return (roles ?? [])
    .map((r) => ROLE_LABELS[r] ?? r)
    .join('&') || '书目';
}

function tutorialItemRow(s: SelectionRecord) {
  const count = (s.downloads ?? []).length;
  return (
    <div className="dl-tree-book" key={s.selection_id}>
      <Tag style={{ marginRight: 6 }}>{roleLabel(s.roles)}</Tag>
      <span className="dl-tree-book-title" title={s.title}>《{s.title}》</span>
      {count > 0 && <span className="dl-tree-book-count">{count} 册明细</span>}
    </div>
  );
}

function TutorialLeaf({ node }: { node: TutorialNode }) {
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const [expanded, setExpanded] = useState(false);
  const isSelected = selected?.kind === 'tutorial' && selected.key === node.key;
  // 套节点可展开显示条目行（单条目套同样可展开）；单条目教程为叶子，名称即书名
  const collapsible = node.isSet;

  return (
    <div className={`dl-tree-node dl-tree-tutorial${collapsible && expanded ? ' expanded' : ''}${isSelected ? ' selected' : ''}`}>
      <span
        className="dl-tree-caret"
        onClick={(e) => {
          e.stopPropagation();
          if (collapsible) setExpanded((v) => !v);
        }}
      >
        {collapsible && <CaretRightFilled rotate={expanded ? 90 : 0} />}
      </span>
      <span
        className="dl-tree-name"
        onClick={() => {
          if (collapsible && !expanded) setExpanded(true);
          selectNode({ kind: 'tutorial', key: node.key });
        }}
      >
        {node.label}
      </span>
      {collapsible && <span className="dl-tree-count">{node.items.length} 项</span>}
      {collapsible && expanded && (
        <div className="dl-tree-children">{node.items.map((s) => tutorialItemRow(s))}</div>
      )}
    </div>
  );
}

function CourseBranch({ course }: { course: DomainNode['courses'][number] }) {
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const [expanded, setExpanded] = useState(false);
  const isSelected = selected?.kind === 'course' && selected.id === course.id;

  return (
    <div className={`dl-tree-node dl-tree-course${expanded ? ' expanded' : ''}${isSelected ? ' selected' : ''}`}>
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
        {course.name}
      </span>
      {course.tutorials.length > 0 && <span className="dl-tree-count">{course.tutorials.length} 教程</span>}
      {expanded && (
        <div className="dl-tree-children">
          {course.tutorials.length === 0 ? (
            <div className="dl-tree-empty">暂无书目条目</div>
          ) : (
            course.tutorials.map((t) => (
              <TutorialLeaf key={t.key} node={t} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 下载管理左树（Phase 4a）
 * - 领域常驻展开；课程/教程点名称展开折叠（文件列表式），箭头只折叠/展开不选中
 * - 领域/课程名称点击 → 选中 + 联动右侧筛选（单向）
 * - 树宽拖拽：右侧手柄（280–640px，localStorage 记忆）
 */
export default function DownloadsTree() {
  const catalogTargets = useDownloadsStore((s) => s.catalogTargets);
  const selections = useDownloadsStore((s) => s.selections);
  const tree = useMemo(() => buildTreeNodes(catalogTargets, selections), [catalogTargets, selections]);
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const treeWidth = useDownloadsStore((s) => s.treeWidth);
  const setTreeWidth = useDownloadsStore((s) => s.setTreeWidth);
  const catalogError = useDownloadsStore((s) => s.catalogError);
  const selectionsError = useDownloadsStore((s) => s.selectionsError);
  const dragging = useRef(false);

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
            {(catalogError || selectionsError) ? '课程目录数据不可达（8900 离线或服务未启动）' : '暂无课程目录'}
          </div>
        ) : (
          tree.map((domain) => {
            const isSelected = selected?.kind === 'domain' && selected.id === domain.name;
            return (
              <div
                key={domain.name}
                className={`dl-tree-node dl-tree-domain${isSelected ? ' selected' : ''}`}
                role="treeitem"
              >
                <span className="dl-tree-caret dl-tree-caret-domain"><CaretRightFilled rotate={90} /></span>
                <span
                  className="dl-tree-name"
                  onClick={() => selectNode({ kind: 'domain', id: domain.name })}
                >
                  {domain.name}
                </span>
                <span className="dl-tree-count">{domain.courses.length} 门课程</span>
                <div className="dl-tree-children">
                  {domain.courses.map((c) => (
                    <CourseBranch key={c.id} course={c} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
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