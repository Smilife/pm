# PM

一个面向内部研发团队的项目管理平台原型，覆盖从需求、评审、排期、执行、缺陷到日报周报的核心协同链路。

## 项目简介

这个仓库包含一套可以直接运行的全栈原型，目标是把研发项目管理里最常见的几条主线串起来：

- 需求录入、成熟度检查与评审
- 项目管理与执行跟踪
- 子任务、工时日志、日常事项
- 缺陷管理与批量提交流程
- 日报、周报自动生成
- 团队甘特图与执行甘特图
- 多账号登录、权限感知导航与后端鉴权
- 组织设置中心与成员管理

当前版本定位为 `V1 原型 / 演示版`，适合产品演示、流程验证和后续继续迭代，不是直接上线的生产版本。

## 技术栈

### 前端

- React 18
- TypeScript
- Vite
- Ant Design 5
- TanStack Query
- Zustand
- React Router

### 后端

- PHP 8.3
- 轻量自定义路由与控制器
- 基于 JSON 文件的演示数据存储

## 当前能力

- 多账号登录页，支持管理员、执行成员、只读成员演示账号
- 前端路由守卫、按钮显隐和后端权限校验
- 工作台首页，聚合执行、缺陷和报表入口
- 需求列表、详情、编辑、评审、批量生成执行
- 项目列表与创建
- 执行列表、详情、编辑、子任务管理、工时日志
- 缺陷列表、详情、创建、编辑、批量提交
- 日常事项创建、编辑、状态流转、是否纳入日报
- 日报生成
- 周报生成与工时亮点汇总
- 团队甘特图与执行甘特图
- 设置中心成员管理，以及角色、策略、字典、流程的总览
- 核心接口已补充记录级范围校验
- 产品、架构、权限、接口等配套文档

## 仓库结构

```text
pm/
  docs/
    api/
    decisions/
    product/
    technical/
  frontend/
  backend/
  php.cmd
  serve-backend.cmd
  lint-backend.cmd
```

## 快速开始

### 1. 启动后端

在仓库根目录执行：

```powershell
.\serve-backend.cmd
```

如果你已经全局安装了 PHP，也可以直接运行：

```powershell
php -S 127.0.0.1:8000 -t backend\public backend\public\index.php
```

### 2. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

Vite 开发服务器会把接口请求代理到 `http://127.0.0.1:8000`。

### 3. 登录演示账号

```text
管理员：wangjun@example.com / demo123
执行成员：chenjing@example.com / demo123
只读成员：sunmei@example.com / demo123
```

## 常用命令

### 前端

```powershell
cd frontend
npm run dev
npm run build
```

### 后端

```powershell
.\lint-backend.cmd
.\serve-backend.cmd
```

## 文档索引

- 需求拆解：[docs/product/requirements_breakdown_v1.md](docs/product/requirements_breakdown_v1.md)
- 权限矩阵：[docs/product/permission_matrix_v1.md](docs/product/permission_matrix_v1.md)
- 权限与接口映射：[docs/api/permission_api_mapping_v1.md](docs/api/permission_api_mapping_v1.md)
- OpenAPI 草案：[docs/api/openapi_v1.yaml](docs/api/openapi_v1.yaml)
- 架构说明：[docs/technical/architecture_v1.md](docs/technical/architecture_v1.md)
- 技术选型 ADR：[docs/decisions/ADR-0001-tech-stack.md](docs/decisions/ADR-0001-tech-stack.md)

## 当前限制

- 后端数据仍然使用 JSON 文件，而不是 MySQL 或其他正式数据库。
- 登录与鉴权仍然是本地演示账号模型，不是正式的统一身份认证体系。
- 记录级范围校验已经覆盖核心业务模块，但仍然属于原型级实现。
- 设置中心目前只有成员管理支持真实编辑，角色、字典、流程仍以总览为主。
- 前端生产构建仍有较大的 chunk 警告，后续需要做路由级拆包。
- 通知中心、钉钉集成、附件、评论、导出等能力还没有接入。

## 下一步建议

- 将 JSON 存储替换为正式数据库层
- 继续完善设置中心的角色、字典、流程编辑能力
- 增加通知中心与钉钉集成
- 补齐系统化测试，而不只是 lint 和烟测
- 对前端进行按路由拆包与性能优化

## 许可证

当前仓库还没有单独的许可证文件；如果后续需要公开分发或对外使用，建议先补齐 License。