# V1 权限点与接口路径映射表

## 1. 文档目的
- 为 V1 版本提供权限点与 API 路径的映射关系。
- 供后端路由设计、控制器鉴权、中间件拦截、联调和测试用例编写使用。
- 与 `docs/product/permission_matrix_v1.md` 配套使用。

## 2. 来源说明
- 当前已对齐文件：[openapi_v1.yaml](E:/code/pm/docs/api/openapi_v1.yaml)
- 当前工作区中 OpenAPI 已存在，服务前缀为 `http://localhost:8000/api/v1`
- 本文将接口分为两类：
  - 已存在：已在 `openapi_v1.yaml` 中定义
  - 建议补齐：需求与权限矩阵中已存在，但 OpenAPI 尚未补充

## 3. 当前 OpenAPI 现状

### 3.1 已覆盖模块
- 认证与权限摘要
- 需求池基础接口
- 项目基础接口
- 执行基础接口
- 任务/子任务接口（仍使用 `tasks` 术语）
- 日常任务接口（仍使用 `daily-tasks` 术语）
- 甘特基础接口
- 日报/周报生成
- 权限点校验接口

### 3.2 主要差异
- OpenAPI 中仍保留 `tasks`、`daily-tasks` 命名，尚未完全统一到 PRD 中的 `execution`、`daily execution` 术语。
- 当前 OpenAPI 尚未覆盖缺陷、通知、系统设置、执行工作日志、项目成员管理、钉钉绑定、统计报表下钻等接口。
- 当前 OpenAPI 未定义 `operationId`，后续建议补上，便于代码生成和自动化测试。

## 4. 通用鉴权规则

| 层级 | 说明 |
| --- | --- |
| AuthN | 校验登录态、JWT、Token 是否有效 |
| AuthZ | 校验当前接口要求的权限点编码 |
| Scope | 校验数据范围是否属于 `org/project/self/related` |
| State | 校验状态流转是否合法，例如未评审需求不能生成执行 |
| Audit | 写操作记录审计日志 |

## 5. 已存在于 OpenAPI 的接口映射

说明：以下路径均基于服务前缀 `/api/v1`。

### 5.1 认证与权限

| 方法 | OpenAPI 路径 | 说明 | 权限点 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | 账号密码登录 | `auth.login.public` | 已存在 | 公共接口 |
| POST | `/auth/logout` | 退出登录 | 仅登录态 | 已存在 | 建议补充 `auth.logout.self` 编码 |
| GET | `/auth/me` | 获取当前用户信息 | 仅登录态 | 已存在 | 对应当前用户资料 |
| GET | `/auth/permissions` | 获取当前用户角色与权限 | 仅登录态 | 已存在 | 前端初始化可直接使用 |
| GET | `/system/summary` | 获取认证与权限基础能力摘要 | 仅登录态 | 已存在 | 可用于系统健康或初始化摘要 |
| POST | `/permissions/check` | 权限点校验 | 仅登录态 | 已存在 | 前端辅助判断，不能替代后端鉴权 |

### 5.2 需求池

| 方法 | OpenAPI 路径 | 说明 | 权限点 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| GET | `/requirements` | 需求列表 | `requirement.view.related` | 已存在 | 支持分页与筛选 |
| POST | `/requirements` | 新建需求 | `requirement.create.project` | 已存在 | |
| GET | `/requirements/{id}` | 获取需求详情 | `requirement.view.related` | 已存在 | |
| PATCH | `/requirements/{id}` | 更新需求 | `requirement.edit.self` | 已存在 | 项目管理员可按 scope 放宽 |
| POST | `/requirements/{id}/reviews` | 创建评审记录 | `requirement.review.create.project` | 已存在 | |
| GET | `/requirements/{id}/reviews` | 查询评审记录 | `requirement.view.related` | 已存在 | V1 可并入需求详情查看权限 |
| POST | `/requirements/batch-generate-executions` | 批量从需求生成执行 | `requirement.execution.generate.project` | 已存在 | 推荐保留为主路径 |
| POST | `/requirements/batch-generate-tasks` | 兼容旧路径，批量从需求生成执行 | `requirement.execution.generate.project` | 已存在 | 兼容旧术语，建议后续废弃 |

### 5.3 项目管理

| 方法 | OpenAPI 路径 | 说明 | 权限点 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| GET | `/projects` | 项目列表 | `project.view.related` | 已存在 | |
| POST | `/projects` | 新建项目 | `project.create.org` | 已存在 | |
| GET | `/projects/{id}` | 项目详情 | `project.view.related` | 已存在 | |
| PATCH | `/projects/{id}` | 更新项目 | `project.edit.project` | 已存在 | |

### 5.4 执行与子执行

| 方法 | OpenAPI 路径 | 说明 | 权限点 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| GET | `/executions` | 执行列表 | `execution.view.related` | 已存在 | |
| POST | `/executions` | 新建执行 | `execution.create.project` | 已存在 | |
| GET | `/executions/{id}` | 执行详情 | `execution.view.related` | 已存在 | |
| PATCH | `/executions/{id}` | 更新执行 | `execution.edit.project` | 已存在 | |
| GET | `/executions/{id}/tasks` | 执行下任务列表 | `execution.view.related` | 已存在 | 当前仍使用 `tasks` 作为子执行术语 |
| GET | `/tasks` | 任务列表 | `execution.view.related` | 已存在 | 建议后续统一为子执行列表 |
| POST | `/tasks` | 新建任务 | `execution.child_create.project` | 已存在 | 可视为新建子执行 |
| GET | `/tasks/{id}` | 任务详情 | `execution.view.related` | 已存在 | |
| PATCH | `/tasks/{id}` | 更新任务 | `execution.edit.project` | 已存在 | 可映射为子执行编辑 |

### 5.5 日常执行

| 方法 | OpenAPI 路径 | 说明 | 权限点 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| GET | `/daily-tasks` | 日常任务列表 | `daily.view.self` | 已存在 | 当前仍使用旧术语 |
| POST | `/daily-tasks` | 快速创建日常任务 | `daily.create.self` | 已存在 | 当前仍使用旧术语 |

### 5.6 甘特与报告

| 方法 | OpenAPI 路径 | 说明 | 权限点 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| GET | `/schedules/team-gantt` | 团队甘特视图数据 | `schedule.team.view.project` | 已存在 | |
| GET | `/schedules/execution-gantt` | 执行甘特视图数据 | `execution.gantt.view.project` | 已存在 | |
| POST | `/reports/daily/generate` | 生成日报草稿 | `report.daily.generate.self` | 已存在 | |
| POST | `/reports/weekly/generate` | 生成周报草稿 | `report.weekly.generate.self` | 已存在 | |

## 6. 建议补齐到 OpenAPI 的接口

### 6.1 需求池增强

| 方法 | 建议路径 | 说明 | 权限点 | 备注 |
| --- | --- | --- | --- | --- |
| POST | `/requirements/{id}/actions/submit-review` | 发起评审 | `requirement.submit_review.self` | 与创建评审记录区分 |
| POST | `/requirements/{id}/reviews/{reviewId}/actions/decide` | 评审结论 | `requirement.review.decide.project` | 明确通过/拒绝/延期/补充 |
| POST | `/requirements/{id}/actions/transition` | 推进需求状态 | `requirement.status.transition.project` | 显式状态机接口 |
| POST | `/requirements/{id}/executions/actions/link` | 关联已有执行 | `requirement.link_execution.project` | |
| GET | `/requirements/actions/export` | 导出需求 | `requirement.export.project` | |

### 6.2 项目增强

| 方法 | 建议路径 | 说明 | 权限点 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/projects/{id}/members` | 查看项目成员 | `project.view.related` | |
| POST | `/projects/{id}/members` | 添加项目成员 | `project.member.manage.project` | |
| DELETE | `/projects/{id}/members/{userId}` | 移除项目成员 | `project.member.manage.project` | |
| GET | `/projects/actions/export` | 导出项目 | `project.export.project` | |

### 6.3 执行增强

| 方法 | 建议路径 | 说明 | 权限点 | 备注 |
| --- | --- | --- | --- | --- |
| POST | `/executions/{id}/actions/assign` | 指派负责人 | `execution.assign.project` | |
| POST | `/executions/{id}/actions/transition` | 执行状态流转 | `execution.status.transition.project` | |
| POST | `/executions/{id}/actions/update-progress` | 更新实际进度 | `execution.progress.edit.self` | |
| POST | `/executions/{id}/actions/update-plan` | 修改计划时间 | `execution.plan.edit.project` | |
| PUT | `/executions/{id}/dependencies` | 维护执行依赖 | `execution.dependency.edit.project` | |
| DELETE | `/executions/{id}` | 删除执行 | `execution.delete.project` | |
| POST | `/executions/{id}/actions/close` | 关闭执行 | `execution.delete.project` | 如删除与关闭分离可拆编码 |
| POST | `/executions/{id}/comments` | 评论/@提醒 | `execution.comment.create.related` | |
| POST | `/executions/{id}/attachments` | 上传附件 | `execution.attachment.upload.related` | |

### 6.4 执行工作日志

| 方法 | 建议路径 | 说明 | 权限点 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/executions/{id}/worklogs` | 工作日志列表 | `execution.worklog.view.related` | |
| POST | `/executions/{id}/worklogs` | 新增工作日志 | `execution.worklog.create.self` | |
| GET | `/execution-worklogs/{worklogId}` | 单条日志详情 | `execution.worklog.view.related` | |

### 6.5 日常执行增强

| 方法 | 建议路径 | 说明 | 权限点 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/daily-executions/{id}` | 日常执行详情 | `daily.view.self` | 与旧 `daily-tasks` 并存过渡 |
| PATCH | `/daily-executions/{id}` | 编辑日常执行 | `daily.edit.self` | |
| POST | `/daily-executions/{id}/actions/transition` | 更新状态 | `daily.status.transition.self` | |
| POST | `/daily-executions/{id}/actions/exclude-report` | 是否纳入汇报 | `daily.exclude_report.self` | |

### 6.6 缺陷、通知、设置、绑定

| 方法 | 建议路径 | 说明 | 权限点 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/bugs` | 缺陷列表 | `bug.view.project` | |
| POST | `/bugs` | 新建缺陷草稿 | `bug.create.project` | |
| PATCH | `/bugs/actions/batch-edit` | 批量编辑缺陷 | `bug.batch_edit.project` | |
| POST | `/bugs/actions/submit-drafts` | 统一提交缺陷 | `bug.submit.project` | |
| POST | `/bugs/{id}/actions/transition` | 缺陷状态流转 | `bug.status.transition.project` | |
| GET | `/notifications` | 站内通知 | `notification.view.self` | |
| POST | `/users/me/dingtalk/bind` | 个人钉钉绑定 | `user.bind_dingtalk.self` | |
| GET | `/reports/statistics` | 管理员统计视图 | `report.manage.view.project` | |
| GET | `/reports/statistics/drilldown` | 下钻成员工作内容 | `report.manage.drilldown.project` | |
| GET | `/settings/members` | 组织成员列表 | `settings.member.manage.org` | |
| GET | `/settings/roles` | 角色模板列表 | `settings.role.manage.org` | |
| GET | `/settings/policies` | 权限策略列表 | `settings.policy.manage.org` | |
| GET | `/settings/dictionaries` | 字典配置 | `settings.dictionary.view.org` | |
| GET | `/settings/workflows` | 流程模板 | `settings.workflow.view.org` | |

## 7. 推荐的后端鉴权落点

| 层 | 建议职责 |
| --- | --- |
| 路由中间件 | 校验登录态、解析用户、生成 request_id |
| 控制器前置 | 声明本接口所需权限点编码 |
| Service | 校验 scope、状态机、项目归属、负责人关系 |
| Repository/Model | 只负责数据读写，不承担业务授权判断 |
| 审计模块 | 对成功写操作和关键失败操作落审计日志 |

## 8. 推荐补充到 OpenAPI 的元数据

| 字段 | 示例 | 说明 |
| --- | --- | --- |
| `operationId` | `requirementBatchGenerateExecutions` | 接口唯一标识 |
| `x-permission` | `requirement.execution.generate.project` | 权限点编码 |
| `x-scope` | `project` | 默认 scope |
| `x-idempotent` | `true` | 是否要求幂等 |
| `x-audit-action` | `requirement.batch_generate_execution` | 审计动作编码 |

## 9. 测试建议
- 以“OpenAPI 路径 + 方法 + 权限点”作为测试最小单元。
- 对所有写接口分别验证：有权限成功、无权限 403、越 scope 403、非法状态 4xx。
- 对批量接口增加部分成功、部分失败、重复提交幂等验证。
- 对仍使用旧术语的 `/tasks`、`/daily-tasks` 增加兼容性测试，避免前后端口径不一致。

## 10. 下一步建议
- 给 `openapi_v1.yaml` 补 `operationId`、`x-permission` 等扩展字段。
- 将 `/tasks`、`/daily-tasks` 逐步迁移到与 PRD 一致的命名，并保留兼容期。
- 再补一份“页面按钮 -> 权限点 -> 接口”三级映射表，用于前端显隐和联调排查。
