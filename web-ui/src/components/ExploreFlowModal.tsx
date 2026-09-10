/**
 * 探索全弹窗流（PLAN-022 F3 会话模型适配，2026-08-28；旧 adopt/apply 契约已废弃）
 * - 发起（备注 + 指定文本路径，两项均可空；mode 由字段自动判定）
 *   → 轮询进度（3s，store 驱动）→ 会话状态机：
 *   waiting_name_confirm = 名称确认视图（保留原名/采纳建议名）
 *   ready = 结果清单：课程层 = 教程推荐卡勾选 + 采纳；领域层 = 课程清单勾选 + 应用所选
 *   failed = 错误 + 重试
 * - 关闭弹窗不打断后台轮询：同目标再次打开且会话仍在/已就绪时直接进结果视图；
 *   刷新后经 localStorage 恢复（ensurePolling 续轮询）
 * - 领域层按钮状态机经 useExploreUiStore.domainRunStatus 同步右面板（仅 running 临时态）
 * - 内容级 ErrorBoundary：弹窗内渲染异常不拖垮整页
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Badge, Button, Checkbox, Form, Input, Modal, Radio, Space, Spin, Tag, Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ProposalCard from './ProposalCard';
import ErrorBoundary from './ErrorBoundary';
import { describeError } from '../api/client';
import { useDownloadsStore } from '../stores/downloads';
import {
  asCourseTutorials, asDomainReport, isExploreMockEnabled,
  remainingSlots, useExploreStore, useExploreUiStore,
} from '../stores/explore';
import type { ExploreFlowTarget, ExploreParams } from '../stores/explore';
import { showExploreSlots } from '../stores/uiFlags';
import type { DomainExploreCourse, ExploreProposal, ExploreSessionRecord } from '../stores';

const { Text } = Typography;

/** 当前会话是否属于目标对象（决定弹窗直接进结果视图还是先展示发起表单） */
function sessionMatchesTarget(
  session: ExploreSessionRecord | null,
  target: ExploreFlowTarget | null,
): boolean {
  if (!session || !target) return false;
  if (target.variant === 'course') {
    return session.target === 'course' && session.course_id === target.courseId;
  }
  return session.target === 'domain' && session.domain_name === target.domainName;
}

// --- 名称确认视图（领域管线 P12：waiting_name_confirm） ---

function NameConfirmView() {
  const session = useExploreStore((s) => s.session);
  const confirmName = useExploreStore((s) => s.confirmName);
  const [name, setName] = useState('');
  if (!session?.name_check) return null;
  const suggested = session.name_check.suggested_name || session.domain_name;
  return (
    <div className="explore-name-confirm">
      <Alert
        type="warning" showIcon style={{ marginBottom: 12 }}
        message="领域名称需要确认"
        description={
          <Space direction="vertical">
            <span>{session.name_check.reason || 'LLM 认为该名称不适合直接作为领域名称'}</span>
            {session.name_check.suggested_name && (
              <span>建议名称：<Text strong>{session.name_check.suggested_name}</Text></span>
            )}
          </Space>
        }
      />
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={name || suggested}
          onChange={(e) => setName(e.target.value)}
          placeholder="确认后的领域名称"
        />
        <Button
          type="primary"
          onClick={() => void confirmName(name.trim() || suggested)}
        >
          以该名称继续探索
        </Button>
      </Space.Compact>
    </div>
  );
}

// --- 课程层结果视图（教程推荐卡勾选 + 采纳） ---

function CourseResultView() {
  const session = useExploreStore((s) => s.session);
  const applied = useExploreStore((s) => s.applied);
  const applyResult = useExploreStore((s) => s.applyResult);
  const error = useExploreStore((s) => s.error);
  const apply = useExploreStore((s) => s.apply);
  const discard = useExploreStore((s) => s.discard);
  const startCourse = useExploreStore((s) => s.startCourse);
  const knowledge = useDownloadsStore((s) => s.knowledge);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const { message } = App.useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!session) return null;

  const courseId = session.course_id;
  const existingCount = knowledge.filter((k) => k.course_id === courseId).length;
  const slots = remainingSlots(existingCount);
  const tutorials: ExploreProposal[] = asCourseTutorials(session);

  const toggle = (id: string, on: boolean) => {
    setSelectedIds((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const relaunch = () => {
    setSelectedIds([]);
    void startCourse(courseId, { mode: session.mode }).then(() => {
      const err = useExploreStore.getState().error;
      if (err) message.error(err);
    });
  };

  return (
    <div className="explore-course-view">
      <div className="explore-statusbar">
        {session.status === 'running' && (
          <Space>
            <Spin size="small" />
            <Text strong>LLM 检索中…</Text>
            <Text type="secondary">会话 {session.session_id} · 每 3 秒轮询</Text>
          </Space>
        )}
        {session.status === 'ready' && !applied && (
          <Space wrap>
            <Badge status="processing" />
            <Text strong>本次推荐（{tutorials.length} 套）</Text>
            {showExploreSlots() && (
              <Text type="secondary">上限余量 {slots} · 已勾选 {selectedIds.length}/{slots}</Text>
            )}
          </Space>
        )}
        {session.status === 'ready' && applied && (
          <Space wrap>
            <Tag color="green">已采纳</Tag>
            <Text type="secondary">
              新增教程：{applyResult?.applied.map((a) => a.set_name ?? a.name ?? '').filter(Boolean).join('、')}
              （文档下载管理中为草稿，可继续组织书籍下载）
            </Text>
          </Space>
        )}
        {session.status === 'failed' && <Tag color="red">探索失败</Tag>}
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

      {session.status === 'ready' && !applied && (
        <>
          <div className="explore-proposals">
            {tutorials.map((p) => (
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
                const selected = tutorials.filter((p) => selectedIds.includes(p.proposal_id));
                void apply(selected).then((result) => {
                  if (result) {
                    message.success(`已采纳 ${result.applied.length} 套，草稿教程已生成`);
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

      {session.status === 'failed' && (
        <div className="explore-terminal">
          <Button icon={<ReloadOutlined />} onClick={relaunch}>重试</Button>
        </div>
      )}
      {/* 关闭入口由弹窗 footer 提供，此处不再放返回按钮 */}
    </div>
  );
}

// --- 领域层结果视图（课程清单勾选 + 应用所选 + 路径图） ---

function CurriculumResultView() {
  const session = useExploreStore((s) => s.session);
  const applied = useExploreStore((s) => s.applied);
  const applyResult = useExploreStore((s) => s.applyResult);
  const error = useExploreStore((s) => s.error);
  const apply = useExploreStore((s) => s.apply);
  const fetchAll = useDownloadsStore((s) => s.fetchAll);
  const { message } = App.useApp();
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  const report = useMemo(() => asDomainReport(session), [session]);
  const courses: DomainExploreCourse[] = report?.courses ?? [];

  if (!session || !report) return null;

  const toggle = (name: string, on: boolean) => {
    setSelectedNames((prev) => (on ? [...new Set([...prev, name])] : prev.filter((x) => x !== name)));
  };

  return (
    <div className="explore-curriculum-view">
      <div className="explore-statusbar">
        {session.status === 'running' && (
          <Space><Spin size="small" /><Text strong>课程体系探索中…</Text></Space>
        )}
        {session.status === 'ready' && !applied && (
          <Text strong>提议课程（{courses.length} 门）· 仅勾选取舍，应用后写入领域与课程表</Text>
        )}
        {session.status === 'ready' && applied && (
          <Space wrap>
            <Tag color={applyResult && applyResult.conflicts.length > 0 ? 'orange' : 'green'}>
              应用完成
            </Tag>
            <Text type="secondary">已写入 qed_domain / qed_course；左树将自动刷新</Text>
          </Space>
        )}
        {session.status === 'failed' && <Tag color="red">探索失败</Tag>}
      </div>

      {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}

      {/* 空提议显式提示 */}
      {session.status === 'ready' && !applied && courses.length === 0 && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="LLM 未给出任何提议"
          description="可关闭后重探；建议填写「备注」或「指定文本路径」提供更多上下文后再试。"
        />
      )}

      {applied && applyResult && applyResult.conflicts.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="部分变更被拒绝（冲突标记，未静默覆盖）"
          description={applyResult.conflicts.map((c, i) => <div key={i}>{c.name}: {c.reason}</div>)}
        />
      )}

      {session.status === 'ready' && !applied && (
        <>
          <div className="explore-domain-info" style={{ marginBottom: 12 }}>
            <Text strong>{report.domain.final_name}</Text>
            {report.domain.description && (
              <Text type="secondary"> · {report.domain.description}</Text>
            )}
          </div>
          <div className="explore-changes">
            {courses.map((c) => (
              <div key={c.slug} className="explore-course-row" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Checkbox
                  checked={selectedNames.includes(c.name)}
                  onChange={(e) => toggle(c.name, e.target.checked)}
                >
                  <Text strong>{c.name}</Text>
                  {c.track && <Tag style={{ marginLeft: 8 }}>{c.track}</Tag>}
                  {typeof c.tier === 'number' && <Tag>第 {c.tier} 阶段</Tag>}
                </Checkbox>
                {c.summary && (
                  <div style={{ marginLeft: 24 }}>
                    <Text type="secondary">{c.summary}</Text>
                  </div>
                )}
              </div>
            ))}
          </div>
          {report.path?.graph_td && (
            <details style={{ marginTop: 12 }}>
              <summary><Text type="secondary">学习路径图（Mermaid）</Text></summary>
              <pre style={{ fontSize: 12, background: '#fafafa', padding: 8 }}>{report.path.graph_td}</pre>
            </details>
          )}
          <div className="explore-actions">
            <Checkbox
              checked={selectedNames.length === courses.length && courses.length > 0}
              indeterminate={selectedNames.length > 0 && selectedNames.length < courses.length}
              onChange={(e) => setSelectedNames(e.target.checked ? courses.map((c) => c.name) : [])}
            >
              全选
            </Checkbox>
            <Button
              type="primary"
              disabled={selectedNames.length === 0}
              onClick={() => {
                const selected = courses.filter((c) => selectedNames.includes(c.name));
                void apply(selected).then((result) => {
                  if (result) {
                    const parts = [`已应用 ${result.applied.length} 项`];
                    if (result.conflicts.length > 0) parts.push(`冲突 ${result.conflicts.length} 项`);
                    message.success(`${parts.join('，')}变更`);
                    if (!isExploreMockEnabled()) void fetchAll();
                  }
                });
              }}
            >
              应用所选变更({selectedNames.length})
            </Button>
          </div>
        </>
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
  const session = useExploreStore((s) => s.session);
  const launching = useExploreStore((s) => s.launching);
  const startCourse = useExploreStore((s) => s.startCourse);
  const startCurriculum = useExploreStore((s) => s.startCurriculum);
  const setDomainRunStatus = useExploreUiStore((s) => s.setDomainRunStatus);

  /** 已有匹配目标的会话 → 直接展示结果视图（关闭再开/后台完成后回看不丢上下文） */
  const matched = useMemo(() => (sessionMatchesTarget(session, target) ? session : null), [session, target]);
  const variant: 'course' | 'domain' | 'curriculum' = target?.variant ?? 'course';
  /** 'domain' 与 'curriculum' 均为领域层探索，行为一致 */
  const isDomainLike = variant === 'curriculum' || variant === 'domain';

  // 领域层按钮状态机同步：domainRunStatus 只跟踪 running 临时态
  // pending/completed 由 DomainInfoCard 从 exploration_stage 实时计算（F4）
  useEffect(() => {
    if (!target || target.variant !== 'curriculum') return;
    if (matched && matched.status === 'running') {
      setDomainRunStatus(target.domainId, 'running');
    } else {
      setDomainRunStatus(target.domainId, null);
    }
  }, [matched, target, setDomainRunStatus]);

  useEffect(() => {
    if (target) form.resetFields();
  }, [target, form]);

  // 持久化恢复的未终态会话：弹窗打开即续轮询（刷新恢复链路）
  useEffect(() => {
    if (!target) return;
    useExploreStore.getState().ensurePolling();
  }, [target]);

  // 弹窗打开时主动查一次后端状态：清理已被后端超时淘汰的残留会话（Fix 2 防御）
  useEffect(() => {
    if (!target) return;
    const { session } = useExploreStore.getState();
    if (session && (session.status === 'waiting_name_confirm' || session.status === 'running')) {
      // 主动 fetch 一次：若后端已清理（404），refresh 的自愈会清 localStorage
      void useExploreStore.getState().refresh();
    }
  }, [target]);

  const onStart = async (values: { mode?: ExploreParams['mode']; ref_text?: string; ref_doc_path?: string }) => {
    // 课程体系层：Radio 定 mode（direct=直接开始+备注；doc=基于文本）+ 字段条件传递
    // 课程层：按填写字段自动判定
    const mode: ExploreParams['mode'] = isDomainLike
      ? (values.mode === 'doc' ? 'doc' : values.ref_text ? 'text' : 'direct')
      : values.ref_doc_path ? 'doc' : values.ref_text ? 'text' : 'direct';
    const params: ExploreParams = {
      mode,
      ...(mode !== 'direct' ? (mode === 'doc' ? { ref_doc_path: values.ref_doc_path } : { ref_text: values.ref_text }) : {}),
    };
    try {
      if (target && target.variant !== 'course') {
        await startCurriculum(target.domainName, params, target.domainId);
      } else if (target?.variant === 'course') {
        await startCourse(target.courseId, params);
      }
      const err = useExploreStore.getState().error;
      if (err) {
        message.error(err);
        return;
      }
      if (target && target.variant !== 'course') {
        setDomainRunStatus(target.domainId, 'running');
      }
      // 点击即后台：发起成功立刻关闭弹窗，完成由右上角通知提示
      onClose();
    } catch (err) {
      message.error(describeError(err));
    }
  };

  const title =
    variant === 'course'
      ? `探索教程 · ${target?.variant === 'course' ? target.courseName ?? target.courseId : ''}`
      : `课程体系探索 · ${(target?.variant === 'curriculum' || target?.variant === 'domain') ? target.domainName : ''}`;

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
        {/* 防混淆：mock 开关残留时显式告警（此前曾致「探索无响应」误判） */}
        {isExploreMockEnabled() && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 12 }}
            message="探索 Mock 模式已开启（localStorage qed-explore-mock=1）"
            description="当前请求走本地模拟后端，不会访问真实服务；请在控制台执行 localStorage.removeItem('qed-explore-mock') 后刷新页面以切回真实链路。"
          />
        )}
        {!matched ? (
          <>
            {isDomainLike && (
              <Text type="secondary">
                基于默认配置探索课程体系，填写备注可定制探索方向。
              </Text>
            )}
            {isDomainLike ? (
              <Form
                form={form}
                layout="vertical"
                initialValues={{ mode: 'direct' }}
                style={{ marginTop: 12 }}
              >
                <Form.Item name="mode" label="发起方式">
                  <Radio.Group>
                    <Radio value="direct">直接开始探索</Radio>
                    <Radio value="doc">导入探索结果</Radio>
                  </Radio.Group>
                </Form.Item>
                <Form.Item shouldUpdate={(prev, cur) => prev.mode !== cur.mode} noStyle>
                  {({ getFieldValue }) =>
                    getFieldValue('mode') === 'doc' ? (
                      <>
                        <Form.Item
                          name="ref_doc_path"
                          label="探索结果文件位置"
                          rules={[{ required: true, message: '请填写探索结果文件路径' }]}
                        >
                          <Input />
                        </Form.Item>
                        <Text type="secondary">
                          指定已有的探索结果文件，导入后可直接应用
                        </Text>
                      </>
                    ) : (
                      <Form.Item name="ref_text" label="备注（可选）">
                        <Input.TextArea
                          rows={3}
                          placeholder="探索方向、选课范围、偏好等备注信息（留空使用默认配置）"
                        />
                      </Form.Item>
                    )
                  }
                </Form.Item>
              </Form>
            ) : (
              <Form form={form} layout="vertical" style={{ marginTop: 0 }}>
                <Form.Item name="ref_text" label="备注（可选）">
                  <Input.TextArea rows={3} placeholder="课程探索方向、选书偏好等备注信息" />
                </Form.Item>
                <Form.Item name="ref_doc_path" label="指定文本路径（可选）">
                  <Input placeholder={docPlaceholder(target?.variant === 'course' ? target.courseName : target?.domainName)} />
                </Form.Item>
                <Text type="secondary" style={{ display: 'block', marginTop: -8 }}>
                  路径规范：<code>{'<数据根>'}/dataset/tmp/exploration/{'{对象名}'}探索.txt</code>；两项均可空。
                </Text>
              </Form>
            )}
          </>
        ) : matched.target === 'domain' && matched.status === 'waiting_name_confirm' ? (
          <NameConfirmView />
        ) : matched.target === 'course' ? (
          <CourseResultView />
        ) : (
          <CurriculumResultView />
        )}
      </ErrorBoundary>
    </Modal>
  );
}
