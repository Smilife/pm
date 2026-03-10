# Backend

PM 原型项目的轻量 PHP 后端。

## 主要职责

- 提供 `/api/v1` 下的 JSON API
- 支持多账号演示登录、权限摘要与基础鉴权
- 使用 `backend/storage/data/*.json` 保存演示数据
- 提供需求、项目、执行、子任务、工时、日常事项、缺陷、排期、报表、设置中心等接口
- 为核心业务接口补充记录级范围校验

## 关键目录

- `public/index.php`：请求入口
- `route/api.php`：接口路由定义
- `app/controller/`：控制器
- `app/support/`：请求、响应、鉴权、范围校验、路由、JSON 存储等通用能力
- `storage/data/`：演示数据

## 本地运行

在仓库根目录执行：

```powershell
.\serve-backend.cmd
```

如果本机已经安装了 PHP，也可以直接运行：

```powershell
php -S 127.0.0.1:8000 -t backend\public backend\public\index.php
```

## 语法检查

```powershell
.\lint-backend.cmd
```

## 说明

- 这是一套原型后端，不是正式的 ThinkPHP 生产工程。
- 为了便于快速迭代，当前数据仍然持久化在 JSON 文件里。
- 认证与权限模型仍然是本地演示方案，便于联调和演示。
- 当前已经具备路由级权限和核心记录级范围校验，但仍有继续工程化的空间。