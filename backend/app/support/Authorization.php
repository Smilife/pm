<?php

declare(strict_types=1);

namespace App\Support;

final class Authorization
{
    private const ROUTE_PERMISSIONS = [
        ['GET', '/requirements', 'requirement.view.related'],
        ['GET', '/requirements/{id}', 'requirement.view.related'],
        ['GET', '/requirements/{id}/reviews', 'requirement.view.related'],
        ['POST', '/requirements', 'requirement.create.project'],
        ['PATCH', '/requirements/{id}', 'requirement.create.project'],
        ['POST', '/requirements/{id}/actions/submit-review', 'requirement.review.create.project'],
        ['POST', '/requirements/{id}/reviews', 'requirement.review.create.project'],
        ['POST', '/requirements/batch-generate-executions', 'requirement.execution.generate.project'],
        ['POST', '/requirements/batch-generate-tasks', 'requirement.execution.generate.project'],

        ['GET', '/projects', 'project.view.related'],
        ['GET', '/projects/{id}', 'project.view.related'],
        ['POST', '/projects', 'project.create.org'],
        ['PATCH', '/projects/{id}', 'project.create.org'],

        ['GET', '/executions', 'execution.view.related'],
        ['GET', '/executions/{id}', 'execution.view.related'],
        ['GET', '/executions/{id}/tasks', 'execution.view.related'],
        ['POST', '/executions', 'execution.create.project'],
        ['PATCH', '/executions/{id}', 'execution.create.project'],

        ['GET', '/tasks', 'execution.view.related'],
        ['GET', '/tasks/{id}', 'execution.view.related'],
        ['POST', '/tasks', 'execution.task.update.related'],
        ['PATCH', '/tasks/{id}', 'execution.task.update.related'],

        ['GET', '/worklogs', 'worklog.view.related'],
        ['GET', '/worklogs/{id}', 'worklog.view.related'],
        ['GET', '/executions/{id}/worklogs', 'worklog.view.related'],
        ['POST', '/worklogs', 'worklog.create.self'],
        ['PATCH', '/worklogs/{id}', 'worklog.update.self'],

        ['GET', '/daily-tasks', 'daily_task.view.self'],
        ['GET', '/daily-tasks/{id}', 'daily_task.view.self'],
        ['POST', '/daily-tasks', 'daily_task.create.self'],
        ['PATCH', '/daily-tasks/{id}', 'daily_task.update.self'],

        ['GET', '/bugs', 'bug.view.related'],
        ['GET', '/bugs/{id}', 'bug.view.related'],
        ['POST', '/bugs', 'bug.create.related'],
        ['PATCH', '/bugs/{id}', 'bug.update.related'],
        ['POST', '/bugs/batch-submit', 'bug.submit.related'],

        ['GET', '/settings/members', 'settings.member.manage.org'],
        ['GET', '/settings/roles', 'settings.role.manage.org'],
        ['GET', '/settings/policies', 'settings.policy.manage.org'],
        ['GET', '/settings/dictionaries', 'settings.dictionary.view.org'],
        ['GET', '/settings/workflows', 'settings.workflow.view.org'],

        ['GET', '/schedules/team-gantt', 'schedule.view.related'],
        ['GET', '/schedules/execution-gantt', 'schedule.view.related'],

        ['POST', '/reports/daily/generate', 'report.daily.generate.self'],
        ['POST', '/reports/weekly/generate', 'report.weekly.generate.self'],
    ];

    public static function authorizeRequest(Request $request): ?Response
    {
        $requiredPermission = self::requiredPermission($request);

        if ($requiredPermission === null) {
            return null;
        }

        if (!in_array($requiredPermission, self::permissionsForRequest($request), true)) {
            return Response::error(403, 'forbidden', ['required_permission' => $requiredPermission], $request->requestId);
        }

        return null;
    }

    public static function permissionsForRequest(Request $request): array
    {
        $user = Auth::currentUser($request);
        $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return array_values(array_map(static fn ($item): string => (string) $item, $permissions));
    }

    private static function requiredPermission(Request $request): ?string
    {
        foreach (self::ROUTE_PERMISSIONS as [$method, $pattern, $permission]) {
            if ($request->method !== $method) {
                continue;
            }

            if (self::matchesPattern($pattern, $request->path)) {
                return $permission;
            }
        }

        return null;
    }

    private static function matchesPattern(string $pattern, string $path): bool
    {
        $regex = '#^' . preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';

        return (bool) preg_match($regex, $path);
    }
}
