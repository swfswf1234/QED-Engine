// web-ui/src/api/explore-helpers.ts
/**
 * 探索接口辅助函数
 * - 封装探索领域知识、探索课程等接口调用
 */
import { useDownloadsStore } from '../stores/downloads';
import { describeError } from './client';

/**
 * 开始领域探索（生成领域知识）
 * - 未开始状态：调用接口后流转到已生成
 * - 待确认状态：调用接口后流转到探索中（重新探索）
 */
export async function startDomainExplore(_domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的生成领域知识接口
    // await api.post(`/domains/${_domainId}/explore`);
    
    // 模拟成功
    message.success('领域探索已开始');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认领域信息（生成课程知识）
 * - 已生成状态：调用接口后流转到探索中
 */
export async function confirmDomainInfo(_domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的生成课程知识接口
    // await api.post(`/domains/${_domainId}/confirm`);
    
    // 模拟成功
    message.success('领域信息已确认，开始生成课程知识');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 确认课程知识
 * - 待确认状态：调用接口后流转到已完成
 */
export async function confirmCourseKnowledge(_domainId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的课程知识确认接口
    // await api.post(`/domains/${_domainId}/knowledge-confirm`);
    
    // 模拟成功
    message.success('课程知识已确认');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}

/**
 * 开始课程探索（生成课程知识）
 * - 未开始状态：调用接口后流转到探索中
 */
export async function startCourseExplore(_courseId: string): Promise<void> {
  const { message } = await import('antd');
  try {
    // TODO: 调用实际的生成课程知识接口
    // await api.post(`/courses/${_courseId}/explore`);
    
    // 模拟成功
    message.success('课程探索已开始');
    
    // 刷新数据
    await useDownloadsStore.getState().fetchAll();
  } catch (err) {
    message.error(describeError(err));
  }
}
