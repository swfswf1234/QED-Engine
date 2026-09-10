// web-ui/src/api/explore-helpers.ts
/**
 * 探索接口辅助函数（PLAN-033 §2.3 操作×状态×接口统一表）
 * - 领域链路走五态门面端点（8901 原生任务链，前端不管理 session/task_id）
 * - 课程探索走 explore-sessions 会话通道
 */
import { useDownloadsStore } from '../stores/downloads';
import { describeError } from './client';
import {
  confirmDomainInfo as confirmDomainInfoApi,
  confirmCourseKnowledge as confirmCourseKnowledgeApi,
  exploreDomainKnowledge,
  exploreCourseKnowledge,
} from './tracker';

/**
 * 开始领域探索（提交领域探索任务）
 * - 未开始/失败/已生成：提交任务后流转到探索中，成功后由上游写已生成
 */
export async function startDomainExplore(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    await exploreDomainKnowledge(domainId, { mode: 'direct' });
    message.success('领域探索任务已提交');
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认领域信息（生成课程知识）
 * - 已生成状态：确认后流转到探索中（8901 异步课程探索任务）
 * - 名称确认挂起：携带修正后的领域名重提探索任务
 */
export async function confirmDomainInfo(domainId: string, nameOverride?: string): Promise<void> {
  const { message } = await import('antd');
  try {
    const result = await confirmDomainInfoApi(domainId, nameOverride ? { name: nameOverride } : {});
    if (result.degraded) {
      message.warning('8901 不可达：状态已推进，课程生成任务未提交');
    } else {
      message.success(result.message);
    }
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认课程知识（待确认→已完成）
 * - selected 为选中课程（course_id 或名称）键清单；缺省全部保留
 */
export async function confirmCourseKnowledge(domainId: string, selected?: string[]): Promise<void> {
  const { message } = await import('antd');
  try {
    const result = await confirmCourseKnowledgeApi(domainId, selected);
    message.success(result.message);
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 开始课程探索（生成课程知识）
 * - 未开始状态：创建课程探索会话后流转到探索中
 */
export async function startCourseExplore(courseId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    const result = await exploreCourseKnowledge(courseId);
    message.success(result.message);
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}
