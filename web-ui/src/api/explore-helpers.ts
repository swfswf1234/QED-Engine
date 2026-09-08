// web-ui/src/api/explore-helpers.ts
/**
 * 探索接口辅助函数
 * - 封装探索领域知识、探索课程等接口调用
 */
import { useDownloadsStore } from '../stores/downloads';
import { describeError } from './client';
import {
  exploreDomainKnowledge,
  confirmDomainInfo as confirmDomainInfoApi,
  confirmCourseKnowledge as confirmCourseKnowledgeApi,
  exploreCourseKnowledge,
} from './tracker';

/**
 * 开始领域探索（生成领域知识）
 * - 未开始状态：调用接口后流转到已生成
 * - 待确认状态：调用接口后流转到探索中（重新探索）
 */
export async function startDomainExplore(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    const result = await exploreDomainKnowledge(domainId);
    message.success(result.message);
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认领域信息（生成课程知识）
 * - 已生成状态：调用接口后流转到探索中
 */
export async function confirmDomainInfo(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    const result = await confirmDomainInfoApi(domainId);
    message.success(result.message);
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认课程知识
 * - 待确认状态：调用接口后流转到已完成
 */
export async function confirmCourseKnowledge(domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 需要获取 session_id
    const result = await confirmCourseKnowledgeApi(domainId, 'current-session-id');
    message.success(result.message);
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 开始课程探索（生成课程知识）
 * - 未开始状态：调用接口后流转到探索中
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
