<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\Auth;
use App\Support\JsonStore;
use App\Support\RecordScope;
use App\Support\Request;
use App\Support\Response;

final class SystemController
{
    public function summary(Request $request, array $params): Response
    {
        $store = new JsonStore();
        $scope = new RecordScope($request, $store);
        $requirements = $scope->filterRequirements($store->all('requirements'));
        $projects = $scope->filterProjects($store->all('projects'));
        $executions = $scope->filterExecutions($store->all('executions'));
        $dailyTasks = $scope->filterDailyTasks($store->all('daily_tasks'));
        $bugs = $scope->filterBugs($store->all('bugs'));
        $users = $store->all('users');
        $today = date('Y-m-d');
        $currentUser = Auth::currentUser($request);
        $currentUserName = (string) (($currentUser['name'] ?? 'Wang Jun'));
        $permissions = is_array($currentUser['permissions'] ?? null) ? $currentUser['permissions'] : [];

        $myExecutions = array_values(array_filter(
            $executions,
            static fn (array $item): bool => (string) ($item['owner_name'] ?? '') === $currentUserName
        ));
        $dueTodayCount = count(array_filter(
            $executions,
            static fn (array $item): bool => (string) ($item['plan_end'] ?? '') === $today
        )) + count(array_filter(
            $dailyTasks,
            static fn (array $item): bool => (string) ($item['due_at'] ?? '') === $today && !($item['exclude_from_report'] ?? false)
        ));
        $blockedCount = count(array_filter(
            $executions,
            static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Blocked'
        ));
        $reportsReady = count(array_filter(
            $dailyTasks,
            static fn (array $item): bool => !($item['exclude_from_report'] ?? false) && (string) ($item['status'] ?? '') !== 'Done'
        ));
        $openBugs = count(array_filter(
            $bugs,
            static fn (array $item): bool => !in_array((string) ($item['status'] ?? ''), ['Resolved', 'Closed'], true)
        ));
        $memberCount = in_array('settings.member.manage.org', $permissions, true) ? count($users) : 1;

        return Response::success([
            'auth_mode' => 'password_login',
            'permission_mode' => 'rbac_route_guard_with_record_scope',
            'my_executions' => count($myExecutions),
            'due_today' => $dueTodayCount,
            'blocked' => $blockedCount,
            'reports_ready' => $reportsReady,
            'metrics' => [
                'requirements' => count($requirements),
                'projects' => count($projects),
                'executions' => count($executions),
                'bugs' => $openBugs,
                'members' => $memberCount,
            ],
        ], $request->requestId);
    }
}
