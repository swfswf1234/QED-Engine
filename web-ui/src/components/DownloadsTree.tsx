import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CaretRightFilled, HolderOutlined } from '@ant-design/icons';
import type { CategoryNode, CourseNode, TutorialNode } from '../stores/downloads';
import { buildTreeNodes, useDownloadsStore, TREE_WIDTH_MIN, TREE_WIDTH_MAX } from '../stores/downloads';

/**
 * 教程叶子：只展示 name + 验收进度（verified/total 已验收），不可点击、不可展开。
 * 书行明细只在右侧栏查看（ARCH-015）。
 */
function TutorialLeaf({ node }: { node: TutorialNode }) {
  return (
    <div className="dl-tree-node dl-tree-tutorial">
      <span className="dl-tree-caret dl-tree-caret-disabled" />
      <span className="dl-tree-name dl-tree-tutorial-name" title={node.label}>
        {node.label}
      </span>
      {node.total > 0 && <span className="dl-tree-progress">{node.verified}/{node.total} 已验收</span>}
    </div>
  );
}

/** 课程分支：可折叠显示教程叶子；点击名称 → 选中 + 联动筛选 */
function CourseBranch({ course }: { course: CourseNode }) {
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
            <div className="dl-tree-empty">暂无教程</div>
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

/** 分类头：仅展示分组（分析/代数/概率/其他），不可点击 */
function CategoryHeader({ category }: { category: CategoryNode }) {
  return (
    <div className="dl-tree-node dl-tree-category">
      <span className="dl-tree-caret dl-tree-caret-disabled" />
      <span className="dl-tree-name dl-tree-category-name">{category.name}</span>
      <span className="dl-tree-count">{category.courses.length} 门课程</span>
      <div className="dl-tree-children">
        {category.courses.map((c) => (
          <CourseBranch key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}

/**
 * 下载管理左树（ARCH-015 重构）
 * - 领域（高等数学，唯一）可折叠（默认展开）；点击名称 → 选中 + 清课程筛选（显示全部）
 * - 分类（分析/代数/概率/其他）仅展示分组头，不可点击
 * - 课程可折叠（默认折叠），点击名称 → 选中 + 联动右侧筛选
 * - 教程为叶子，只展示名称 + 验收进度，不可点击/展开
 * - 树宽拖拽：右侧手柄（280–640px，localStorage 记忆）
 */
export default function DownloadsTree() {
  const catalogTargets = useDownloadsStore((s) => s.catalogTargets);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const details = useDownloadsStore((s) => s.details);
  const tree = useMemo(() => buildTreeNodes(catalogTargets, knowledge, details), [catalogTargets, knowledge, details]);
  const selectNode = useDownloadsStore((s) => s.selectNode);
  const selected = useDownloadsStore((s) => s.selected);
  const treeWidth = useDownloadsStore((s) => s.treeWidth);
  const setTreeWidth = useDownloadsStore((s) => s.setTreeWidth);
  const catalogError = useDownloadsStore((s) => s.catalogError);
  const knowledgeError = useDownloadsStore((s) => s.knowledgeError);
  const [domainExpanded, setDomainExpanded] = useState(true);
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
            {(catalogError || knowledgeError) ? '课程目录数据不可达（8900 离线或服务未启动）' : '暂无课程目录'}
          </div>
        ) : (
          tree.map((domain) => {
            const isSelected = selected?.kind === 'domain' && selected.id === domain.name;
            return (
              <div
                key={domain.name}
                className={`dl-tree-node dl-tree-domain${domainExpanded ? ' expanded' : ''}${isSelected ? ' selected' : ''}`}
                role="treeitem"
              >
                <span
                  className="dl-tree-caret dl-tree-caret-domain"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDomainExpanded((v) => !v);
                  }}
                >
                  <CaretRightFilled rotate={domainExpanded ? 90 : 0} />
                </span>
                <span
                  className="dl-tree-name"
                  onClick={() => selectNode({ kind: 'domain', id: domain.name })}
                >
                  {domain.name}
                </span>
                <span className="dl-tree-count">
                  {domain.categories.reduce((n, c) => n + c.courses.length, 0)} 门课程
                </span>
                {domainExpanded && (
                  <div className="dl-tree-children">
                    {domain.categories.map((c) => (
                      <CategoryHeader key={c.name} category={c} />
                    ))}
                  </div>
                )}
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
