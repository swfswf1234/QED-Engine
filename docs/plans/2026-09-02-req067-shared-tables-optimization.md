# 文档下载管理界面共享表优化（REQ-067 综合计划补充）

状态：Draft
任务类型：REQ-067 补充
最后更新：2026-09-02
关联任务：REQ-067（文档下载管理界面优化）
关联文档：[database-design.md](../architecture/database-design.md)、[shared-tables.md](../../QED-Tracker/docs/architecture/shared-tables.md)

## 背景

当前文档下载管理界面的数据获取完全依赖8900后端透传8901 QED-Tracker的服务。当QED-Tracker未启动时，前端无法获取领域、课程等共享表数据，导致功能受限。

用户需求：
1. 将qed_*共享表结构同步到architecture/database-design.md文档中，后续不用参考其他项目
2. 项目后端有权限增删改查共享表，当子项目未启动时，也可以自己查询子项目中关于共享表的相关资料
3. 代码部分专门设置一个模块处理共享库相关操作，当子项目未启动时直接通过8900服务自己调用，逻辑一致

## 数据获取逻辑梳理

### 当前数据流

```
前端（8903）→ 8900后端 → 8901 QED-Tracker
     ↓              ↓              ↓
  只连8900      透传API      共享表+私有表
```

### 数据获取流程

1. **领域课程体系**：`GET /api/v1/courses`
   - 返回`DomainSystem[]`（领域含嵌套课程）
   - 8900透传8901的`/api/v1/courses`端点
   - 数据源：`qed_domain` + `qed_course`共享表

2. **教程列表**：`GET /api/v1/knowledge`
   - 返回`KnowledgeRecord[]`
   - 8900透传8901的`/api/v1/knowledge`端点
   - 数据源：`qt_knowledge`私有表

3. **教程详情**：`GET /api/v1/knowledge/{id}`
   - 返回`KnowledgeDetail`（含books）
   - 8900透传8901的`/api/v1/knowledge/{id}`端点
   - 数据源：`qt_knowledge` + `qt_books`私有表

4. **书籍操作**：`/api/v1/books/*`系列端点
   - 8900透传8901的`/api/v1/books/*`端点
   - 数据源：`qt_books` + `qt_sources`私有表

### 独立降级机制

- 8900不可达 → 整体错误
- 课程体系 / knowledge 各自失败互不拖累
- 详情拉取失败仅该教程书籍缺失

### 数据获取代码位置

- **前端store**：`web-ui/src/stores/downloads.ts`
  - `fetchAll()`函数：主数据获取入口
  - `startPolling()`：5s轮询exploration_stage
- **前端API**：`web-ui/src/api/tracker.ts`
  - `listCourseSystem()`：获取领域课程体系
  - `listKnowledge()`：获取教程列表
  - `getKnowledge()`：获取教程详情
- **后端路由**：`backend/qed_engine/api/tracker.py`
  - 透传8901的所有端点
- **后端客户端**：`backend/qed_engine/clients/tracker_client.py`
  - 与8901通信的HTTP客户端

## 共享表结构（当前状态）

### qed_domain（领域表，共享）

| 字段 | 类型 | 说明 |
|------|------|------|
| domain_id | VARCHAR(32) PK | 领域标识，如"math" |
| name | VARCHAR(100) | 显示名，如"数学" |
| description | TEXT | 学科介绍 |
| level | VARCHAR(50) | 探索范围标签 |
| scope | TEXT | 学科知识（当前置空） |
| exploration_stage | VARCHAR(20) | 流程状态（6态） |
| classic_tracks | JSON | 课程方向 |
| stages | JSON | 学习阶段顺序 |
| path_results | JSON | 学习流程 |
| explore_pending | JSON | 探索待确认载荷 |
| created_by | VARCHAR(16) | 创建者 |
| updated_by | VARCHAR(16) | 更新者 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### qed_course（课程表，共享）

| 字段 | 类型 | 说明 |
|------|------|------|
| course_id | VARCHAR(64) PK | 课程标识 |
| domain_id | VARCHAR(32) FK | 所属领域 |
| sort_order | INT | 学习顺序 |
| name | VARCHAR(200) | 规范名 |
| aliases | JSON | 别名列表 |
| track | VARCHAR(50) | 课程所属学术方向 |
| stage | VARCHAR(32) | 所属阶段 |
| prerequisites | JSON | 先修课程 |
| related_targets | JSON | 已验收关联目标 |
| description | VARCHAR(1000) | 课程介绍 |
| exploration_stage | VARCHAR(20) | 流程状态 |
| explore_pending | JSON | 探索待确认载荷 |
| created_by | VARCHAR(16) | 创建者 |
| updated_by | VARCHAR(16) | 更新者 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### qt_knowledge（教程表，私有）

| 字段 | 类型 | 说明 |
|------|------|------|
| knowledge_id | VARCHAR(100) PK | 教程标识 |
| domain_id | VARCHAR(32) | 冗余领域 |
| course_id | VARCHAR(64) FK | 所属课程 |
| kind | VARCHAR(24) | tutorial/other_material |
| set_no | VARCHAR(4) | 套标记 |
| name | VARCHAR(200) | 教程名/归类名 |
| textbook_ref | JSON | 教材决定引用 |
| exercise_ref | JSON | 习题集决定引用 |
| textbook_intro | TEXT | 教材简介 |
| exercise_intro | TEXT | 习题集简介 |
| materials_intro | TEXT | 延展资料归类简介 |
| status | VARCHAR(24) | 状态 |
| ... | ... | 其他字段 |

### qt_books（书籍表，私有）

| 字段 | 类型 | 说明 |
|------|------|------|
| book_id | VARCHAR(100) PK | 书籍标识 |
| knowledge_id | VARCHAR(100) FK | 所属教程 |
| kind | VARCHAR(16) | textbook/exercise/paper/blog/other |
| roles | JSON | 角色列表 |
| title | VARCHAR(500) | 书名 |
| part | VARCHAR(32) | 卷标识 |
| display_title | VARCHAR(500) | 展示名 |
| ... | ... | 其他字段 |

## 优化方案

### 方案1：共享表结构同步到database-design.md

**目标**：将qed_*共享表结构完整记录到根仓库database-design.md，无需参考QED-Tracker文档

**实现步骤**：
1. 更新`docs/architecture/database-design.md`，补充qed_domain和qed_course的完整字段说明
2. 添加共享表的DDL和列说明
3. 添加exploration_stage状态机说明
4. 添加写入权限和Schema变更流程说明

### 方案2：后端独立查询共享表能力

**目标**：当QED-Tracker未启动时，8900后端能直接查询共享表，提供降级服务

**实现步骤**：
1. 在后端添加共享表直接查询模块（`backend/qed_engine/services/shared_tables.py`）
2. 实现领域、课程的CRUD操作（直接操作数据库）
3. 修改tracker_client.py，当8901不可用时自动降级到直接查询
4. 保持API接口不变，前端无感知

### 方案3：共享库操作模块

**目标**：专门设置模块处理共享库相关操作，统一管理

**实现步骤**：
1. 创建`backend/qed_engine/services/shared_tables.py`模块
2. 实现共享表的查询、更新、删除操作
3. 实现exploration_stage状态机管理
4. 实现explore_pending载荷处理
5. 提供统一的接口给tracker.py使用

## 技术细节

### 数据库连接配置

共享表使用相同的MySQL实例（qed库），连接配置来自根.env：
- QED_DB_HOST
- QED_DB_PORT
- QED_DB_NAME
- QED_DB_USER
- QED_DB_PASSWORD

连接函数复用`backend/qed_engine/services/llm/call_log.py`的`_connect()`函数。

### 降级策略

当8901不可用时：
1. 前端调用8900的`/api/v1/courses`等端点
2. 8900检测到8901不可用（TrackerError）
3. 自动切换到直接查询共享表
4. 返回格式与8901一致的数据

### 状态机管理

exploration_stage状态机（6态）：
- 未开始 → 已生成 → 探索中 → 待确认 → 已完成
- 探索中/待确认 → 失败

explore_pending载荷：
- 待确认：`{kind:"review_results", courses:[...], domain_report}`
- 失败：`{kind:"failed", error:"..."}`

### 模块设计

**文件位置**：`backend/qed_engine/services/shared_tables.py`

**核心函数**：

1. **查询函数**：
   - `list_domains()`：查询所有领域
   - `get_domain(domain_id)`：查询单个领域
   - `list_courses(domain_id=None)`：查询课程（可按领域过滤）
   - `get_course(course_id)`：查询单个课程

2. **写入函数**：
   - `create_domain(name, description, stages)`：创建领域
   - `update_domain(domain_id, **kwargs)`：更新领域
   - `delete_domain(domain_id)`：删除领域（有课程时拒绝）
   - `create_course(domain_id, name, stage, **kwargs)`：创建课程
   - `update_course(course_id, **kwargs)`：更新课程
   - `delete_course(course_id)`：删除课程（有教程时拒绝）

3. **状态机函数**（已有）：
   - `direct_write_stage()`：直写exploration_stage
   - `set_domain_stage()`：领域状态写入（在线/离线）
   - `set_course_stage()`：课程状态写入

4. **辅助函数**：
   - `_connect()`：复用call_log.py的连接函数
   - `_dict_from_row()`：将数据库行转换为字典

### 返回格式

返回格式与8901的`/api/v1/courses`端点一致：

```python
[
  {
    "domain_id": "math",
    "name": "数学",
    "description": "...",
    "level": "本科-硕士",
    "classic_tracks": [...],
    "exploration_stage": "未开始",
    "path_results": null,
    "stages": ["基础", "主干", "分支", "前沿"],
    "courses": [
      {
        "course_id": "01_math_analysis",
        "name": "数学分析",
        "aliases": [...],
        "track": "分析学",
        "stage": "主干",
        "prerequisites": [...],
        "related_targets": [...],
        "description": "...",
        "exploration_stage": "未开始"
      }
    ]
  }
]
```

### 降级切换逻辑

在`tracker_client.py`中添加降级逻辑：

```python
def list_courses_system(self) -> list:
    """GET /courses：领域课程体系（优先8901，降级直接查询）。"""
    try:
        return self._request("GET", f"{API_PREFIX}/courses")
    except TrackerError:
        # 8901不可用，降级直接查询共享表
        from qed_engine.services.shared_tables import list_domains_with_courses
        return list_domains_with_courses(self._settings)
```

### 测试策略

1. 单元测试：测试直接查询函数
2. 集成测试：测试降级切换逻辑
3. 端到端测试：测试前端无感知降级

## 验证标准

1. 共享表结构完整记录到database-design.md
2. 8901未启动时，前端仍能查看领域、课程（只是看不了教程、书籍）
3. 8901未启动时，能增删改领域和课程
4. 共享库操作模块逻辑一致，前端无感知
5. 所有测试通过，无回归

## 关联任务

- REQ-067：文档下载管理界面优化
- REQ-047：数据库设计（长期任务）
- REQ-002：文档治理与同步（长期任务）

## 实施计划

1. 第一步：更新database-design.md，补充共享表结构
2. 第二步：创建shared_tables.py模块
3. 第三步：实现直接查询逻辑
4. 第四步：修改tracker_client.py实现降级
5. 第五步：测试验证

## 风险与注意事项

1. 数据库连接安全：确保密码不泄露
2. 状态机一致性：直接操作时保持状态机逻辑一致
3. 数据一致性：确保直接操作与8901操作的数据一致
4. 测试覆盖：充分测试降级场景