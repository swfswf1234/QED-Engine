/**
 * 版式样式面板（parsing-ui §8/§9.1 TypographyPanel）：仅三项控制——
 * 正文字体（宋/黑/楷）、正文字号（五号～一号阶梯）、显示页眉页脚（版式态默认隐藏）。
 * 偏好由 store.typography 承载并 localStorage 持久（§5）；本组件无自身状态。
 */
import { Select, Space, Switch, Typography } from 'antd';
import {
  BODY_FONT_LABELS, FONT_LADDER_LABELS, FONT_LADDER_PT,
  type BodyFontKey, type TypographyPrefs,
} from './typography';

const { Text } = Typography;

export interface TypographyPanelProps {
  prefs: TypographyPrefs;
  onChange: (patch: Partial<TypographyPrefs>) => void;
}

export default function TypographyPanel({ prefs, onChange }: TypographyPanelProps) {
  return (
    <Space direction="vertical" size={8} style={{ width: 250 }}>
      <Space size={6}>
        <Text type="secondary" style={{ fontSize: 12, width: 64, display: 'inline-block' }}>正文字体</Text>
        <Select
          size="small"
          style={{ width: 150 }}
          aria-label="正文字体"
          value={prefs.bodyFont}
          options={(Object.keys(BODY_FONT_LABELS) as BodyFontKey[]).map((k) => ({ value: k, label: BODY_FONT_LABELS[k] }))}
          onChange={(v: BodyFontKey) => onChange({ bodyFont: v })}
        />
      </Space>
      <Space size={6}>
        <Text type="secondary" style={{ fontSize: 12, width: 64, display: 'inline-block' }}>正文字号</Text>
        <Select
          size="small"
          style={{ width: 150 }}
          aria-label="正文字号"
          value={prefs.bodyLevel}
          options={FONT_LADDER_LABELS.map((label, i) => ({ value: i, label: `${label}（${FONT_LADDER_PT[i]}pt）` }))}
          onChange={(v: number) => onChange({ bodyLevel: v })}
        />
      </Space>
      <Space size={6}>
        <Text type="secondary" style={{ fontSize: 12, width: 64, display: 'inline-block' }}>页眉页脚</Text>
        <Switch
          size="small"
          aria-label="显示页眉页脚"
          checked={prefs.showFurniture}
          onChange={(on) => onChange({ showFurniture: on })}
        />
      </Space>
    </Space>
  );
}
