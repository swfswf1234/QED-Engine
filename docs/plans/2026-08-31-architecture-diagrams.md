# 架构文档 Mermaid 图设计计划

状态：Accepted
最后更新：2026-08-31
任务类型：D
关联 ADR：[ADR 0011](../history/adr/v0.1/0011-pending-design-location.md)
关联设计：`../architecture/four-service-architecture.md`、`../architecture/backend-architecture.md`、`../architecture/frontend-architecture.md`
关联 Tracker：docs/trackers/todo.md
归档判定：用户确认后合并至三份 architecture/ 固定文档，计划壳归档

## 目标与成功标准

为三份架构文档补充缺失的经典图表，提升文档的可读性和新人上手效率。

成功标准：
1. 四服务总体架构：新增全景组件架构图（现有 flowchart 保留不变）
2. 后端架构：新增请求生命周期全景时序图（sequenceDiagram）
3. 前端架构：新增页面路由拓扑图（flowchart TD）
4. 三图 Mermaid 语法正确（可渲染）
5. 不改变三份文档的元数据字段（状态/日期等按需微调）

## 范围与非目标

**范围**：为 four-service-architecture.md、backend-architecture.md、frontend-architecture.md 三份文档各补充一张 Mermaid 图表。

**非目标**：不修改现有内容；不新增架构文档；不涉及代码变更。

## 前置条件

1. 三份目标文档已存在且结构稳定
2. 用户已确认图表内容与插入位置

## 工作项

1. 绘制全景组件架构图（flowchart TD）
2. 绘制后端请求生命周期时序图（sequenceDiagram）
3. 绘制前端页面路由拓扑图（flowchart TD）
4. 用户审阅确认
5. 合并至目标文档
6. 运行 Mermaid 语法门禁验证

## 验证与验收

1. `pytest tests/contract/test_architecture_documents.py -q` 通过
2. 三图 Mermaid 语法正确可渲染

## 回滚

将三图从目标文档中移除，恢复原始内容。

## 关闭与归档

用户确认后合并至三份 architecture/ 固定文档，计划壳归档至 `../history/plans/2026-08/`。

## 图 1：全景组件架构图

**目标文档**：`four-service-architecture.md`
**插入位置**：§服务视图（现有 flowchart）之后、§服务职责与端口 之前
**新增章节标题**：`## 全景组件架构图`

```mermaid
flowchart TD
    subgraph Root["QED-Engine 仓库"]
        FE["前端 8903<br/>React 19 + AntD 5"]
        BE["后端 8900<br/>三域组织"]
    end

    subgraph Backend["8900 内部"]
        CTRL["控制域<br/>api/control.py<br/>services/* + LLM 网关"]
        TK["数据域·Tracker<br/>api/tracker.py<br/>TrackerClient"]
        AX["数据域·Axiom<br/>api/axiom.py<br/>AxiomClient"]
    end

    subgraph TR["QED-Tracker 子仓库"]
        T["8901<br/>下载/校验/登记"]
    end

    subgraph AF["Axiom-Flow 子仓库"]
        A["8902<br/>PDF 解析/OCR"]
    end

    subgraph DB["共享数据库"]
        MYSQL[("MySQL 8<br/>qed 库<br/>qt_*/af_*/qed_*")]
    end

    subgraph EXT["外部服务"]
        LM["LM Studio<br/>本地文字模型<br/>:5001"]
        MR["MinerU<br/>解析容器<br/>:8002"]
        LLM["LLM 厂商 API<br/>qwen/deepseek/glm"]
    end

    subgraph FS["文件系统"]
        RAW["dataset/qed-<br/>tracker/raw"]
        PARSED["dataset/axiom-<br/>flow/parsed"]
    end

    BROWSER["Browser"] -->|"HTTP"| FE
    FE -->|"唯一入口"| BE
    BE --> CTRL
    BE --> TK
    BE --> AX
    CTRL -->|"services 启停<br/>生命周期脚本"| T
    CTRL -->|"services 启停"| A
    CTRL -->|"LLM 网关<br/>密钥不下发"| LLM
    CTRL -.->|"启动自检"| LM
    CTRL -.->|"启动自检"| MR
    TK -->|"HTTP"| T
    AX -->|"HTTP"| A
    T -->|"qt_*/qed_*"| MYSQL
    A -->|"af_*/qed_*"| MYSQL
    T -->|"产出"| RAW
    A -->|"产出"| PARSED
    PARSED -->|"8900 代理"| FE
```

## 图 2：后端请求生命周期时序图

**目标文档**：`backend-architecture.md`
**插入位置**：§三域组织 之后、§分层与依赖 之前
**新增章节标题**：`## 请求生命周期`

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant FE as 前端 8903
    participant GW as 后端 8900
    participant SC as 控制域<br/>services/*
    participant TK as 8901<br/>QED-Tracker
    participant AX as 8902<br/>Axiom-Flow
    participant DB as MySQL 8

    rect rgb(240, 248, 255)
    Note over B,DB: 路径 ① 配置查询（8900 直接响应）
    B->>FE: 打开控制台
    FE->>GW: GET /config/models + /services + /config/database
    GW-->>FE: {models, services快照, db快照}
    FE-->>B: 渲染控制台
    end

    rect rgb(245, 255, 245)
    Note over B,DB: 路径 ② 服务启停（8900 → 生命周期脚本）
    B->>FE: 点击"启动 QED-Tracker"
    FE->>GW: POST /services/tracker/start
    GW->>SC: service_manager.start("tracker")
    SC->>TK: 生命周期脚本 start
    TK-->>SC: {pid, running}
    SC-->>GW: {status: "running"}
    GW-->>FE: {status: "running"}
    FE-->>B: 显示启动成功
    end

    rect rgb(255, 248, 240)
    Note over B,DB: 路径 ③ Tracker 数据透传
    B->>FE: 浏览书目列表
    FE->>GW: GET /books
    GW->>TK: GET http://127.0.0.1:8901/api/v1/books
    TK->>DB: SELECT qt_books...
    DB-->>TK: 结果集
    TK-->>GW: JSON
    GW-->>FE: {books}
    FE-->>B: 渲染书目卡片
    end

    rect rgb(248, 240, 255)
    Note over B,DB: 路径 ④ Axiom 数据透传
    B->>FE: 查看单页对照
    FE->>GW: GET /books/{id}/pages/{no}
    GW->>AX: GET http://127.0.0.1:8902/api/v1/...
    AX->>DB: SELECT af_pages...
    DB-->>AX: 页面数据
    AX-->>GW: JSON
    GW-->>FE: {page}
    FE-->>B: 渲染原页图 + Markdown
    end

    rect rgb(255, 245, 240)
    Note over B,DB: 路径 ⑤ LLM 网关调用
    B->>FE: 发送学习提问
    FE->>GW: POST /llm/text {prompt}
    GW->>GW: 路由 api/local
    GW-->>FE: {reply, success}
    FE-->>B: 显示回答
    end
```

## 图 3：前端页面路由拓扑图

**目标文档**：`frontend-architecture.md`
**插入位置**：§信息架构（hash 路由）之后、§与后端的交互 之前
**新增章节标题**：`## 页面路由拓扑`

```mermaid
flowchart TD
    ROOT["#/"]

    subgraph LEARN["学习中心"]
        HOME["#/ 主界面<br/>领域→课程→知识点浏览"]
        KNOW["#/knowledge<br/>课程图 + 教程"]
    end

    subgraph ADMIN["#/admin 管理后台"]
        CONSOLE["#/admin<br/>控制台"]
        DASH["#/admin/dashboard<br/>仪表盘"]
        DL["#/admin/downloads<br/>文档下载管理"]
        PARSE["#/admin/parsing<br/>文档解析管理"]
        LLM["#/admin/llm-calls<br/>模型调用记录"]
    end

    ROOT --> HOME
    ROOT --> KNOW
    ROOT --> ADMIN

    HOME -->|"GET /courses<br/>GET /knowledge"| API1["8900 API"]
    KNOW -->|"GET /courses<br/>GET /knowledge<br/>GET /books"| API2["8900 API"]
    CONSOLE -->|"GET /services<br/>GET /config/*<br/>POST /services/*"| API3["8900 API"]
    CONSOLE -->|"GET /monitor/*"| API4["8900 API"]
    DASH -->|"GET /services<br/>GET /books<br/>GET /parse-jobs"| API5["8900 API"]
    DL -->|"GET /courses<br/>GET /catalogs/*<br/>GET /tasks<br/>POST /books/*"| API6["8900 API"]
    PARSE -->|"GET /books<br/>GET /books/*/pages/*<br/>POST /parse-jobs"| API7["8900 API"]
    LLM -->|"GET /llm/calls<br/>PATCH /llm/calls/*"| API8["8900 API"]
```

## 实施步骤

1. **确认阶段**（当前）：用户审阅三图内容与位置
2. **合并阶段**：用户确认后，将三图分别插入目标文档的指定位置
3. **门禁阶段**：运行 `pytest tests/contract/test_architecture_documents.py -q` 验证 Mermaid 语法
4. **归档**：计划壳归档至 `../history/plans/2026-08/`
