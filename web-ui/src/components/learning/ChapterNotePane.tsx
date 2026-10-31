/**
 * 章级批注两段（§6 段①／段②）：本章总结＝章行 `summary` 直读；本章学习导读＝章的导读长文。
 * 两段都是**只读成品位**，缺位整段不渲染（零占位句、零生成入口——本面零生成，§8）。
 * 段②的门与取数键同为章行提升锚 `from_detail_id`：锚空即不发请求；正文不落库（ADR 0026 D5），
 * 走 8900 的梳理透传读腿 `GET /api/v1/kp/nodes/{node_id}/narrative`，`exists=false` 或读腿失败
 * 同样整段不渲染（§10：本面不因导读缺位而解释）。
 */
import { useEffect, useState } from 'react';
import { Space, Typography } from 'antd';
import { getKpNarrative } from '../../api/kp';
import { renderInlineMath } from '../parsing/blocks';
import { chapterOf, chapterOfUnit, useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;

export default function ChapterNotePane() {
  const chapters = useLearnWorkbenchStore((s) => s.chapters);
  const selected = useLearnWorkbenchStore((s) => s.selected);
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);
  const [intro, setIntro] = useState('');

  const chapter = selected
    ? (selected.kind === 'point'
      ? chapterOfUnit(chapters, selectedPoint)
      : chapterOf(chapters, selected.kpId))
    : null;
  const anchor = String(chapter?.from_detail_id ?? '');

  useEffect(() => {
    if (!anchor) {
      setIntro('');
      return undefined;
    }
    let alive = true;
    getKpNarrative(anchor)
      .then((res) => { if (alive) setIntro(res.exists ? String(res.content ?? '') : ''); })
      .catch(() => { if (alive) setIntro(''); });
    return () => { alive = false; };
  }, [anchor]);

  if (!chapter) return null;

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }} data-testid="chapter-note-pane">
      {chapter.summary && (
        <>
          <Text strong style={{ fontSize: 13 }}>本章总结</Text>
          <div
            data-testid="chapter-summary"
            style={{ fontSize: 12, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: renderInlineMath(chapter.summary) }}
          />
        </>
      )}
      {anchor && intro && (
        <>
          <Text strong style={{ fontSize: 13 }}>本章学习导读</Text>
          <div
            data-testid="chapter-intro"
            style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: renderInlineMath(intro) }}
          />
        </>
      )}
    </Space>
  );
}
