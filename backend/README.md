# Backend

Lightweight PHP backend for the PM prototype.

## What it does

- Serves JSON APIs under `/api/v1`
- Provides demo authentication with per-account tokens and permission summaries
- Stores demo data in `backend/storage/data/*.json`
- Supports requirements, projects, executions, tasks, worklogs, daily tasks, bugs, schedules, reports, and settings member-management endpoints

## Key Files

- `public/index.php`: request entry
- `route/api.php`: route definitions
- `app/controller/`: HTTP controllers
- `app/support/`: request, response, auth, authorization, router, and JSON storage helpers
- `storage/data/`: demo data

## Run Locally

From the repository root:

```powershell
.\serve-backend.cmd
```

Or with PHP directly:

```powershell
php -S 127.0.0.1:8000 -t backend\public backend\public\index.php
```

## Lint

```powershell
.\lint-backend.cmd
```

## Notes

- This is a prototype backend, not a production ThinkPHP application yet.
- Data is persisted in JSON files for speed of iteration.
- Auth and permissions are intentionally simplified for local demo use.
- Current authorization is enforced at route level, with deeper record-level scope checks still to be added.