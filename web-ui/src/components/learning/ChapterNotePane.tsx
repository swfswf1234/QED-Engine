/**
 * 章级注解段（§V2.5／C20）：本章总结 + 学习要点。
 * 成品位挂在章行上（`summary` 与 `meta.chapter_key_points`），进场随目录直读；
 * 缺位才出「生成」入口，生成一次即持久——同一章再进来不必重烧。
 */
import { useMemo } from 'react';
import { Button, Space, Typography } from 'antd';
import { renderInlineMath } from '../parsing/blocks';
import { chapterOf, chapterOfUnit, useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;

export default function ChapterNotePane() {
  const chapters = useLearnWorkbenchStore((s) => s.chapters);
  const selected = useLearnWorkbenchStore((s) => s.selected);
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);
  const generating = useLearnWorkbenchStore((s) => s.generating);
  const generateError = useLearnWorkbenchStore((s) => s.generateError);
  const errorTarget = useLearnWorkbenchStore((s) => s.generateTarget);
  const generateChapter = useLearnWorkbenchStore((s) => s.generateChapter);

  const chapter = useMemo(() => (selected
    ? (selected.kind === 'point'
      ? chapterOfUnit(chapters, selectedPoint)
      : chapterOf(chapters, selected.kpId))
    : null), [chapters, selected, selectedPoint]);

  const missing = !chapter?.summary || (chapter?.key_points.length ?? 0) === 0;

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }} data-testid="chapter-note-pane">
      <Text strong style={{ fontSize: 13 }}>本章总结</Text>
      {chapter?.summary ? (
        <div
          data-testid="chapter-summary"
          style={{ fontSize: 12, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: renderInlineMath(chapter.summary) }}
        />
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {chapter ? '这一章还没有总结：点下面生成一次就存下来。' : '先在左栏选中一条知识点或一章，本章内容才有归属。'}
        </Text>
      )}
      <Text strong style={{ fontSize: 13 }}>学习要点</Text>
      {chapter && chapter.key_points.length > 0 ? (
        <ul data-testid="chapter-key-points" style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
          {chapter.key_points.map((item) => (
            <li
              key={item}
              dangerouslySetInnerHTML={{ __html: renderInlineMath(item) }}
            />
          ))}
        </ul>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>这一章的要点还没有整理。</Text>
      )}
      {chapter && missing && (
        <Button size="small" loading={generating} onClick={() => void generateChapter()}>
          生成本章总结与学习要点
        </Button>
      )}
      {errorTarget === 'chapter' && generateError && (
        <Text type="warning" style={{ fontSize: 12 }}>{generateError}</Text>
      )}
    </Space>
  );
}
