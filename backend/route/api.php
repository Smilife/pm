<?php

declare(strict_types=1);

use App\Controller\AuthController;
use App\Controller\BugController;
use App\Controller\DailyTaskController;
use App\Controller\ExecutionController;
use App\Controller\PerformanceController;
use App\Controller\PermissionController;
use App\Controller\ProjectController;
use App\Controller\ReportController;
use App\Controller\RequirementController;
use App\Controller\ScheduleController;
use App\Controller\SettingsController;
use App\Controller\SystemController;
use App\Controller\WorklogController;

return [
    ['POST', '/auth/login', [AuthController::class, 'login']],
    ['POST', '/auth/logout', [AuthController::class, 'logout']],
    ['GET', '/auth/me', [AuthController::class, 'me']],
    ['GET', '/auth/permissions', [AuthController::class, 'permissions']],
    ['GET', '/system/summary', [SystemController::class, 'summary']],

    ['GET', '/requirements', [RequirementController::class, 'index']],
    ['POST', '/requirements', [RequirementController::class, 'store']],
    ['GET', '/requirements/{id}', [RequirementController::class, 'show']],
    ['PATCH', '/requirements/{id}', [RequirementController::class, 'update']],
    ['POST', '/requirements/{id}/actions/submit-review', [RequirementController::class, 'submitForReview']],
    ['POST', '/requirements/{id}/reviews', [RequirementController::class, 'storeReview']],
    ['GET', '/requirements/{id}/reviews', [RequirementController::class, 'listReviews']],
    ['POST', '/requirements/batch-generate-executions', [RequirementController::class, 'batchGenerateExecutions']],
    ['POST', '/requirements/batch-generate-tasks', [RequirementController::class, 'batchGenerateExecutions']],

    ['GET', '/projects', [ProjectController::class, 'index']],
    ['POST', '/projects', [ProjectController::class, 'store']],
    ['GET', '/projects/{id}', [ProjectController::class, 'show']],
    ['PATCH', '/projects/{id}', [ProjectController::class, 'update']],

    ['GET', '/executions', [ExecutionController::class, 'index']],
    ['POST', '/executions', [ExecutionController::class, 'store']],
    ['GET', '/executions/{id}', [ExecutionController::class, 'show']],
    ['PATCH', '/executions/{id}', [ExecutionController::class, 'update']],
    ['GET', '/executions/{id}/tasks', [ExecutionController::class, 'listTasks']],
    ['GET', '/executions/{id}/worklogs', [WorklogController::class, 'listByExecution']],

    ['GET', '/tasks', [ExecutionController::class, 'taskIndex']],
    ['POST', '/tasks', [ExecutionController::class, 'taskStore']],
    ['GET', '/tasks/{id}', [ExecutionController::class, 'taskShow']],
    ['PATCH', '/tasks/{id}', [ExecutionController::class, 'taskUpdate']],

    ['GET', '/worklogs', [WorklogController::class, 'index']],
    ['GET', '/performance/members', [PerformanceController::class, 'members']],
    ['POST', '/worklogs', [WorklogController::class, 'store']],
    ['GET', '/worklogs/{id}', [WorklogController::class, 'show']],
    ['PATCH', '/worklogs/{id}', [WorklogController::class, 'update']],

    ['GET', '/daily-tasks', [DailyTaskController::class, 'index']],
    ['POST', '/daily-tasks', [DailyTaskController::class, 'store']],
    ['GET', '/daily-tasks/{id}', [DailyTaskController::class, 'show']],
    ['PATCH', '/daily-tasks/{id}', [DailyTaskController::class, 'update']],

    ['GET', '/bugs', [BugController::class, 'index']],
    ['POST', '/bugs', [BugController::class, 'store']],
    ['GET', '/bugs/{id}', [BugController::class, 'show']],
    ['PATCH', '/bugs/{id}', [BugController::class, 'update']],
    ['POST', '/bugs/batch-submit', [BugController::class, 'batchSubmit']],

    ['GET', '/settings/members', [SettingsController::class, 'members']],
    ['POST', '/settings/members', [SettingsController::class, 'storeMember']],
    ['PATCH', '/settings/members/{id}', [SettingsController::class, 'updateMember']],
    ['GET', '/settings/roles', [SettingsController::class, 'roles']],
    ['POST', '/settings/roles', [SettingsController::class, 'storeRole']],
    ['PATCH', '/settings/roles/{id}', [SettingsController::class, 'updateRole']],
    ['DELETE', '/settings/roles/{id}', [SettingsController::class, 'destroyRole']],
    ['GET', '/settings/policies', [SettingsController::class, 'policies']],
    ['POST', '/settings/policies', [SettingsController::class, 'storePolicy']],
    ['PATCH', '/settings/policies/{id}', [SettingsController::class, 'updatePolicy']],
    ['DELETE', '/settings/policies/{id}', [SettingsController::class, 'destroyPolicy']],
    ['GET', '/settings/dictionaries', [SettingsController::class, 'dictionaries']],
    ['POST', '/settings/dictionaries', [SettingsController::class, 'storeDictionary']],
    ['PATCH', '/settings/dictionaries/{id}', [SettingsController::class, 'updateDictionary']],
    ['DELETE', '/settings/dictionaries/{id}', [SettingsController::class, 'destroyDictionary']],
    ['GET', '/settings/workflows', [SettingsController::class, 'workflows']],
    ['POST', '/settings/workflows', [SettingsController::class, 'storeWorkflow']],
    ['PATCH', '/settings/workflows/{id}', [SettingsController::class, 'updateWorkflow']],
    ['DELETE', '/settings/workflows/{id}', [SettingsController::class, 'destroyWorkflow']],

    ['GET', '/schedules/team-gantt', [ScheduleController::class, 'teamGantt']],
    ['GET', '/schedules/execution-gantt', [ScheduleController::class, 'executionGantt']],

    ['POST', '/reports/daily/generate', [ReportController::class, 'generateDaily']],
    ['POST', '/reports/weekly/generate', [ReportController::class, 'generateWeekly']],

    ['POST', '/permissions/check', [PermissionController::class, 'check']],
];