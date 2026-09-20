/**
 * 左侧书目树（parsing-ui §6 BookTree，G 轮自 D 轮列表态回调）：领域 → 课程 → 书目三级。
 * 纯选择：无状态 Tag、无进度徽标、无筛选行、无搜索框；点击书目节点进入右侧对照。
 * 数据源 /parsing/tree（8900 共享表领域课程 + 8902 书目）；样式复用 downloads.css dl-tree-*。
 */
import { useCallback, useEffect, useState } from 'react';
import { CaretRightFilled } from '@ant-design/icons';
import { useParsingStore, type ParsingTreeNode } from '../../stores/parsing';
import '../../downloads.css';

/** 默认展开第一个领域及其全部课程 */
function useDefaultExpansion(tree: ParsingTreeNode[]) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [inited, setInited] = useState(false);

  useEffect(() => {
    if (!inited && tree.length > 0) {
      const first = tree[0];
      setExpandedDomains(new Set([first.key]));
      if (first.children?.length) setExpandedCourses(new Set(first.children.map((c) => c.key)));
      setInited(true);
    }
  }, [tree, inited]);

  const toggleDomain = useCallback((key: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleCourse = useCallback((key: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  return { expandedDomains, expandedCourses, toggleDomain, toggleCourse };
}

export default function BookTree() {
  const tree = useParsingStore((s) => s.tree);
  const treeLoading = useParsingStore((s) => s.treeLoading);
  const treeError = useParsingStore((s) => s.treeError);
  const dataError = useParsingStore((s) => s.dataError);
  const compareBookId = useParsingStore((s) => s.compareBookId);
  const openWorkbench = useParsingStore((s) => s.openWorkbench);

  const { expandedDomains, expandedCourses, toggleDomain, toggleCourse } = useDefaultExpansion(tree);

  const onSelectBook = useCallback(
    (node: ParsingTreeNode) => {
      if (node.type === 'book' && node.book) void openWorkbench(node.book.book_id, 1, node.book);
    },
    [openWorkbench],
  );

  return (
    <div className="dl-tree-wrap" style={{ height: '100%' }}>
      <div className="dl-tree" role="tree" aria-label="书目目录树">
        {tree.length === 0 && !treeLoading ? (
          <div className="dl-tree-empty">
            {treeError ? '加载失败，请点「刷新」重试' : dataError ? '8902 离线，暂无书目数据（领域和课程已加载）' : '暂无课程数据'}
          </div>
        ) : (
          tree.map((domain) => {
            const dExpanded = expandedDomains.has(domain.key);
            return (
              <div key={domain.key} className={`dl-tree-node dl-tree-domain${dExpanded ? ' expanded' : ''}`} role="treeitem">
                <span className="dl-tree-caret dl-tree-caret-domain" onClick={() => toggleDomain(domain.key)}>
                  <CaretRightFilled rotate={dExpanded ? 90 : 0} />
                </span>
                <span className="dl-tree-name">{domain.title}</span>
                {domain.children?.length ? <span className="dl-tree-count">{domain.children.length} 门课程</span> : null}
                {dExpanded && domain.children?.length ? (
                  <div className="dl-tree-children">
                    {domain.children.map((course) => {
                      const cExpanded = expandedCourses.has(course.key);
                      return (
                        <div key={course.key} className={`dl-tree-node dl-tree-course${cExpanded ? ' expanded' : ''}`}>
                          <span className="dl-tree-caret" onClick={() => toggleCourse(course.key)}>
                            <CaretRightFilled rotate={cExpanded ? 90 : 0} />
                          </span>
                          <span className="dl-tree-name">{course.title}</span>
                          {course.children?.length ? <span className="dl-tree-count">{course.children.length} 本</span> : null}
                          {cExpanded && course.children?.length ? (
                            <div className="dl-tree-children">
                              {course.children.map((bookNode) => (
                                <div
                                  key={bookNode.key}
                                  className={`dl-tree-node dl-tree-book${compareBookId && bookNode.book?.book_id === compareBookId ? ' selected' : ''}`}
                                  role="treeitem"
                                  onClick={() => bookNode.book && onSelectBook(bookNode)}
                                >
                                  <span className="dl-tree-caret dl-tree-caret-disabled" />
                                  <span className="dl-tree-name">
                                    {bookNode.book?.display_title || bookNode.book?.title || bookNode.book?.book_id || bookNode.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
