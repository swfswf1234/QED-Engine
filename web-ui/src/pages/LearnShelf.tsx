/**
 * 学习中心 · 书架清单（`#/learn`，REQ-117 W8 重设计）
 * - 清单＝服务端同步结果：`POST /api/v1/learn/courses/sync`（解析好即物化，未解析者 PASS），
 *   界面不再新建学习课程；页头「刷新」即重新同步
 * - 课程行标题＝共享表正式名称（`qed_course.name`，目录不可达时服务端回落 course_id）
 * - 教材＝课程下横排小卡片：学习进度（derived.books 教材级）+ 简介 + 面向对象档位（入门/深入…）
 * - 忽略＝教材级 `dismissed`（resources JSON 键，零 DDL），卡片收起后可在「已忽略」区按回来
 * - 领域框在标题行右侧，默认第一个领域（REQ-117 C13）；页头三按钮＝使用手册 / 刷新 / 返回
 * - 数据一律经 8900（ADR 0007）；8900 不可达降级空态、解析侧不可达只列既有课程，均不白屏
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Progress, Row, Select, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  LeftOutlined, QuestionCircleOutlined, ReloadOutlined, UndoOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import HelpModal from '../components/HelpModal';
import { describeError } from '../api/client';
import {
  listLearnCourses, patchLearnCourse, syncLearnCourses,
  type CourseResource, type LearnBookProgress, type LearnCourse, type SyncBookMeta,
} from '../api/learn';
import { getStarMap, type StarMapDomain } from '../api/learn';

const { Title, Text } = Typography;

/** 蓝底顶栏上的白字按钮（与知识探索面同一套页头动作样式） */
const headerButtonStyle = { color: '#ffffff', borderColor: '#ffffff', background: 'transparent' };

/** 学习阶段层级（与知识探索面「层＝行」同一套 stage 词） */
const STAGE_ORDER = ['基础', '主干', '分支', '前沿'];

const stageRank = (stage: string) => {
  const index = STAGE_ORDER.indexOf(stage);
  return index < 0 ? STAGE_ORDER.length : index;
};
const mainTrackFirst = (kind: string) => (kind === 'main' ? 0 : 1);

/** 领域过滤的「全部」哨兵（默认值不是它——进场落在第一个领域） */
export const ALL_DOMAINS = '__all__';

/** 课程态徽章：词本身承载口径（draft 再按知识点序列是否已备好细分；不出现「链路」「编译」字样） */
export function statusBadge(course: LearnCourse): { label: string; color: string } {
  const status = course.derived.status;
  if (status === 'completed') return { label: '已结课', color: 'success' };
  if (status === 'learning') return { label: `学习进度 ${course.derived.percent}%`, color: 'blue' };
  return (course.unit_count ?? 0) === 0
    ? { label: '知识点未就绪', color: 'default' }
    : { label: '未开始', color: 'warning' };
}

/** 课程行标题＝共享表正式名称（名称只在 qed_course，服务端投影补齐） */
export function courseDisplayName(course: LearnCourse): string {
  return course.name;
}

/** 教材卡列表：按 resources 声明序，忽略位分列（dismissed 只进「已忽略」区） */
export function splitBooks(course: LearnCourse): { shown: CourseResource[]; dismissed: CourseResource[] } {
  const books = course.resources.filter((resource) => resource.kind === 'book');
  return {
    shown: books.filter((resource) => !resource.dismissed),
    dismissed: books.filter((resource) => resource.dismissed),
  };
}

/** 整列提交 resources 时的忽略位翻转（其余元素原样保留，含非 book 素材） */
export function toggleDismissed(
  resources: CourseResource[],
  refId: string,
  dismissed: boolean,
): CourseResource[] {
  return resources.map((resource) => (
    resource.ref_id === refId ? { ...resource, dismissed } : resource
  ));
}

/**
 * 清单竖排顺序＝领域顺序 → stage 层级 → 主轨在前 → sort_order（与星图同一套坐标，不重排）。
 * 星图取不到坐标的课程排在所属领域末尾，按课程名稳定序。
 */
export function shelfOrder(domains: StarMapDomain[], courses: LearnCourse[]): LearnCourse[] {
  const domainIndex = new Map(domains.map((domain, index) => [domain.domain_id, index]));
  const rank = new Map<string, number>();
  const flat = domains.flatMap((domain) => domain.tracks.flatMap((track) => track.courses.map(
    (course) => ({ domainId: domain.domain_id, kind: track.kind, courseId: course.course_id, stage: course.stage, sortOrder: course.sort_order }),
  )));
  flat
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage)
      || mainTrackFirst(a.kind) - mainTrackFirst(b.kind)
      || (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
    .forEach((course, index) => rank.set(`${course.domainId}::${course.courseId}`, index));

  const keyOf = (course: LearnCourse) => {
    const domainId = course.domain_id;
    return {
      domain: domainIndex.get(domainId) ?? domainIndex.size,
      order: rank.get(`${domainId}::${course.learn_course_id}`) ?? Number.MAX_SAFE_INTEGER,
    };
  };
  return [...courses].sort((a, b) => {
    const left = keyOf(a);
    const right = keyOf(b);
    return left.domain - right.domain || left.order - right.order || a.name.localeCompare(b.name);
  });
}

export default function LearnShelf() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<LearnCourse[]>([]);
  const [domains, setDomains] = useState<StarMapDomain[]>([]);
  const [meta, setMeta] = useState<Record<string, SyncBookMeta>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const activeDomain = domain ?? domains[0]?.domain_id ?? ALL_DOMAINS;

  /** 进场与「刷新」＝同步后列清单：同步是写操作，失败（解析侧离线）回落只读既有课程 */
  const reload = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setSyncNote(null);
    try {
      const [result, star] = await Promise.all([syncLearnCourses(), getStarMap()]);
      setCourses(result.courses);
      setDomains(star.domains);
      setMeta(Object.fromEntries(result.books.map((book) => [book.ref_id, book])));
    } catch (err) {
      // 同步或星图任一失败：清单仍可展示，改为只读既有课程（独立性铁律：降级不白屏）
      setSyncNote(describeError(err));
      try {
        const courseList = await listLearnCourses();
        setCourses(courseList.courses);
      } catch (innerErr) {
        setError(describeError(innerErr));
      }
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ordered = useMemo(() => shelfOrder(domains, courses), [domains, courses]);
  const visible = useMemo(
    () => (activeDomain === ALL_DOMAINS
      ? ordered
      : ordered.filter((course) => course.domain_id === activeDomain || !course.domain_id)),
    [ordered, activeDomain],
  );
  const bookProgress = (course: LearnCourse, refId: string): LearnBookProgress | undefined =>
    course.derived.books.find((book) => book.ref_id === refId);

  const openWorkbench = (course: LearnCourse, refId: string) => {
    navigate(`/learn/c/${course.learn_course_id}?book=${refId}`);
  };

  const dismiss = async (course: LearnCourse, refId: string, dismissed: boolean) => {
    try {
      const updated = await patchLearnCourse(
        course.learn_course_id,
        { resources: toggleDismissed(course.resources, refId, dismissed) },
      );
      setCourses((prev) => prev.map((item) => (
        item.learn_course_id === updated.learn_course_id ? updated : item
      )));
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <AppHeader
        actions={
          <Space>
            <Button icon={<QuestionCircleOutlined />} style={headerButtonStyle} onClick={() => setHelpOpen(true)}>
              使用手册
            </Button>
            <Button icon={<ReloadOutlined />} style={headerButtonStyle} loading={syncing} onClick={() => void reload()}>
              刷新
            </Button>
            <Button icon={<LeftOutlined />} style={headerButtonStyle} onClick={() => navigate('/')}>
              返回
            </Button>
          </Space>
        }
      />
      <div style={{ padding: '16px 24px', maxWidth: 1280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Title level={4} style={{ margin: 0 }}>学习中心·书架清单</Title>
          <Space size={8}>
            <Text type="secondary">领域</Text>
            <Select
              aria-label="领域"
              value={activeDomain}
              onChange={(value: string) => setDomain(value)}
              style={{ width: 200 }}
              options={[
                ...domains.map((item) => ({ value: item.domain_id, label: item.name })),
                { value: ALL_DOMAINS, label: '全部领域' },
              ]}
            />
          </Space>
        </div>
        <Text type="secondary">
          书架清单按领域列出您的课程与教材：每本显示学到哪儿，可进入学习，也可先忽略。
        </Text>

        {error && (
          <Alert
            style={{ margin: '12px 0' }}
            type="warning"
            showIcon
            message="清单暂时打不开"
            description={`暂未能读取您的书架（${error}）。其他界面不受影响，可稍后点「重试」。`}
            action={<Button size="small" onClick={() => void reload()}>重试</Button>}
          />
        )}
        {!error && syncNote && (
          <Alert
            style={{ margin: '12px 0' }}
            type="info"
            showIcon
            message="暂时读不到新准备的教材"
            description={`已按现有清单列出（${syncNote}）。稍后点「刷新」会自动补齐。`}
          />
        )}

        {loading && <Spin style={{ display: 'block', margin: '24px auto' }} />}
        {!loading && !error && visible.length === 0 && (
          <Empty
            style={{ marginTop: 32 }}
            description={courses.length === 0
              ? '书架还是空的：教材准备好后点右上「刷新」就会自动列出来'
              : '该领域下还没有可读的教材'}
          >
            {courses.length > 0 && (
              <Button onClick={() => setDomain(ALL_DOMAINS)}>看全部领域</Button>
            )}
          </Empty>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          {!loading && visible.map((course) => {
            const badge = statusBadge(course);
            const { shown, dismissed } = splitBooks(course);
            return (
              <section key={course.learn_course_id}>
                <Space size={8} align="center" style={{ marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>{courseDisplayName(course)}</Title>
                  <Tag color={badge.color}>{badge.label}</Tag>
                </Space>
                {shown.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    该课程下的教材都已忽略，可在下方「已忽略」区按回来。
                  </Text>
                ) : (
                  <Row gutter={[12, 12]}>
                    {shown.map((resource) => {
                      const progress = bookProgress(course, resource.ref_id);
                      const info = meta[resource.ref_id];
                      return (
                        <Col key={resource.ref_id} xs={24} sm={12} lg={8} xxl={6}>
                          <Card
                            size="small"
                            title={resource.label}
                            data-testid={`shelf-book-${resource.ref_id}`}
                            extra={info?.position_label
                              ? <Tag color="geekblue">{info.position_label}</Tag>
                              : <Tag>未标面向对象</Tag>}
                          >
                            <Space direction="vertical" size={6} style={{ width: '100%' }}>
                              <Tooltip title={info?.intro || '暂无简介'}>
                                <div style={{ minHeight: 40 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {info?.intro
                                      ? `${info.intro.slice(0, 60)}${info.intro.length > 60 ? '…' : ''}`
                                      : '暂无简介'}
                                  </Text>
                                </div>
                              </Tooltip>
                              <Progress
                                percent={progress?.percent ?? 0}
                                size="small"
                                format={() => `${progress?.done ?? 0}/${progress?.total ?? 0} 条`}
                              />
                              <Space size={6}>
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => openWorkbench(course, resource.ref_id)}
                                >
                                  进入学习
                                </Button>
                                <Button
                                  size="small"
                                  icon={<EyeInvisibleOutlined />}
                                  onClick={() => void dismiss(course, resource.ref_id, true)}
                                >
                                  忽略
                                </Button>
                              </Space>
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                )}
                {dismissed.length > 0 && (
                  <Space size={6} wrap style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>已忽略：</Text>
                    {dismissed.map((resource) => (
                      <Button
                        key={resource.ref_id}
                        size="small"
                        icon={<UndoOutlined />}
                        onClick={() => void dismiss(course, resource.ref_id, false)}
                      >
                        {resource.label}
                      </Button>
                    ))}
                  </Space>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} page="course" />
    </div>
  );
}
