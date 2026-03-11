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
        $worklogs = $scope->filterWorklogs($store->all('worklogs'));
        $users = $store->all('users');
        $today = date('Y-m-d');
        $dueSoonBoundary = date('Y-m-d', strtotime('+3 days'));
        $currentUser = Auth::currentUser($request);
        $currentUserName = (string) (($currentUser['name'] ?? 'Wang Jun'));
        $permissions = is_array($currentUser['permissions'] ?? null) ? $currentUser['permissions'] : [];

        $myExecutions = array_values(array_filter(
            $executions,
            fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $currentUserName)
        ));
        $dueTodayCount = count(array_filter(
            $executions,
            fn (array $item): bool => (string) ($item['plan_end'] ?? '') === $today && !$this->isExecutionClosed((string) ($item['status'] ?? ''))
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
        $openBugCount = count(array_filter(
            $bugs,
            fn (array $item): bool => $this->isBugOpen((string) ($item['status'] ?? ''))
        ));

        $projectOverview = $this->buildProjectOverview($projects, $executions, $bugs, $worklogs, $today, $dueSoonBoundary);
        $memberOverview = $this->buildMemberOverview(
            $scope,
            $permissions,
            $users,
            $projects,
            $requirements,
            $executions,
            $dailyTasks,
            $bugs,
            $worklogs,
            $currentUserName,
            $today
        );

        $overview = [
            'project_count' => count($projectOverview),
            'at_risk_project_count' => count(array_filter(
                $projectOverview,
                static fn (array $item): bool => (string) ($item['health'] ?? 'healthy') === 'risk'
            )),
            'member_count' => count($memberOverview),
            'active_member_count' => count(array_filter(
                $memberOverview,
                static fn (array $item): bool => in_array((string) ($item['focus_status'] ?? 'idle'), ['active', 'watch', 'risk'], true)
            )),
            'attention_member_count' => count(array_filter(
                $memberOverview,
                static fn (array $item): bool => in_array((string) ($item['focus_status'] ?? 'idle'), ['watch', 'risk'], true)
            )),
            'open_bug_count' => $openBugCount,
        ];

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
                'bugs' => $openBugCount,
                'members' => count($memberOverview),
            ],
            'overview' => $overview,
            'project_overview' => array_values($projectOverview),
            'member_overview' => array_values($memberOverview),
        ], $request->requestId);
    }

    private function buildProjectOverview(array $projects, array $executions, array $bugs, array $worklogs, string $today, string $dueSoonBoundary): array
    {
        $items = [];

        foreach ($projects as $project) {
            $projectId = (int) ($project['id'] ?? 0);
            $projectExecutions = array_values(array_filter(
                $executions,
                static fn (array $item): bool => (int) ($item['project_id'] ?? 0) === $projectId
            ));
            $executionIds = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $projectExecutions);
            $projectBugs = array_values(array_filter($bugs, function (array $item) use ($projectId, $executionIds): bool {
                $linkType = (string) ($item['link_type'] ?? 'execution');
                $linkId = (int) ($item['link_id'] ?? 0);

                if ($linkType === 'project') {
                    return $linkId === $projectId;
                }

                return in_array($linkId, $executionIds, true);
            }));
            $projectWorklogs = array_values(array_filter(
                $worklogs,
                static fn (array $item): bool => in_array((int) ($item['execution_id'] ?? 0), $executionIds, true)
            ));
            $blockedExecutionCount = count(array_filter(
                $projectExecutions,
                static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Blocked'
            ));
            $activeExecutionCount = count(array_filter(
                $projectExecutions,
                fn (array $item): bool => !$this->isExecutionClosed((string) ($item['status'] ?? ''))
            ));
            $openBugCount = count(array_filter(
                $projectBugs,
                fn (array $item): bool => $this->isBugOpen((string) ($item['status'] ?? ''))
            ));
            $dueSoonCount = count(array_filter($projectExecutions, function (array $item) use ($today, $dueSoonBoundary): bool {
                $planEnd = (string) ($item['plan_end'] ?? '');
                return $planEnd !== ''
                    && $planEnd >= $today
                    && $planEnd <= $dueSoonBoundary
                    && !$this->isExecutionClosed((string) ($item['status'] ?? ''));
            }));
            $overdueCount = count(array_filter($projectExecutions, function (array $item) use ($today): bool {
                $planEnd = (string) ($item['plan_end'] ?? '');
                return $planEnd !== ''
                    && $planEnd < $today
                    && !$this->isExecutionClosed((string) ($item['status'] ?? ''));
            }));
            $averageProgress = 0;
            if ($projectExecutions !== []) {
                $averageProgress = (int) round(array_sum(array_map(
                    static fn (array $item): int => (int) ($item['actual_progress'] ?? 0),
                    $projectExecutions
                )) / count($projectExecutions));
            }
            $baseRiskCount = (int) ($project['risk_count'] ?? 0);
            $riskCount = max($baseRiskCount, $blockedExecutionCount + $openBugCount + $overdueCount);
            $health = 'healthy';
            if ((string) ($project['status'] ?? 'Active') === 'Risk' || $blockedExecutionCount > 0 || $openBugCount >= 2 || $overdueCount > 0) {
                $health = 'risk';
            } elseif ($dueSoonCount > 0 || $openBugCount > 0 || $riskCount > 0) {
                $health = 'watch';
            }

            $items[] = [
                'id' => $projectId,
                'name' => (string) ($project['name'] ?? ''),
                'code' => (string) ($project['code'] ?? ''),
                'owner_name' => (string) ($project['owner_name'] ?? ''),
                'status' => (string) ($project['status'] ?? 'Active'),
                'health' => $health,
                'execution_count' => count($projectExecutions),
                'active_execution_count' => $activeExecutionCount,
                'blocked_execution_count' => $blockedExecutionCount,
                'open_bug_count' => $openBugCount,
                'risk_count' => $riskCount,
                'average_progress' => $averageProgress,
                'due_soon_count' => $dueSoonCount,
                'overdue_count' => $overdueCount,
                'last_activity_at' => $this->latestDateTime(array_merge(
                    array_map(static fn (array $item): string => (string) ($item['work_date'] ?? ''), $projectWorklogs),
                    array_map(static fn (array $item): string => (string) ($item['updated_at'] ?? ($item['submitted_at'] ?? '')), $projectBugs)
                )),
            ];
        }

        usort($items, function (array $left, array $right): int {
            $healthOrder = ['risk' => 0, 'watch' => 1, 'healthy' => 2];
            $leftOrder = $healthOrder[(string) ($left['health'] ?? 'healthy')] ?? 99;
            $rightOrder = $healthOrder[(string) ($right['health'] ?? 'healthy')] ?? 99;
            if ($leftOrder !== $rightOrder) {
                return $leftOrder <=> $rightOrder;
            }

            $leftRisk = (int) ($left['risk_count'] ?? 0);
            $rightRisk = (int) ($right['risk_count'] ?? 0);
            if ($leftRisk !== $rightRisk) {
                return $rightRisk <=> $leftRisk;
            }

            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });

        return $items;
    }

    private function buildMemberOverview(
        RecordScope $scope,
        array $permissions,
        array $users,
        array $projects,
        array $requirements,
        array $executions,
        array $dailyTasks,
        array $bugs,
        array $worklogs,
        string $currentUserName,
        string $today,
    ): array {
        $visibleUsers = $this->visibleUsersForOverview(
            $scope,
            $permissions,
            $users,
            $projects,
            $requirements,
            $executions,
            $dailyTasks,
            $bugs,
            $worklogs,
            $currentUserName
        );
        $weekStart = date('Y-m-d', strtotime('-6 days'));
        $items = [];

        foreach ($visibleUsers as $member) {
            $memberName = (string) ($member['name'] ?? '');
            $memberExecutions = array_values(array_filter(
                $executions,
                fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
            ));
            $memberDailyTasks = array_values(array_filter(
                $dailyTasks,
                fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
            ));
            $memberBugs = array_values(array_filter($bugs, function (array $item) use ($memberName): bool {
                return $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
                    || $this->matchesName((string) ($item['reporter_name'] ?? ''), $memberName);
            }));
            $memberWorklogs = array_values(array_filter(
                $worklogs,
                fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
            ));
            $activeExecutionCount = count(array_filter(
                $memberExecutions,
                fn (array $item): bool => !$this->isExecutionClosed((string) ($item['status'] ?? ''))
            ));
            $blockedExecutionCount = count(array_filter(
                $memberExecutions,
                static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Blocked'
            ));
            $pendingDailyTaskCount = count(array_filter(
                $memberDailyTasks,
                static fn (array $item): bool => !($item['exclude_from_report'] ?? false) && (string) ($item['status'] ?? '') !== 'Done'
            ));
            $openBugCount = count(array_filter(
                $memberBugs,
                fn (array $item): bool => $this->isBugOpen((string) ($item['status'] ?? ''))
            ));
            $hoursThisWeek = round(array_sum(array_map(function (array $item) use ($weekStart, $today): float {
                $workDate = (string) ($item['work_date'] ?? '');
                if ($workDate === '' || $workDate < $weekStart || $workDate > $today) {
                    return 0;
                }

                return (float) ($item['hours'] ?? 0);
            }, $memberWorklogs)), 1);
            $lastActivityAt = $this->latestDateTime(array_merge(
                array_map(static fn (array $item): string => (string) ($item['work_date'] ?? ''), $memberWorklogs),
                array_map(static fn (array $item): string => (string) ($item['due_at'] ?? ''), $memberDailyTasks),
                array_map(static fn (array $item): string => (string) ($item['updated_at'] ?? ($item['submitted_at'] ?? '')), $memberBugs),
                array_map(static fn (array $item): string => (string) ($item['last_login_at'] ?? ''), [$member])
            ));

            $focusStatus = 'idle';
            $focusLabel = '暂无在途事项';
            if ($blockedExecutionCount > 0) {
                $focusStatus = 'risk';
                $focusLabel = '存在阻塞，需协调';
            } elseif ($openBugCount > 0 || $pendingDailyTaskCount >= 2) {
                $focusStatus = 'watch';
                $focusLabel = '待跟进事项较多';
            } elseif ($activeExecutionCount > 0 || $hoursThisWeek > 0) {
                $focusStatus = 'active';
                $focusLabel = '投入中';
            }

            $items[] = [
                'id' => (int) ($member['id'] ?? 0),
                'name' => $memberName,
                'email' => (string) ($member['email'] ?? ''),
                'department' => (string) ($member['department'] ?? 'Unknown'),
                'title' => (string) ($member['title'] ?? 'Team member'),
                'status' => (string) ($member['status'] ?? 'Active'),
                'dingtalk_bound' => (bool) ($member['dingtalk_bound'] ?? false),
                'active_execution_count' => $activeExecutionCount,
                'blocked_execution_count' => $blockedExecutionCount,
                'pending_daily_task_count' => $pendingDailyTaskCount,
                'open_bug_count' => $openBugCount,
                'hours_this_week' => $hoursThisWeek,
                'last_activity_at' => $lastActivityAt,
                'focus_status' => $focusStatus,
                'focus_label' => $focusLabel,
            ];
        }

        usort($items, function (array $left, array $right): int {
            $focusOrder = ['risk' => 0, 'watch' => 1, 'active' => 2, 'idle' => 3];
            $leftOrder = $focusOrder[(string) ($left['focus_status'] ?? 'idle')] ?? 99;
            $rightOrder = $focusOrder[(string) ($right['focus_status'] ?? 'idle')] ?? 99;
            if ($leftOrder !== $rightOrder) {
                return $leftOrder <=> $rightOrder;
            }

            $leftHours = (float) ($left['hours_this_week'] ?? 0);
            $rightHours = (float) ($right['hours_this_week'] ?? 0);
            if ($leftHours !== $rightHours) {
                return $rightHours <=> $leftHours;
            }

            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });

        return $items;
    }

    private function visibleUsersForOverview(
        RecordScope $scope,
        array $permissions,
        array $users,
        array $projects,
        array $requirements,
        array $executions,
        array $dailyTasks,
        array $bugs,
        array $worklogs,
        string $currentUserName,
    ): array {
        if ($scope->isOrgScope() || in_array('settings.member.manage.org', $permissions, true)) {
            return array_values($users);
        }

        $names = [];
        $this->collectName($names, $currentUserName);
        foreach ($projects as $item) {
            $this->collectName($names, (string) ($item['owner_name'] ?? ''));
        }
        foreach ($requirements as $item) {
            $this->collectName($names, (string) ($item['owner_name'] ?? ''));
        }
        foreach ($executions as $item) {
            $this->collectName($names, (string) ($item['owner_name'] ?? ''));
        }
        foreach ($dailyTasks as $item) {
            $this->collectName($names, (string) ($item['owner_name'] ?? ''));
        }
        foreach ($worklogs as $item) {
            $this->collectName($names, (string) ($item['owner_name'] ?? ''));
        }
        foreach ($bugs as $item) {
            $this->collectName($names, (string) ($item['owner_name'] ?? ''));
            $this->collectName($names, (string) ($item['reporter_name'] ?? ''));
        }

        $visibleUsers = [];
        foreach ($users as $user) {
            $normalized = $this->normalizeName((string) ($user['name'] ?? ''));
            if ($normalized !== '' && isset($names[$normalized])) {
                $visibleUsers[] = $user;
                unset($names[$normalized]);
            }
        }

        foreach ($names as $name) {
            $visibleUsers[] = [
                'id' => 0,
                'name' => $name,
                'email' => '',
                'department' => 'Unknown',
                'title' => 'Team member',
                'status' => 'Active',
                'dingtalk_bound' => false,
                'last_login_at' => '',
            ];
        }

        return $visibleUsers;
    }

    private function collectName(array &$names, string $value): void
    {
        $normalized = $this->normalizeName($value);
        if ($normalized === '') {
            return;
        }

        if (!isset($names[$normalized])) {
            $names[$normalized] = trim($value);
        }
    }

    private function latestDateTime(array $values): string
    {
        $latestValue = '';
        $latestTimestamp = 0;

        foreach ($values as $value) {
            $normalizedValue = trim((string) $value);
            if ($normalizedValue === '') {
                continue;
            }

            $timestamp = strtotime($normalizedValue);
            if ($timestamp === false || $timestamp < $latestTimestamp) {
                continue;
            }

            $latestTimestamp = $timestamp;
            $latestValue = $normalizedValue;
        }

        return $latestValue;
    }

    private function isExecutionClosed(string $status): bool
    {
        return in_array($status, ['Done', 'Closed'], true);
    }

    private function isBugOpen(string $status): bool
    {
        return !in_array($status, ['Resolved', 'Closed'], true);
    }

    private function matchesName(string $left, string $right): bool
    {
        $normalizedLeft = $this->normalizeName($left);
        $normalizedRight = $this->normalizeName($right);

        return $normalizedLeft !== '' && $normalizedLeft === $normalizedRight;
    }

    private function normalizeName(string $value): string
    {
        return strtolower(preg_replace('/\s+/', '', trim($value)) ?? '');
    }
}