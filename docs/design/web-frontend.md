# 8903 前端契约（web/）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-08-14
关联代码：`web/index.html`、`web/app.js`、`web/style.css`
关联测试：`tests/test_web.py`
关联 ADR：`docs/adr/0002-frontend-and-port-centralization.md`、`docs/adr/0007-qed-engine-backend-gateway.md`

## 目的与边界

本文件是 QED-Engine 前端（8903）界面的契约事实源：组成、信息架构、交互、视觉与响应式。
跨项目对接语义见[三项目对接规范](service-contracts.md)；学习中心（`#/` 最终形态）的探索设计
见[learning-center.md](learning-center.md)（Draft）——本文件描述**当前实现**，学习中心描述
**目标形态**，冲突时以各自状态标注为准。

> 2026-08-16（ARCH-011）：**前端重构主轮启动**——8903 将整体切换为 React 全家桶实现
> （web-ui/，[ADR 0008](../adr/0008-frontend-react-refactor.md)）。本文件描述的「当前实现」
> （原生三文件版）在过渡期仍为事实源，重构目标态契约见
> [frontend-react-refactor.md](frontend-react-refactor.md)；8903 切换完成后本文件重写为 v2。

> 十七期（2026-08-14，ARCH-010）：**文档下载管理数据层切换三表**（表1 选课条目 / 表2 册级
> 明细 / 表3 渠道来源），前端对齐契约以
> [downloads-three-table-model.md](downloads-three-table-model.md) §4 为事实源——树第三层为
> 表1 条目（tree-selection）、课程面板为套书卡 + 册明细展开、步骤条四步语义（① 选择→② 评估→
> ③ 下载→④ 审理）、旧 /resources 与「开始下载」废除。本文件下文的历史期描述（资源卡、
> 配套对并排、/resources 端点等）在十七期后不再适用，保留仅作演进沿革。

- 原生静态单页应用（无构建步骤），`python -m http.server 8903 --directory web` 直接托管；
  **浏览器只连 8900**（ADR 0007 唯一入口：配置域横幅 + 数据域 catalogs/selections/tasks +
  服务域 /services 全部经 8900，内部适配 8901/8902），无后端代理、浏览器不直连 8901/8902。
- 组成：`web/index.html`（页面外壳）、`web/app.js`（hash 路由与数据渲染）、`web/style.css`（样式）。

## 信息架构（hash 路由）

路由演进：三期 + 四期 ARCH-004 + 五期 ARCH-005（2026-08-06 起）。

- `#/` 主体学习界面：**零后台痕迹**（五期）——品牌导航 + Hero 标语 + 三项入口卡片
  （知识点梳理 / 学习 / 刷题模式，建设中）+ 右上角「使用手册」按钮（内置弹窗，全模块短步骤）
  与「管理后台」入口；不展示任何服务状态（服务健康全部移入仪表盘）；
- `#/admin` 管理后台（六期裁决：取消「模块总览」卡片墙）——**直达仪表盘**（#/admin 为
  #/admin/dashboard 别名路由），无中间层；
- `#/admin/dashboard` 后台仪表盘（四期独立路由；五期重写）：
  **四阶段流水线**（十期起按课程统计：总课程数 = `/catalogs/math-qe` targets 去重 course_id
  **动态计算**，不硬编码）：
  - 发现下载（宽松口径）：课程下存在任一资源（candidate/backup/pending_manual/confirmed/
    not_found 等）即完成；
  - 评估确认（严格口径）：课程有资源 且 课程内无待评估资源（status ∉ candidate/pending_manual，
    confirmed/backup/rejected/not_found 均为评估终态）才算完成；
  - 阶段数字显示「已完成 X / N 课程」（不显示孤立数字），进度条 = X/N；
  - 解析/知识整理：无数据源显示「未启用」，8901 离线流水线整体离线提示）+
  **服务健康分组面板**（八期语义收敛）：
  - **后台服务**：QED-Tracker（文档下载服务）/ Axiom-Flow（文档解析服务）/
    QED 管理服务（后台管理服务，即 8900 配置中心）三服务健康探测；**在线仅绿点+名称
    （不写原因），离线附原因文案**；
  - **LLM配置**：只显示三个实际使用模型（8900 `/config/models` 路由表
    主模型 default / 视图模型 ocr / Embedding embedding 的 configured=true 项，
    如「主模型：qwen-plus」；切换档 glm/glm_ocr 与占位档 deepseek 不显示，
    不再逐 provider 展示联通状态）；
  - **数据库配置**：仅 MySQL（8900 `/config/database` 真实连接探测）；向量数据库未配置
    不展示占位；异常项展开问题文案；
  旧统计卡/环形图/条形图已移除；
- `#/admin/downloads` **知识点**（四期下载管理，五期改名，十一期改版）：**三层知识链路树
  （领域 → 课程 → 书籍）**，无总根节点：
  - 领域层自适应（catalog_id → 学科映射 `CATALOG_DOMAIN_MAP`，当前 math-qe → 数学，
    未来多领域自动出现），显示课程数；
  - 课程层按**学习深度排序**（前端 `COURSE_ORDER`：01 数学分析 → 02 线性代数 → 03 拓扑 →
    04 实分析 → 05 复分析 → 06 泛函分析 → 07 常微分方程 → 08 偏微分方程 → 09 抽象代数 →
    11 概率论 → 12 随机过程 → 13 高维概率 → 10 考前综合；先学的在前、依赖后续的在后，
    未列入新课程排尾）；
  - 书籍层：**书名 + 作者 + 类型徽标**（kind：book→教材 / exercise→习题集 / 其他→资料），
    数据源 `/catalogs/math-qe`；
  - **课程完成判定**：≥1 本教材 + ≥1 本习题集均**验收通过（approved）** 才算完成——课程行
    显示「✅ 已完成」或进度「教材 a/b · 习题集 c/d」（03 拓扑/10 考前综合/13 高维概率
    当前无习题集，如实显示无法完成）；目标态「两套标准」升级见
    [course-acquisition-flow.md](course-acquisition-flow.md) 前端对齐契约；
  - **PyCharm 式树交互**：行式紧凑 + 缩进引导线；**箭头=展开/折叠（不触发选中）、
    名称=选中过滤面板**（领域/课程/书籍均可选）；
  - 树默认固定宽 **400px**（28 寸优先），**拖拽手柄 tree-resizer 调整 280–640px**，
    localStorage（键 `qed-tree-w`）记忆；
  面板展示选中范围资源事务（确认/备选/否定/转正/拒绝/验收/详情），**筛选器为按钮弹层
  （五期：领域/课程/状态，浅底深字，与树选择独立叠加 AND）** + 触发评估（范围跟随「课程」筛选，
  未选=全目录），评估任务列表并入面板（1s 轮询，任务按 状态/类型/课程 弹层筛选）；
  **十二期增强**：① 面板按范围展示**全部书籍**（领域/课程/书籍选中时：未生成候选的目标显示
  「待评估」虚线占位卡【书名+作者+类型徽标】，已评估目标显示资源卡片，按学习深度排序）；
  ② **树→筛选器单向联动**：点领域→领域筛选=该领域、课程清空；点课程→领域=所属领域、
  课程=该课程（`courseDomain` 映射），点书籍不改筛选；③ **课程筛选项随领域收窄**（领域已选时
  只列该领域课程）；
**十三期：控制台化**——选中课程后面板顶部出现**课程操作条**（`course-console`）：「② 评估书单」
    按钮（刷新该课程表1 书单；AI 搜索评估任务已随 QED-030 退役，评估=人工三态决策）+
  **步骤进度条**（选择→评估→下载→审理，idle/进行/完成 三态）；
  工具栏全局「触发评估」按钮移除（评估以课程为单位操作）；树行点击已修复事件冒泡
  （点课程不再误选为领域，十三期回归守护）；
**十四期（人工评审优化，ARCH-006）**：① 知识点界面尾部「评估任务」区块（任务卡片列表 +
   任务状态/类型/课程三个筛选器）移除（任务数据仅用于步骤条搜索态，8900 `/tasks` 仍拉取）；
   ② 资源卡三态按钮（确定/备选/否定）旁新增**评审建议输入框**（`review-note`，选填），
   随三态一并提交 `note` 参数（8900 confirm/backup/reject 落表1 `note`/表2 `review_note`），
   卡片与详情弹窗展示既有建议；
  **十五期（ARCH-007）**：① 界面名回归——侧边栏菜单与页面标题改回**「文档下载管理」**
  （树侧栏头保留「知识点」）；② 进入默认选中「数学」领域（`loadTree` 完成后无选择时
  `selectNode("domain", "数学")`）；③ 领域级右侧按课程分页（`PAGE_SIZE = 3`，`coursePagerHtml`
  翻页控件，左右两栏等高 align-items: stretch），课程级/书籍级保持现状；
  ④ 同课程配套教材+习题集（作者集排序后 join 相同）`paired-row` 并排同一行。
- `#/admin/parsing` 解析进度、`#/admin/compare` 原始文档对照——**事务视图，无数据源时置空**
  （空态提示），数据管线就绪后填充（REQ-015 / ALN-006 / QED-012 前置）；**「追溯」界面
  （#/admin/trace）已随六期裁决移除**；
- 侧边栏菜单（六期收敛为四项独立界面；十一期改名，十五期界面名回退）：仪表大盘 / 文档下载管理 /
  文档解析进度 / 原始文档对照。

## 详情弹窗

四期统一评估视角：资源/任务详情标注 **课程→书籍（课程名+领域+目标标题）、
类型/中英/来源（provider + page_url）、LLM 简介评分、下载详情（relative_path/page_count/sha256）、
解析目标建议徽标（verdict + score）**；任务详情显示 params.course_id 对应的课程与领域。

## 横幅

三期粗粒度化；八期去向量库占位：只显示「LLM评估模块连接：OK / MySQL数据库连接：OK」，
不透露 provider 名单与主机细节。判定：LLM=任一已配置供应商可达（8900 `/config/llm-status` 探测）；
MySQL=8900 `/config/database` 真实连接探测（pymysql）；未配置显示「未配置」，配置但不可达显示
「不可用/连接失败」。

## 视觉规范

DeepSeek 蓝黑风格，非纯黑：背景 `#0e1424` + 顶部蓝紫光晕；卡片
`rgba(77,107,254,0.07)` + 边框 `rgba(148,163,255,0.12)`；主渐变 `#4d6bfe → #8b7bff`；
在线 `#34d399` / 离线 `#f87171`；圆角 12-16px。

## 响应式

自适应窗口：≥1024px 侧边栏 220px；768–1024px 图标栏（树固定 240px）；≤768px 汉堡抽屉 +
单列卡片 + 下载布局单列（树置顶限高 320px，拖拽手柄隐藏）；仪表盘图表单列。

## 契约引用（tests/test_web.py 守护）

- 唯一入口（ADR 0007）：`API_BASE = http://127.0.0.1:8900/api/v1`，app.js 不得出现
  `:8901`/`:8902` 直连；配置/数据/服务域全部经 8900；
- 8900 端点：
  - 配置域：`/api/v1/health`、`/config/keys`、`/config/models`、`/config/database`、`/config/llm-status`；
  - 服务域：`/services`（三服务状态快照）；
  - 数据域：`/selections`、`/downloads`、`/sources`、`/tasks`、`/confirm`、`/backup`、`/reject`、
    `/approve`、`/register`、`/catalogs/math-qe`（三表端点语义归 8900 数据域，旧 `/resources`
    端点随 QED-030 退役，详见[配置中心 API 契约](config-center-api.md)）；
- 路由：`#/admin`（别名直达仪表盘）、`#/admin/dashboard`、`#/admin/downloads`、`#/admin/parsing`、
  `#/admin/compare`；
- 十四期守护：`review-note`/`review_note` 在 app.js、`task-list`/任务筛选器不在 index.html；
- 十五期守护：`文档下载管理` 在 index.html（菜单+标题 ≥2 处）、`知识点` 保留树头、
  `selectNode("domain", "数学")`/`PAGE_SIZE = 3`/`renderPanelByCourses`/`pairedCourseTargets` 在 app.js。

## 独立性

8901/8902 离线时各视图显示离线提示、状态卡变红，不白屏不报错（铁律见
[四服务架构与边界](../architecture/four-service-architecture.md)）。

## 验证

- `tests/test_web.py` 全绿（三文件就位、路由/入口文本、8900 唯一入口守护、端点引用、响应式断点与各期守护）。
- 人工验收：8903 打开各路由检查界面语义（横幅、仪表盘分组、下载树、空态、离线态）。
