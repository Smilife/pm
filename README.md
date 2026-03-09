# PM

A lightweight team project management platform prototype covering the full flow from requirements to execution and reports.

## Overview

This repository contains a working full-stack prototype for an internal R and D management platform. It focuses on the core delivery loop:

- Requirement intake and review
- Project and execution tracking
- Child tasks and worklogs
- Daily tasks and auto-generated reports
- Team and execution gantt views
- Login and permission-aware navigation

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

- Login page with demo account
- Permission-aware app shell and route guards
- Workspace dashboard
- Requirement list, detail, edit, review, and batch execution generation
- Project list and creation
- Execution list, detail, edit, child task management, and worklogs
- Daily task creation, edit, status update, and report inclusion toggle
- Daily report generation
- Weekly report generation with worklog highlights
- Team gantt and execution gantt views
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

Demo account:

```text
account: wangjun@example.com
password: demo123
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
- Authentication uses a demo token flow for local development.
- Permission control is implemented in the UI and at the request-entry level, but not yet as full backend RBAC for every business action.
- The frontend production build currently reports a large chunk warning.
- Some original planning documents were drafted before implementation and may describe a broader future scope than the code currently covers.

## Next Suggested Steps

- Add fine-grained backend permission checks per business action
- Replace JSON storage with a real database layer
- Add defect management
- Add system settings and member management
- Split frontend bundles by route

## License

This repository currently has no explicit license file. Add one before wider distribution if needed.