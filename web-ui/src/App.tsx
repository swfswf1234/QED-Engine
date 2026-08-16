import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Console from './pages/Console';
import Dashboard from './pages/Dashboard';
import Downloads from './pages/Downloads';
import Parsing from './pages/Parsing';
import Compare from './pages/Compare';
import Knowledge from './pages/Knowledge';
import AdminLayout from './components/AdminLayout';

/**
 * 全局路由（设计：frontend-react-refactor）
 * 当前路由面：主界面(#/)；学习中心(#/knowledge)；管理台（#/admin 嵌套）：控制台(index) / 仪表盘(dashboard) / 下载管理(downloads) / 解析进度(parsing) / 原始文档对照(compare)
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
          <Route path="compare" element={<Compare />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}