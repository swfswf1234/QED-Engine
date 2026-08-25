/**
 * 渲染异常兜底（2026-08-24 REQ-059 交互改版引入）
 * - 背景：探索确认页白屏排查发现 web-ui 无任何 ErrorBoundary，子组件渲染抛错即整页白屏
 * - 双层使用：App 根组件包一层（整页兜底）+ ExploreFlowModal 内容包一层（弹窗内兜底，
 *   关闭弹窗即可恢复页面交互）
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 控制台保留堆栈供排查（生产无日志后端，先本地留痕）
    console.error('[ErrorBoundary] 渲染异常:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="界面渲染异常"
          subTitle={this.state.error.message}
          extra={
            <Button type="primary" onClick={() => this.setState({ error: null })}>
              重试渲染
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
