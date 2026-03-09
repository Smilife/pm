<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class SystemController
{
    public function summary(Request $request, array $params): Response
    {
        $store = new JsonStore();
        $requirements = $store->all('requirements');
        $projects = $store->all('projects');
        $executions = $store->all('executions');
        $dailyTasks = $store->all('daily_tasks');
        $users = $store->all('users');
        $today = date('Y-m-d');
        $currentUser = (string) (($users[0]['name'] ?? 'Wang Jun'));

        $myExecutions = array_values(array_filter(
            $executions,
            static fn (array $item): bool => (string) ($item['owner_name'] ?? '') === $currentUser
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

        return Response::success([
            'auth_mode' => 'password_login',
            'permission_mode' => 'rbac_abac',
            'my_executions' => count($myExecutions),
            'due_today' => $dueTodayCount,
            'blocked' => $blockedCount,
            'reports_ready' => $reportsReady,
            'metrics' => [
                'requirements' => count($requirements),
                'projects' => count($projects),
                'executions' => count($executions),
            ],
        ], $request->requestId);
    }
}