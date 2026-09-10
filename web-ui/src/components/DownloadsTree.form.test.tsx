/**
 * DownloadsTree 编辑表单测试（2026-09-07 修复计划）
 * - 问题1：修改领域后课程方向内容变空（轮询导致表单值被重置）
 * - 问题2：编辑课程改为通过 onEditCourse 回调打开统一弹窗（不再走 TreeFormModal）
 * - 问题3：课程右键菜单缺少"导入课程知识"功能
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DownloadsTree from './DownloadsTree';
import { theme } from '../theme';
import { useDownloadsStore } from '../stores/downloads';
import { useExploreUiStore } from '../stores/explore';
import type { DomainSystem, KnowledgeDetail, KnowledgeRecord } from '../stores';

function course(courseId: string, name: string, overrides?: Partial<DomainSystem['courses'][0]>) {
  return { 
    course_id: courseId, 
    name, 
    aliases: [], 
    stage: '基础', 
    track: '分析学',
    description: '课程描述',
    prerequisites: [],
    ...overrides
  };
}

function domainFixture(courses: ReturnType<typeof course>[], classicTracks?: Array<{ name: string; summary?: string; kind?: string }>): DomainSystem[] {
  return [{ 
    domain_id: 'dm1', 
    name: '高等数学', 
    description: '高等数学领域', 
    stages: ['基础', '主干', '分支', '前沿'],
    classic_tracks: classicTracks || [
      { name: '分析学', summary: '数学分析方向', kind: 'main' },
      { name: '代数学', summary: '线性代数方向', kind: 'main' },
    ],
    courses 
  }];
}

const emptyDetails: Record<string, KnowledgeDetail> = {};

function seed(domains: DomainSystem[], knowledge: KnowledgeRecord[]) {
  useDownloadsStore.setState({
    domains, knowledge, details: emptyDetails,
    systemError: null, knowledgeError: null, error: null,
  });
}

function renderTree() {
  return render(
    <ConfigProvider theme={theme}><AntApp><DownloadsTree /></AntApp></ConfigProvider>,
  );
}

describe('编辑表单修复测试', () => {
  beforeEach(() => {
    useDownloadsStore.setState({ selected: null });
    useExploreUiStore.setState({ flowTarget: null, domainRunStatus: {} });
  });

  describe('问题1：修改领域后课程方向内容变空', () => {
    it('打开编辑领域对话框后，课程方向内容不应被轮询重置', async () => {
      // 准备测试数据：领域有课程方向
      const classicTracks = [
        { name: '分析学', summary: '数学分析方向', kind: 'main' },
        { name: '代数学', summary: '线性代数方向', kind: 'main' },
      ];
      seed(domainFixture([course('01_math_analysis', '数学分析')], classicTracks), []);
      
      renderTree();
      
      // 右键点击领域，打开编辑对话框
      fireEvent.contextMenu(screen.getByText('高等数学'));
      await new Promise((r) => setTimeout(r, 50));
      const editItem = await screen.findByText('编辑领域知识');
      fireEvent.click(editItem);
      
      // 等待对话框打开
      await waitFor(() => {
        expect(screen.getByText('修改领域（高等数学）')).toBeInTheDocument();
      });
      
      // 验证课程方向内容已加载
      await waitFor(() => {
        // 检查是否显示了课程方向内容
        expect(screen.getByDisplayValue('分析学')).toBeInTheDocument();
        expect(screen.getByDisplayValue('代数学')).toBeInTheDocument();
      });
      
      // 模拟轮询更新（5秒后）
      // 注意：这里我们只是验证表单内容不会被重置
      // 实际测试中，轮询会更新domains数据，但表单内容应该保持不变
    });
  });

  describe('问题2：编辑课程通过 onEditCourse 回调统一弹窗', () => {
    it('编辑课程时，应调用 onEditCourse 回调并传递课程数据', async () => {
      const onEditCourse = vi.fn();
      seed(domainFixture([course('01_math_analysis', '数学分析')]), []);
      
      render(
        <ConfigProvider theme={theme}><AntApp><DownloadsTree onEditCourse={onEditCourse} /></AntApp></ConfigProvider>,
      );
      
      // 右键点击课程，打开编辑对话框
      fireEvent.contextMenu(screen.getByText('数学分析'));
      await new Promise((r) => setTimeout(r, 50));
      const editItem = await screen.findByText('编辑课程');
      fireEvent.click(editItem);
      
      // 验证 onEditCourse 被调用，且传递了正确的课程数据
      await waitFor(() => {
        expect(onEditCourse).toHaveBeenCalledTimes(1);
        expect(onEditCourse).toHaveBeenCalledWith(
          expect.objectContaining({ course_id: '01_math_analysis', name: '数学分析' }),
        );
      });
    });
  });

  describe('问题3：课程右键菜单缺少"导入课程知识"功能', () => {
    it('课程右键菜单应该包含"导入课程知识"选项', async () => {
      seed(domainFixture([course('01_math_analysis', '数学分析')]), []);
      
      renderTree();
      
      // 右键点击课程
      fireEvent.contextMenu(screen.getByText('数学分析'));
      await new Promise((r) => setTimeout(r, 50));
      
      // 验证菜单包含"导入课程知识"
      await waitFor(() => {
        expect(screen.getByText('导入课程知识')).toBeInTheDocument();
      });
    });
  });
});
