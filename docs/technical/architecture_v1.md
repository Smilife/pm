# 开发项目管理平台技术架构（V1）

## 1. 架构目标
- 满足内部团队单组织场景，优先交付稳定主流程
- 支持页面/按钮级权限与审计追踪
- 支持需求池、项目、执行、日常执行、缺陷、甘特、自动汇报的一体化数据流
- 可在 V2 平滑扩展字段级权限、多组织、多消息通道

## 2. 技术栈（已确认）

### 2.1 前端
- React 18
- TypeScript
- Vite
- Ant Design 5
- Zustand（轻量状态管理）
- TanStack Query（服务端状态）
- React Router

### 2.2 后端
- PHP 8.3
- ThinkPHP 8
- ThinkORM
- JWT 认证
- Redis 队列 + Cron/命令调度（异步任务与定时任务）

### 2.3 基础设施
- MySQL 8.0
- Redis 7（缓存、队列、分布式锁）
- MinIO（本地附件存储）/ 对象存储（生产）
- Nginx（反向代理）
- Docker Compose（本地开发）

## 3. 系统分层

```text
[Web Frontend]
  -> [BFF/API Gateway(可选)]
    -> [ThinkPHP App]
      -> [Domain Modules]
        -> [MySQL / Redis / Object Storage]
      -> [Queue Worker / Cron Worker]
```

分层说明：
- 表现层：页面渲染、交互、表单校验、权限点控制
- 应用层：业务编排、状态流转、权限校验、事务控制
- 领域层：需求域、项目域、执行域、缺陷域、排期域、报表域、权限域
- 基础设施层：存储、缓存、消息、日志、第三方集成

## 4. 后端模块设计（ThinkPHP）

### 4.1 模块清单
- `AuthModule`：账号密码登录、Token 刷新
- `UserModule`：用户资料、钉钉绑定
- `RequirementModule`：需求池、状态机、评审记录、批量生成执行
- `ProjectModule`：项目列表、项目状态总览、成员关系
- `ExecutionModule`：执行列表、执行树、执行状态流转、工时日志
- `BugModule`：缺陷挂靠、批量草稿提交、状态流转、通知触发
- `DailyExecutionModule`：日常执行快速创建与状态维护
- `ScheduleModule`：执行甘特、团队甘特、冲突检测
- `ReportModule`：日报周报抽取、管理员统计视图
- `PermissionModule`：角色、策略、权限校验
- `NotificationModule`：站内通知、钉钉推送
- `AuditModule`：审计日志统一落库

### 4.2 建议目录
```text
backend/
  app/
    controller/
    middleware/
    model/
    service/
    validate/
    command/
    job/
    enum/
    utils/
  config/
  route/
  database/
    migrations/
    seeds/
  public/
  runtime/
  docs/
```

## 5. 数据模型与数据库策略

### 5.1 数据库配置
- host: `localhost`
- port: `3306`
- user: `root`
- password: `Wangjun@123`
- db: `project_mgmt_dev`

### 5.2 关键实体关系
- `users` 1..n `org_members`
- `requirements` 1..n `requirement_reviews`
- `requirements` n..n `executions`（中间表 `requirement_execution_links`）
- `projects` 1..n `executions`
- `executions` 1..n `execution_worklogs`
- `executions` n..n `executions`（依赖表 `execution_dependencies`）
- `projects` 1..n `bugs`
- `executions` 1..n `bugs`
- `users` 1..n `daily_executions`
- 全业务表 1..n `activity_logs`

### 5.3 索引策略
- `requirements(status, priority, owner_id, created_at)`
- `executions(project_id, status, assignee_id, plan_start, plan_end)`
- `execution_worklogs(execution_id, work_date, creator_id)`
- `daily_executions(owner_id, status, due_at)`
- `bugs(link_type, link_id, owner_id, status)`
- `activity_logs(target_type, target_id, created_at)`

### 5.4 数据约束
- 全表统一 `id + created_at + updated_at + deleted_at`
- 状态字段统一枚举值管理（字典表）
- 写操作事务化，跨表生成执行必须原子提交
- 父执行计划时间、实际时间、进度字段由子执行汇总回写

## 6. 权限架构

### 6.1 模型
- RBAC：角色模板
- ABAC：条件控制（项目归属、创建者、负责人、参与人）

### 6.2 校验链路
1. 前端渲染前根据权限点控制按钮可见性
2. 后端中间件校验登录态
3. 控制器前置策略校验 `resource/action/scope`
4. Service 再次校验关键状态流转合法性
5. 不通过返回 `403xx`

### 6.3 V1 粒度
- 页面级、按钮级
- 字段级权限保留扩展位，不进入 V1

## 7. 核心流程实现要点

### 7.1 需求评审流程
- 需求从“确认”进入“待评审”前触发成熟度检查
- 创建 Review Record 时写入评审结论与决策
- 根据结论自动更新需求状态
- 全过程写审计日志

### 7.2 批量生成执行
- 入参要求 `Idempotency-Key`
- 批量校验需求状态、权限、目标项目/执行合法性
- 成功后建立需求-执行双向关联
- 部分失败返回 `skipped_requirement_ids`

### 7.3 甘特冲突检测
- 查询区间内执行按成员分组
- 对每个成员执行区间做重叠检测
- 生成冲突摘要缓存到 Redis（短时缓存）

### 7.4 日报周报生成
- 通过队列异步抽取执行变更、执行工作日志、日常执行记录
- 按模板拼装 Markdown 草稿
- 允许用户编辑后发布/推送

## 8. 钉钉绑定与通知

### 8.1 账号绑定流程
1. 用户在账号设置点击“绑定钉钉”
2. 前端跳转钉钉授权页，获取 `auth_code`
3. 后端使用 AppKey/AppSecret 换取钉钉用户标识
4. 绑定关系写入 `user_dingtalk_bindings`
5. 返回绑定成功状态

### 8.2 通知策略（V1）
- 通知触发事件：
  - 执行指派给我
  - 执行阻塞
  - 缺陷提交通知负责人
  - 需求评审结论
  - 日报/周报生成完成
- 通道：
  - 站内通知（必达）
  - 钉钉推送（可失败重试）

### 8.3 失败处理
- 推送失败进入重试队列（指数退避）
- 超过重试次数进入死信队列并告警

## 9. 前端工程方案

### 9.1 前端目录
```text
frontend/
  src/
    pages/
    components/
    services/
    hooks/
    store/
    utils/
    images/
      icons/
      illustrations/
```

### 9.2 关键约束
- 请求统一封装在 `services`
- Promise 风格调用 + 统一错误处理
- 全局错误区分用户错误与系统错误
- 表单校验与服务端错误码联动展示

## 10. 可观测与运维

### 10.1 日志
- 接入请求日志、业务日志、审计日志三类
- 所有日志记录 `request_id`

### 10.2 指标
- 接口耗时 P95/P99
- 队列积压长度
- 推送失败率
- 甘特冲突数量趋势

### 10.3 备份
- MySQL 每日全量 + Binlog 增量
- 对象存储定期生命周期管理

## 11. 发布与环境

### 11.1 环境划分
- `dev`：本地开发
- `test`：联调测试
- `prod`：生产环境

### 11.2 发布流程
1. 提交代码并通过 CI
2. 执行数据库迁移
3. 发布后端与前端镜像
4. 重启队列 Worker 与 Cron 任务
5. 验证关键链路（登录、需求生成执行、报告生成、钉钉推送）

## 12. V2 预留扩展
- 字段级权限
- 甘特拖拽改期
- 复杂工时核算
- 多组织多租户
- 飞书/企业微信通知扩展
