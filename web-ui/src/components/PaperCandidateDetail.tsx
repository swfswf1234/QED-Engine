/**
 * 论文候选详情（REQ-108 I5 ①②，REQ-107 壳 §7）
 * - 段④就地展开与书目弹窗按需回源共用同一呈现：摘要 / 评审小结（reason + risks）/ 三维分
 * - 「权威」裁决为 PASS（R3）：引用数只做展示位，此处一律不渲染；判定不引入任何服务端阈值副本
 */
import { Typography } from 'antd';
import type { PaperCandidateEntry, PaperCandidateInfo } from '../stores';

const { Text } = Typography;

type Assessment = PaperCandidateEntry['assessment'];

export default function PaperCandidateDetail({ candidate, assessment, score, recommended, testId = 'paper-candidate-detail' }: {
  candidate: PaperCandidateInfo;
  assessment: Assessment | null;
  score: number | null;
  recommended: boolean | null;
  testId?: string;
}) {
  const scoreLine = [
    assessment ? `相关度 ${assessment.goal_fit}` : null,
    assessment ? `基础性 ${assessment.foundational_value}` : null,
    assessment ? `可读性 ${assessment.readability}` : null,
    score !== null ? `总分 ${score}` : null,
    recommended !== null ? `服务端推荐：${recommended ? '是' : '否'}` : null,
  ].filter(Boolean).join(' ｜ ');

  return (
    <div className="paper-candidate-detail" data-testid={testId}>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>摘要</Text>
        <div><Text style={{ fontSize: 12 }}>{candidate.abstract?.trim() || '该记录未携带摘要'}</Text></div>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>评审小结</Text>
        <div><Text style={{ fontSize: 12 }}>{assessment?.reason || '（无）'}</Text></div>
        {(assessment?.risks?.length ?? 0) > 0 && (
          <ul style={{ margin: '2px 0', paddingLeft: 18 }}>
            {assessment?.risks.map((risk) => <li key={risk}><Text type="secondary" style={{ fontSize: 12 }}>{risk}</Text></li>)}
          </ul>
        )}
      </div>
      {scoreLine && (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>{scoreLine}</Text>
        </div>
      )}
    </div>
  );
}
