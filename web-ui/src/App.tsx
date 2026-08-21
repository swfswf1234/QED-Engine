import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Console from './pages/Console';
import Dashboard from './pages/Dashboard';
import Downloads from './pages/Downloads';
import Parsing from './pages/Parsing';
import LlmCalls from './pages/LlmCalls';
import Knowledge from './pages/Knowledge';
import AdminLayout from './components/AdminLayout';

/**
 * 全局路由（设计：frontend-react-refactor）
 * 当前路由面：主界面(#/)；学习中心(#/knowledge)；管理台（#/admin 嵌套）：控制台(index) / 仪表盘(dashboard) / 下载管理(downloads) / 文档解析管理(parsing) / 模型调用记录(llm-calls)
 * 2026-08-18：原始文档对照(compare)路由删除，能力并入文档解析管理右侧（D7 裁决）
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Console />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="parsing" element={<Parsing />} />
          <Route path="llm-calls" element={<LlmCalls />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}