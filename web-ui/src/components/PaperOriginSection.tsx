/**
 * 已入库论文详情的「探索记录」小节（REQ-108 I5 ②，REQ-107 壳 §7）
 * - 按需回源纪律：只在点击「查看探索记录」时发请求，只扫本领域报告（≤20 份），失败静默转未命中
 * - 命中呈现与段④共用 PaperCandidateDetail；未命中不编造摘要
 * - 引用数按裁决只做展示位，本组件不渲染
 */
import { Button, Space, Typography } from 'antd';
import PaperCandidateDetail from './PaperCandidateDetail';
import { usePaperExploreStore } from '../stores/paperExplore';

const { Text } = Typography;

export default function PaperOriginSection({ bookId, domainId, arxivId }: {
  bookId: string;
  domainId: string;
  /** 来自渠道尝试记录 channel==='arxiv' 的 provider_id；空=早期采纳或记录已清理 */
  arxivId: string;
}) {
  const trace = usePaperExploreStore((s) => s.trace);
  const tracePaperOrigin = usePaperExploreStore((s) => s.tracePaperOrigin);
  const current = trace?.bookId === bookId ? trace : null;

  return (
    <div data-testid="paper-origin-section">
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space size={8}>
          <Text strong>探索记录</Text>
          <Button
            size="small"
            loading={current?.state === 'loading'}
            onClick={() => void tracePaperOrigin({ bookId, domainId, arxivId })}
          >
            查看探索记录
          </Button>
          {current?.state === 'hit' && current.hit && (
            <Text type="secondary" style={{ fontSize: 12 }}>来自报告 {current.hit.selection_id}</Text>
          )}
        </Space>
        {current?.state === 'hit' && current.hit && (
          <PaperCandidateDetail
            candidate={current.hit.candidate}
            assessment={current.hit.assessment}
            score={current.hit.score}
            recommended={current.hit.recommended}
            testId="paper-origin-detail"
          />
        )}
        {current?.state === 'miss' && (
          <Text type="secondary" style={{ fontSize: 12 }} data-testid="paper-origin-miss">
            该论文没有探索记录（早期采纳或报告已清理）
          </Text>
        )}
        {current?.state === 'no_source' && (
          <Text type="secondary" style={{ fontSize: 12 }} data-testid="paper-origin-no-source">
            无法取得 arXiv 标识（渠道尝试记录里没有 arxiv 来源），不回源探索记录
          </Text>
        )}
      </Space>
    </div>
  );
}
