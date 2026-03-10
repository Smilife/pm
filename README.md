# PM

A lightweight team project management platform prototype covering the full flow from requirements to execution, defects, reports, and organization settings.

## Overview

This repository contains a working full-stack prototype for an internal R and D management platform. It focuses on the core delivery loop:

- Requirement intake and review
- Project and execution tracking
- Child tasks, worklogs, and daily tasks
- Bug tracking and submission flow
- Daily and weekly report generation
- Team and execution gantt views
- Multi-account demo login with permission-aware navigation
- Organization settings overview for members, roles, policies, dictionaries, and workflows

The current version is designed as a practical V1 prototype rather than a production-ready deployment.

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Ant Design 5
- TanStack Query
- Zustand
- React Router

### Backend

- PHP 8.3
- Lightweight custom router and controllers
- JSON file storage for demo data

## Current Features

- Multi-account login page for admin, execution-member, and read-only demos
- Permission-aware app shell, route guards, and route-level backend permission checks
- Workspace dashboard with execution and bug focus areas
- Requirement list, detail, edit, review, and batch execution generation
- Project list and creation
- Execution list, detail, edit, child task management, and worklogs
- Bug list, detail, create, edit, and batch submit flow
- Daily task creation, edit, status update, and report inclusion toggle
- Daily report generation
- Weekly report generation with worklog highlights
- Team gantt and execution gantt views
- Settings center for members, roles, policy bundles, dictionaries, and workflows
- Product, architecture, permission, and API documentation

## Repository Structure

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

## Quick Start

### 1. Start the backend

From the repository root:

```powershell
.\serve-backend.cmd
```

If you already have PHP installed globally, this also works:

```powershell
php -S 127.0.0.1:8000 -t backend\public backend\public\index.php
```

### 2. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server proxies API requests to `http://127.0.0.1:8000`.

### 3. Sign in

Demo accounts:

```text
Admin: wangjun@example.com / demo123
Execution member: chenjing@example.com / demo123
Read only: sunmei@example.com / demo123
```

## Useful Commands

### Frontend

```powershell
cd frontend
npm run dev
npm run build
```

### Backend

```powershell
.\lint-backend.cmd
.\serve-backend.cmd
```

## API and Docs

- Product breakdown: [docs/product/requirements_breakdown_v1.md](docs/product/requirements_breakdown_v1.md)
- Permission matrix: [docs/product/permission_matrix_v1.md](docs/product/permission_matrix_v1.md)
- Permission to API mapping: [docs/api/permission_api_mapping_v1.md](docs/api/permission_api_mapping_v1.md)
- OpenAPI draft: [docs/api/openapi_v1.yaml](docs/api/openapi_v1.yaml)
- Architecture notes: [docs/technical/architecture_v1.md](docs/technical/architecture_v1.md)
- Tech stack ADR: [docs/decisions/ADR-0001-tech-stack.md](docs/decisions/ADR-0001-tech-stack.md)

## Current Limitations

- The backend uses JSON files instead of MySQL.
- Authentication is still a local demo token flow, even though it now switches by logged-in account.
- Permission control is implemented at route level, but record-level scope checks are not complete yet.
- The frontend production build currently reports a large chunk warning.
- Some original planning documents were drafted before implementation and may describe a broader future scope than the code currently covers.

## Next Suggested Steps

- Add record-level backend scope checks for project, requirement, and execution ownership
- Replace JSON storage with a real database layer
- Add editable settings actions instead of read-only overview cards
- Add notification center and DingTalk integration flows
- Split frontend bundles by route

## License

This repository currently has no explicit license file. Add one before wider distribution if needed.