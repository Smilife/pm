# V1 权限点矩阵

## 1. 文档目的
- 定义 V1 版本的页面级与按钮/动作级权限基线。
- 作为前端页面显隐、后端接口鉴权、测试验收与角色配置的共同依据。
- 本文遵循 V1 原则：先做页面级与按钮级权限，字段级权限预留到 V2。

## 2. 角色定义

| 角色编码 | 角色名称 | 说明 |
| --- | --- | --- |
| super_admin | 超级管理员 | 系统级管理员，拥有全局配置与全量数据管理能力 |
| org_admin | 组织管理员 | 管理成员、角色、权限策略，拥有组织级视角 |
| project_admin | 项目管理员 | 负责项目配置、执行协同、项目排期与项目维度报表 |
| requirement_owner | 需求负责人 | 负责需求录入、推进、发起评审 |
| execution_member | 执行成员 | 负责执行推进、日志填写、日常执行维护 |
| read_only | 只读访客 | 仅查看被授权的数据与报表，不执行写操作 |

## 3. 权限模型

### 3.1 权限命名规范
- 命名格式：`resource.action.scope`
- 示例：`requirement.review.create.project`、`execution.worklog.create.self`
- V1 推荐先落两层判断：
  - 页面权限：控制菜单与页面入口是否可见
  - 动作权限：控制按钮、表单提交、状态流转、批量操作

### 3.2 Scope 含义

| Scope | 含义 |
| --- | --- |
| all | 全量可操作 |
| org | 组织内可操作 |
| project | 参与或管理的项目范围内可操作 |
| self | 本人创建、本人负责或本人被指派的数据可操作 |
| related | 与本人有关联的数据可查看，如我参与、我关注、我提交 |
| none | 无此权限 |

### 3.3 V1 校验原则
- 前端根据页面权限和动作权限控制菜单、按钮、入口、操作提示。
- 后端必须对所有写接口再次校验，不以前端显隐作为安全边界。
- 对 scope 相关权限，后端需要结合组织、项目、负责人、创建人、参与关系做 ABAC 判断。

## 4. 页面访问矩阵

说明：`Y` 表示默认拥有页面访问权限，`C` 表示有条件访问，`N` 表示默认无权限。

| 页面/菜单 | super_admin | org_admin | project_admin | requirement_owner | execution_member | read_only | 条件说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/workspace` 工作台 | Y | Y | Y | Y | Y | Y | 只读访客仅看被授权范围内数据 |
| `/requirements` 需求池列表 | Y | Y | Y | Y | C | C | 执行成员和只读访客仅看与本人或授权项目相关需求 |
| `/requirements/:id` 需求详情 | Y | Y | Y | Y | C | C | 同上 |
| `/projects` 项目列表 | Y | Y | Y | C | C | C | 非管理员仅查看参与项目 |
| `/executions` 执行列表 | Y | Y | Y | C | Y | C | 需求负责人默认查看与其需求关联的执行 |
| `/executions/:id` 执行详情 | Y | Y | Y | C | Y | C | 仅可访问授权执行 |
| `/executions/:id/board` | Y | Y | Y | C | Y | C | 同上 |
| `/executions/:id/list` | Y | Y | Y | C | Y | C | 同上 |
| `/executions/:id/gantt` | Y | Y | Y | C | C | C | 执行甘特对相关项目开放 |
| `/daily` 日常执行 | Y | Y | Y | Y | Y | C | 只读访客仅查看本人或被授权日常项 |
| `/bugs` 缺陷管理 | Y | Y | Y | C | C | C | V1 若缺陷模块启用，则按项目范围开放 |
| `/bugs/:id` 缺陷详情 | Y | Y | Y | C | C | C | 同上 |
| `/gantt/team` 团队甘特 | Y | Y | Y | N | C | C | 执行成员仅查看本人或所在项目排期 |
| `/reports/daily` 日报 | Y | Y | Y | Y | Y | C | 普通角色默认看本人视角 |
| `/reports/weekly` 周报 | Y | Y | Y | Y | Y | C | 普通角色默认看本人视角 |
| `/settings/members` | Y | Y | N | N | N | N | 成员管理仅系统/组织管理员 |
| `/settings/roles` | Y | Y | N | N | N | N | 角色模板仅系统/组织管理员 |
| `/settings/policies` | Y | Y | N | N | N | N | 权限策略仅系统/组织管理员 |
| `/settings/dictionaries` | Y | Y | C | N | N | N | 项目管理员仅查看，不允许全局修改 |
| `/settings/workflows` | Y | Y | C | N | N | N | 项目管理员可查看项目级流程模板 |
| `/settings/integrations/dingtalk` | Y | Y | C | C | C | N | 管理员可配置，普通用户可进行个人绑定 |

## 5. 动作权限矩阵

说明：
- `Y` 表示默认可执行。
- `C` 表示有条件可执行，需结合 scope 判断。
- `N` 表示默认不可执行。
- “权限点编码”建议作为前后端统一常量。

| 模块 | 权限点编码 | 描述 | super_admin | org_admin | project_admin | requirement_owner | execution_member | read_only | 默认 scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 账号 | `auth.login.public` | 登录系统 | Y | Y | Y | Y | Y | Y | none |
| 账号 | `user.bind_dingtalk.self` | 绑定个人钉钉账号 | Y | Y | Y | Y | Y | N | self |
| 工作台 | `workspace.view.related` | 查看工作台聚合数据 | Y | Y | Y | Y | Y | Y | related |
| 工作台 | `workspace.report.generate.self` | 一键生成今日日报 | Y | Y | Y | Y | Y | N | self |
| 工作台 | `workspace.quick_create.daily.self` | 快捷创建日常执行 | Y | Y | Y | Y | Y | N | self |
| 工作台 | `workspace.quick_create.requirement.project` | 快捷创建需求 | Y | Y | Y | Y | N | N | project |
| 工作台 | `workspace.quick_create.execution.project` | 快捷创建执行 | Y | Y | Y | C | N | N | project |
| 需求池 | `requirement.view.related` | 查看需求列表/详情 | Y | Y | Y | Y | C | C | related |
| 需求池 | `requirement.create.project` | 创建需求 | Y | Y | Y | Y | N | N | project |
| 需求池 | `requirement.edit.self` | 编辑需求基础信息 | Y | Y | C | Y | N | N | self |
| 需求池 | `requirement.submit_review.self` | 发起评审 | Y | Y | C | Y | N | N | self |
| 需求池 | `requirement.review.create.project` | 创建评审记录 | Y | Y | Y | C | N | N | project |
| 需求池 | `requirement.review.decide.project` | 给出评审结论 | Y | Y | Y | C | N | N | project |
| 需求池 | `requirement.status.transition.project` | 推进需求状态 | Y | Y | Y | Y | N | N | project |
| 需求池 | `requirement.execution.generate.project` | 批量生成执行 | Y | Y | Y | C | N | N | project |
| 需求池 | `requirement.link_execution.project` | 关联已有执行 | Y | Y | Y | C | N | N | project |
| 需求池 | `requirement.export.project` | 导出需求列表 | Y | Y | Y | C | N | C | project |
| 项目 | `project.view.related` | 查看项目列表和详情 | Y | Y | Y | C | C | C | related |
| 项目 | `project.create.org` | 新建项目 | Y | Y | C | N | N | N | org |
| 项目 | `project.edit.project` | 编辑项目信息 | Y | Y | Y | N | N | N | project |
| 项目 | `project.member.manage.project` | 管理项目成员 | Y | Y | Y | N | N | N | project |
| 项目 | `project.export.project` | 导出项目列表 | Y | Y | Y | N | N | C | project |
| 执行 | `execution.view.related` | 查看执行列表/详情 | Y | Y | Y | C | Y | C | related |
| 执行 | `execution.create.project` | 创建根执行 | Y | Y | Y | C | N | N | project |
| 执行 | `execution.child_create.project` | 在执行下创建子执行 | Y | Y | Y | C | C | N | project |
| 执行 | `execution.edit.project` | 编辑执行基础字段 | Y | Y | Y | C | C | N | project |
| 执行 | `execution.assign.project` | 指派负责人 | Y | Y | Y | N | N | N | project |
| 执行 | `execution.status.transition.project` | 执行状态流转 | Y | Y | Y | C | C | N | project |
| 执行 | `execution.progress.edit.self` | 维护实际进度 | Y | Y | Y | C | C | N | self |
| 执行 | `execution.plan.edit.project` | 修改计划开始/结束时间 | Y | Y | Y | N | C | N | project |
| 执行 | `execution.dependency.edit.project` | 维护前置/后置依赖 | Y | Y | Y | N | C | N | project |
| 执行 | `execution.delete.project` | 删除或关闭执行 | Y | Y | Y | N | N | N | project |
| 执行 | `execution.comment.create.related` | 发表评论与@提醒 | Y | Y | Y | C | Y | N | related |
| 执行 | `execution.attachment.upload.related` | 上传附件 | Y | Y | Y | C | Y | N | related |
| 执行 | `execution.worklog.create.self` | 填写工作日志/耗时 | Y | Y | Y | C | Y | N | self |
| 执行 | `execution.worklog.view.related` | 查看工作日志 | Y | Y | Y | C | Y | C | related |
| 执行 | `execution.gantt.view.project` | 查看执行甘特 | Y | Y | Y | C | C | C | project |
| 日常执行 | `daily.view.self` | 查看日常执行 | Y | Y | Y | Y | Y | C | self |
| 日常执行 | `daily.create.self` | 创建日常执行 | Y | Y | Y | Y | Y | N | self |
| 日常执行 | `daily.edit.self` | 编辑日常执行 | Y | Y | Y | Y | Y | N | self |
| 日常执行 | `daily.status.transition.self` | 更新日常执行状态 | Y | Y | Y | Y | Y | N | self |
| 日常执行 | `daily.exclude_report.self` | 设置不纳入汇报 | Y | Y | Y | Y | Y | N | self |
| 缺陷 | `bug.view.project` | 查看缺陷 | Y | Y | Y | C | C | C | project |
| 缺陷 | `bug.create.project` | 创建缺陷草稿 | Y | Y | Y | N | C | N | project |
| 缺陷 | `bug.batch_edit.project` | 批量编辑缺陷 | Y | Y | Y | N | C | N | project |
| 缺陷 | `bug.submit.project` | 统一提交缺陷 | Y | Y | Y | N | C | N | project |
| 缺陷 | `bug.status.transition.project` | 更新缺陷状态 | Y | Y | Y | N | C | N | project |
| 甘特 | `schedule.team.view.project` | 查看团队甘特 | Y | Y | Y | N | C | C | project |
| 甘特 | `schedule.conflict.view.project` | 查看冲突汇总 | Y | Y | Y | N | C | C | project |
| 甘特 | `schedule.edit.project` | 通过表单修改排期 | Y | Y | Y | N | C | N | project |
| 报告 | `report.daily.generate.self` | 生成日报 | Y | Y | Y | Y | Y | N | self |
| 报告 | `report.weekly.generate.self` | 生成周报 | Y | Y | Y | Y | Y | N | self |
| 报告 | `report.edit.self` | 编辑本人报告草稿 | Y | Y | Y | Y | Y | N | self |
| 报告 | `report.export.self` | 导出本人报告 | Y | Y | Y | Y | Y | C | self |
| 报告 | `report.manage.view.project` | 查看管理员统计视图 | Y | Y | Y | N | N | C | project |
| 报告 | `report.manage.drilldown.project` | 下钻成员工作内容 | Y | Y | Y | N | N | N | project |
| 通知 | `notification.view.self` | 查看站内通知 | Y | Y | Y | Y | Y | N | self |
| 通知 | `notification.send.project` | 触发业务通知 | Y | Y | Y | C | C | N | project |
| 系统设置 | `settings.member.manage.org` | 管理组织成员 | Y | Y | N | N | N | N | org |
| 系统设置 | `settings.role.manage.org` | 管理角色模板 | Y | Y | N | N | N | N | org |
| 系统设置 | `settings.policy.manage.org` | 管理权限策略 | Y | Y | N | N | N | N | org |
| 系统设置 | `settings.dictionary.view.org` | 查看字典配置 | Y | Y | C | N | N | N | org |
| 系统设置 | `settings.dictionary.manage.org` | 管理字典配置 | Y | Y | N | N | N | N | org |
| 系统设置 | `settings.workflow.view.org` | 查看流程模板 | Y | Y | C | N | N | N | org |
| 系统设置 | `settings.workflow.manage.org` | 管理流程模板 | Y | Y | N | N | N | N | org |

## 6. 条件权限补充说明

### 6.1 requirement_owner
- 可创建、编辑、推进本人负责或本人创建的需求。
- 可发起评审，也可在被授权场景下参与评审结论录入。
- 可查看由本人需求生成的执行，但默认不拥有执行指派、删除、项目成员管理等权限。

### 6.2 execution_member
- 可查看与本人相关的执行、日常执行、工作日志、报告。
- 可在被分配的执行或参与的项目中新增子执行、更新状态、填写进度和工作日志。
- 不可创建项目、管理组织成员、修改全局权限策略。

### 6.3 read_only
- 可查看被授权范围内的需求、项目、执行、报表。
- 默认不拥有任何写权限。
- 如需导出能力，建议单独授予 `requirement.export.project`、`project.export.project`、`report.export.self` 等权限点。

### 6.4 project_admin
- 其权限边界默认以“所管理项目”为范围，不天然拥有组织级管理权限。
- 项目管理员可管理项目成员、执行排期、缺陷处理、项目维度报表。
- 若兼任需求负责人或执行成员，可叠加对应角色权限。

## 7. 前后端落地建议
- 前端菜单路由建议绑定页面权限编码，例如 `requirements.view.related`。
- 页面内按钮建议绑定动作权限编码，例如 `requirement.execution.generate.project`。
- 后端中间件负责登录态校验，业务 Service 层负责 scope 判定与状态合法性校验。
- 角色不建议直接写死在前端，应由后端返回权限点列表或策略表达式。
- 对批量接口，权限校验需逐条验证目标数据是否在 scope 内。

## 8. 测试建议
- 为每个页面验证：菜单是否可见、直接输入 URL 是否可进入、接口是否返回正确数据范围。
- 为每个关键动作验证：按钮是否显示、无权限时后端是否返回 403、越权对象是否被拦截。
- 为条件权限验证：同角色在不同项目、不同创建者、不同负责人关系下的结果是否一致。
- 为叠加角色验证：一个用户同时拥有 `project_admin + execution_member` 时，权限是否按并集生效。

## 9. 后续可继续补充
- 权限点与接口路径映射表。
- 权限点与页面按钮映射表。
- 默认角色初始化脚本所需种子数据。
- 字段级权限扩展设计。
