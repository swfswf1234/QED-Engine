import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Console from './pages/Console';
import Dashboard from './pages/Dashboard';
import Downloads from './pages/Downloads';
import Parsing from './pages/Parsing';
import LlmCalls from './pages/LlmCalls';
import Knowledge from './pages/Knowledge';
import LearnShelf from './pages/LearnShelf';
import LearnWorkbench from './pages/LearnWorkbench';
import Practice from './pages/Practice';
import AdminLayout from './components/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * 全局路由（设计：frontend-react-refactor）
 * 当前路由面：主界面(#/)；学习中心·知识探索(#/knowledge，单页两级视图：课程层级视图以
 * `?course={course_id}` 查询参数深链，2026-10-11 REQ-110 起不再有独立课程页)、三栏学习工作台(#/learn/c/:courseId)、
 * 课后练习独立面(#/practice，课程级三区：今日面板/题源工作区/本课题卡)；管理台（#/admin 嵌套）：控制台(index) / 仪表盘(dashboard) / 文档下载管理(downloads) / 文档解析管理(parsing) / 模型调用记录(llm-calls)
 * 2026-08-18：原始文档对照(compare)路由删除，能力并入文档解析管理右侧（D7 裁决）
 * 2026-08-24（REQ-059）：课程探索确认页路由删除——探索改为文档下载管理内全弹窗流；
 *   根组件包 ErrorBoundary，渲染异常兜底不再白屏
 * 2026-09-30（M5 demo）：#/knowledge 由课程泡泡图原型升级为知识梳理星图，并下钻课程知识点页
 * 2026-10-03（M6）：三栏学习工作台 #/learn/c/:courseId（章节目录＋正文只读排版＋批注登记）
 * 2026-10-07（M1 裁决 D1/D4）：书架 #/learn（学习课程列表与创建入口），工作台内「阅读／链路」双模式
 * 2026-10-14（REQ-106）：课后练习独立面 #/practice（三界面拆分第三批：知识探索／课程学习／课后练习各一面）
 */
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/learn" element={<LearnShelf />} />
          <Route path="/learn/c/:courseId" element={<LearnWorkbench />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Console />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="parsing" element={<Parsing />} />
            <Route path="llm-calls" element={<LlmCalls />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
