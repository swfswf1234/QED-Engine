/**
 * 探索全弹窗流（2026-08-24 REQ-059 交互改版；取代原「发起 Modal + 独立确认页」双跳转结构）
 * - 发起（direct / text / doc 三模式，与 exploration-api 冻结契约 §1/§6 一致）
 *   → 轮询进度（3s，store 驱动）→ 结果清单：
 *   课程层 = 推荐卡勾选 + 采纳/放弃；领域层 = 变更 diff 卡 + 应用所选（conflicts 展示）
 * - 关闭弹窗不打断后台轮询：同目标再次打开且运行仍在/已就绪时直接进结果视图；
 *   服务端幂等启动（deduplicated）兜底页面刷新丢失会话的情况
 * - 领域层按钮状态机经 useExploreUiStore.domainRunStatus 同步右面板
 *   （running 置灰 / ready「查看探索结果」/ applied 终态置灰）
 * - 内容级 ErrorBoundary：弹窗内渲染异常不拖垮整页
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Badge, Button, Checkbox, Form, Input, Modal, Radio, Space, Spin, Tag, Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ProposalCard from './ProposalCard';
import ChangeCard from './ChangeCard';
import ErrorBoundary from './ErrorBoundary';
import { describeError } from '../api/client';
import { useDownloadsStore } from '../stores/downloads';
import {
  isExploreMockEnabled, remainingSlots, useExploreStore, useExploreUiStore,
} from '../stores/explore';
import type { ExploreFlowTarget, ExploreParams } from '../stores/explore';
import { showExploreSlots } from '../stores/uiFlags';
import type { CurriculumChange, CurriculumRun, ExploreProposal, ExploreRun } from '../stores';

const { Text } = Typography;

/** 当前 run 是否属于目标对象（决定弹窗直接进结果视图还是先展示发起表单） */
function runMatchesTarget(
  run: ExploreRun | CurriculumRun | null,
  target: ExploreFlowTarget | null,
): boolean {
  if (!run || !target) return false;
  if (target.variant === 'course') {
    return run.scope === 'course' && run.course_id === target.courseId;
  }
  return run.scope === 'curriculum' && run.params.domain_name === target.domainName;
}

// --- 课程层结果视图（原确认页 CourseView 弹窗化） ---

function CourseResultView() {
  const run = useExploreStore((s) => s.run) as ExploreRun | null;
  const error = useExploreStore((s) => s.error);
  const adopt = useExploreStore((s) => s.adopt);
  const discard = useExploreStore((s) => s.discard);
  const startCourse = useExploreStore((s) => s.startCourse);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const { message } = App.useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!run) return null;

  const courseId = run.course_id;
  const existingCount = knowledge.filter((k) => k.course_id === courseId).length;
  const slots = remainingSlots(existingCount);
  const proposals: ExploreProposal[] = run.proposals ?? [];

  const toggle = (id: string, on: boolean) => {
    setSelectedIds((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const relaunch = () => {
    setSelectedIds([]);
    void startCourse(courseId, run.params).then(() => {
      const err = useExploreStore.getState().error;
      if (err) message.error(err);
    });
  };

  return (
    <div className="explore-course-view">
      <div className="explore-statusbar">
        {run.status === 'running' && (
          <Space>
            <Spin size="small" />
            <Text strong>LLM 检索中…</Text>
            <Text type="secondary">运行 {run.run_id} · 每 3 秒轮询</Text>
          </Space>
        )}
        {run.status === 'ready' && (
          <Space wrap>
            <Badge status="processing" />
            <Text strong>本次推荐（{proposals.length} 套）</Text>
            {showExploreSlots() && (
              <Text type="secondary">上限余量 {slots} · 已勾选 {selectedIds.length}/{slots}</Text>
            )}
          </Space>
        )}
        {(run.status === 'adopted' || run.status === 'discarded') && (
          <Space wrap>
            <Tag color={run.status === 'adopted' ? 'green' : 'default'}>
              {run.status === 'adopted' ? '已采纳' : '已放弃'}
            </Tag>
            {run.status === 'adopted' && (
              <Text type="secondary">
                新增教程：{run.adopted_proposal_ids.map((id) => proposals.find((p) => p.proposal_id === id)?.set_name ?? id).join('、')}
                （文档下载管理中为「探索中」草稿，可继续组织书行下载）
              </Text>
            )}
          </Space>
        )}
        {run.status === 'failed' && <Tag color="red">探索失败</Tag>}
      </div>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 12 }}
          message="探索服务异常"
          description={
            <Space direction="vertical">
              <span>{error}</span>
              <Button size="small" icon={<ReloadOutlined />} onClick={relaunch}>重试</Button>
            </Space>
          }
        />
      )}

      {run.status === 'ready' && (
        <>
          <div className="explore-proposals">
            {proposals.map((p) => (
              <ProposalCard
                key={p.proposal_id}
                proposal={p}
                checked={selectedIds.includes(p.proposal_id)}
                disabled={selectedIds.length >= slots && !selectedIds.includes(p.proposal_id)}
                onToggle={(on) => toggle(p.proposal_id, on)}
              />
            ))}
          </div>
          <div className="explore-actions">
            <Button
              type="primary"
              disabled={selectedIds.length === 0 || selectedIds.length > slots}
              onClick={() => {
                void adopt(selectedIds).then((result) => {
                  if (result) {
                    message.success(`已采纳 ${result.adopted.length} 套，草稿教程已生成`);
                    // mock 模式：草稿行已本地注入，勿用服务端数据覆盖；真实模式经 fetchAll 刷新
                    if (!isExploreMockEnabled()) void fetchAll();
                  }
                });
              }}
            >
              采纳所选({selectedIds.length})
            </Button>
            <Button onClick={() => void discard()}>放弃本次</Button>
            <Button icon={<ReloadOutlined />} onClick={relaunch}>同参重探</Button>
            {showExploreSlots() && <Text type="secondary">可勾数 = 4 − 该课现有教程数（{existingCount}）</Text>}
          </div>
        </>
      )}

      {run.status !== 'ready' && run.status !== 'running' && (
        <div className="explore-terminal">
          {run.status === 'failed' && (
            <Button icon={<ReloadOutlined />} onClick={relaunch}>重试</Button>
          )}
        </div>
      )}

      {(run.adopted_proposal_ids?.length ?? 0) > 0 && (
        <div className="explore-adopted-note">
          已采纳 proposal：{run.adopted_proposal_ids.join('、')}
        </div>
      )}
      {/* 关闭入口由弹窗 footer 提供，此处不再放返回按钮 */}
    </div>
  );
}

// --- 领域层结果视图（原确认页 CurriculumView 弹窗化） ---

function CurriculumResultView() {
  const run = useExploreStore((s) => s.run) as CurriculumRun | null;
  const error = useExploreStore((s) => s.error);
  const applyChanges = useExploreStore((s) => s.applyChanges);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const { message } = App.useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const changes: CurriculumChange[] = useMemo(() => run?.proposals ?? [], [run]);

  if (!run) return null;
  const appliedSet = new Set(run.adopted_proposal_ids);
  const conflictMap = new Map(run.conflicts.map((c) => [c.change_id, c.reason]));
  const terminal = run.status === 'applied' || run.status === 'partially_applied';

  return (
    <div className="explore-curriculum-view">
      <div className="explore-statusbar">
        {run.status === 'running' && (
          <Space><Spin size="small" /><Text strong>课程体系探索中…</Text></Space>
        )}
        {run.status === 'ready' && (
          <Text strong>提议变更（{changes.length} 项）· 仅勾选取舍，应用后写入领域与课程表</Text>
        )}
        {terminal && (
          <Space wrap>
            <Tag color={run.status === 'applied' ? 'green' : 'orange'}>
              {run.status === 'applied' ? '应用完成' : '部分应用'}
            </Tag>
            <Text type="secondary">已写入 qed_domain / qed_course；左树将自动刷新</Text>
          </Space>
        )}
      </div>

      {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={describeError(error)} />}

      {/* 空提议显式提示（2026-08-24 用户反馈「探索结果为空」无任何说明） */}
      {run.status === 'ready' && changes.length === 0 && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="LLM 未给出任何提议"
          description="可关闭后重探；建议改用「粘贴参考文本 / 指定文本文档路径」提供更多上下文后再试。"
        />
      )}

      {conflictMap.size > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="部分变更被拒绝（冲突标记，未静默覆盖）"
          description={[...conflictMap.entries()].map(([id, reason]) => <div key={id}>{id}: {reason}</div>)}
        />
      )}

      <div className="explore-changes">
        {changes.map((c) => (
          <ChangeCard
            key={c.change_id}
            change={c}
            checked={selectedIds.includes(c.change_id) || appliedSet.has(c.change_id)}
            disabled={terminal || conflictMap.has(c.change_id)}
            onToggle={(on) =>
              setSelectedIds((prev) => (on ? [...new Set([...prev, c.change_id])] : prev.filter((x) => x !== c.change_id)))
            }
          />
        ))}
      </div>

      {!terminal && run.status === 'ready' && (
        <div className="explore-actions">
          <Checkbox
            checked={selectedIds.length === changes.length && changes.length > 0}
            indeterminate={selectedIds.length > 0 && selectedIds.length < changes.length}
            onChange={(e) => setSelectedIds(e.target.checked ? changes.map((c) => c.change_id) : [])}
          >
            全选
          </Checkbox>
          <Button
            type="primary"
            disabled={selectedIds.length === 0}
            onClick={() => {
              void applyChanges(selectedIds).then((result) => {
                if (result) {
                  message.success(`已应用 ${result.applied.length} 项变更`);
                  if (!isExploreMockEnabled()) void fetchAll();
                }
              });
            }}
          >
            应用所选变更({selectedIds.length})
          </Button>
        </div>
      )}
    </div>
  );
}

// --- 主组件 ---

/** 文档模式默认路径提示（规范位置，dataset-conventions tmp/exploration 桶） */
function docPlaceholder(objectName?: string): string {
  const name = objectName ?? '<对象名>';
  return `如：D:/coding/QED-Engine/dataset/tmp/exploration/${name}探索.txt`;
}

export default function ExploreFlowModal({ target, onClose }: {
  target: ExploreFlowTarget | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const run = useExploreStore((s) => s.run);
  const launching = useExploreStore((s) => s.launching);
  const startCourse = useExploreStore((s) => s.startCourse);
  const startCurriculum = useExploreStore((s) => s.startCurriculum);
  const setDomainRunStatus = useExploreUiStore((s) => s.setDomainRunStatus);

  /** 已有匹配目标的运行 → 直接展示结果视图（关闭再开/后台完成后回看不丢上下文） */
  const matched = useMemo(() => (runMatchesTarget(run, target) ? run : null), [run, target]);
  const variant: 'course' | 'curriculum' = target?.variant ?? 'course';

  // 领域层按钮状态机同步（failed/discarded 回到可点态）
  useEffect(() => {
    if (!target || target.variant !== 'curriculum') return;
    if (!matched || matched.scope !== 'curriculum') {
      setDomainRunStatus(target.domainId, null);
      return;
    }
    if (matched.status === 'running') setDomainRunStatus(target.domainId, 'running');
    else if (matched.status === 'ready') setDomainRunStatus(target.domainId, 'ready');
    else if (matched.status === 'applied' || matched.status === 'partially_applied') setDomainRunStatus(target.domainId, 'applied');
    else setDomainRunStatus(target.domainId, null);
  }, [matched, target, setDomainRunStatus]);

  useEffect(() => {
    if (target) form.resetFields();
  }, [target, form]);

  // 持久化恢复的未终态运行：弹窗打开即续轮询（2026-08-24 刷新恢复链路）
  useEffect(() => {
    if (!target) return;
    useExploreStore.getState().ensurePolling();
  }, [target]);

  const onStart = async (values: { mode: ExploreParams['mode']; ref_text?: string; ref_doc_path?: string }) => {
    const params: ExploreParams = {
      mode: values.mode ?? 'direct',
      ...(values.mode === 'text' ? { ref_text: values.ref_text } : {}),
      ...(values.mode === 'doc' ? { ref_doc_path: values.ref_doc_path } : {}),
    };
    try {
      if (variant === 'curriculum' && target?.variant === 'curriculum') {
        await startCurriculum(target.domainName, params);
      } else if (target?.variant === 'course') {
        await startCourse(target.courseId, params);
      }
      const err = useExploreStore.getState().error;
      if (err) {
        message.error(err);
        return;
      }
      if (variant === 'curriculum' && target?.variant === 'curriculum') {
        setDomainRunStatus(target.domainId, 'running');
      }
    } catch (err) {
      message.error(describeError(err));
    }
  };

  const title =
    variant === 'course'
      ? `探索教程 · ${target?.variant === 'course' ? target.courseName ?? target.courseId : ''}`
      : `课程体系探索 · ${target?.variant === 'curriculum' ? target.domainName : ''}`;

  // footer 状态机：发起表单 → [取消|开始探索]；进行中 → [后台运行]；终态 → [关闭]
  let footer;
  if (!matched) {
    footer = [
      <Button key="cancel" onClick={onClose}>取消</Button>,
      <Button
        key="start" type="primary" loading={launching}
        onClick={() => form.validateFields().then((v) => void onStart(v)).catch(() => { /* 校验失败：表单内联提示 */ })}
      >
        开始探索
      </Button>,
    ];
  } else if (matched.status === 'running') {
    footer = [<Button key="bg" onClick={onClose}>后台运行</Button>];
  } else {
    footer = [<Button key="close" type="primary" onClick={onClose}>关闭</Button>];
  }

  return (
    <Modal
      title={title}
      open={target !== null}
      onCancel={onClose}
      width={720}
      footer={footer}
      destroyOnHidden
    >
      <ErrorBoundary>
        {/* 2026-08-24 防混淆：mock 开关残留时显式告警（此前曾致「探索无响应」误判） */}
        {isExploreMockEnabled() && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 12 }}
            message="探索 Mock 模式已开启（localStorage qed-explore-mock=1）"
            description="当前请求走本地模拟后端，不会访问真实服务；请在控制台执行 localStorage.removeItem('qed-explore-mock') 后刷新页面以切回真实链路。"
          />
        )}
        {!matched ? (
          <>
            {variant === 'curriculum' && (
              <Text type="secondary">
                将基于该领域现有课程体系由 LLM 重探课程结构与教程推荐；若领域为空则等同初始探索。
              </Text>
            )}
            <Form form={form} layout="vertical" initialValues={{ mode: 'direct' }} style={{ marginTop: variant === 'curriculum' ? 12 : 0 }}>
              <Form.Item name="mode" label="发起方式">
                <Radio.Group>
                  <Radio value="direct">直接开始</Radio>
                  <Radio value="text">粘贴参考文本</Radio>
                  <Radio value="doc">指定文本文档路径</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item shouldUpdate={(prev, cur) => prev.mode !== cur.mode} noStyle>
                {({ getFieldValue }) =>
                  getFieldValue('mode') === 'text' ? (
                    <Form.Item
                      name="ref_text"
                      label="参考文本（作为 LLM 选书偏好输入）"
                      rules={[{ required: true, message: '请粘贴参考文本' }]}
                    >
                      <Input.TextArea rows={4} placeholder="选书偏好/范例说明，如：优先美版经典教材的中译本，配套习题集成套推荐" />
                    </Form.Item>
                  ) : getFieldValue('mode') === 'doc' ? (
                    <>
                      <Form.Item
                        name="ref_doc_path"
                        label="探索文档绝对路径（服务端读取）"
                        rules={[{ required: true, message: '请填写探索文档路径' }]}
                      >
                        <Input placeholder={docPlaceholder(target?.variant === 'course' ? target.courseName : target?.domainName)} />
                      </Form.Item>
                      <Text type="secondary">
                        规范位置：<code>{'<数据根>'}/dataset/tmp/exploration/{'{对象名}'}探索.txt</code>
                        （路径校验失败将返回 400 提示）
                      </Text>
                    </>
                  ) : (
                    <Text type="secondary">不附加参考输入，由 LLM 按名称与既有体系自行检索。</Text>
                  )
                }
              </Form.Item>
            </Form>
          </>
        ) : matched.scope === 'course' ? (
          <CourseResultView />
        ) : (
          <CurriculumResultView />
        )}
      </ErrorBoundary>
    </Modal>
  );
}
