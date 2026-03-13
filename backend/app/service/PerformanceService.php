<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\Auth;
use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class PerformanceService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function members(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        [$start, $end, $dayCount] = $this->resolveRange($request);
        $currentUser = Auth::currentUser($request) ?? [];
        $currentUserName = (string) ($currentUser['name'] ?? '');
        $permissions = is_array($currentUser['permissions'] ?? null) ? $currentUser['permissions'] : [];
        $dashboardMode = $this->isTeamMode($scope, $permissions) ? 'team' : 'personal';

        $projects = $scope->filterProjects($this->store->allProjects());
        $executions = $scope->filterExecutions($this->store->allExecutions());
        $dailyTasks = $scope->filterDailyTasks($this->store->allDailyTasks());
        $worklogs = $scope->filterWorklogs($this->store->allWorklogs());
        $users = $this->store->allUsers();

        $executionProjectMap = [];
        foreach ($executions as $execution) {
            $executionProjectMap[(int) ($execution['id'] ?? 0)] = [
                'project_id' => (int) ($execution['project_id'] ?? 0),
                'project_name' => (string) ($execution['project_name'] ?? ''),
            ];
        }

        $executionLastWorklogDate = [];
        foreach ($worklogs as $worklog) {
            $executionId = (int) ($worklog['execution_id'] ?? 0);
            $workDate = (string) ($worklog['work_date'] ?? '');
            if ($executionId <= 0 || $workDate === '') {
                continue;
            }

            $currentDate = $executionLastWorklogDate[$executionId] ?? '';
            if ($currentDate === '' || $workDate > $currentDate) {
                $executionLastWorklogDate[$executionId] = $workDate;
            }
        }

        $visibleMembers = $this->resolveVisibleMembers(
            $dashboardMode,
            $users,
            $projects,
            $executions,
            $dailyTasks,
            $worklogs,
            $currentUserName
        );

        $ranking = [];
        foreach ($visibleMembers as $member) {
            $item = $this->buildMemberPerformance(
                $member,
                $executions,
                $dailyTasks,
                $worklogs,
                $executionProjectMap,
                $executionLastWorklogDate,
                $start,
                $end,
                $dayCount
            );

            if ($dashboardMode === 'team' && !$this->hasPerformanceSignal($item)) {
                continue;
            }

            $ranking[] = $item;
        }

        usort($ranking, function (array $left, array $right): int {
            $scoreCompare = (int) ($right['score'] ?? 0) <=> (int) ($left['score'] ?? 0);
            if ($scoreCompare !== 0) {
                return $scoreCompare;
            }

            $onTimeCompare = (int) ($right['on_time_rate'] ?? 0) <=> (int) ($left['on_time_rate'] ?? 0);
            if ($onTimeCompare !== 0) {
                return $onTimeCompare;
            }

            $updateCompare = (int) ($right['update_rate'] ?? 0) <=> (int) ($left['update_rate'] ?? 0);
            if ($updateCompare !== 0) {
                return $updateCompare;
            }

            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });

        foreach ($ranking as $index => $item) {
            $ranking[$index]['rank'] = $index + 1;
        }

        return ApiResponder::success([
            'dashboard_mode' => $dashboardMode,
            'range' => [
                'start' => $start,
                'end' => $end,
                'days' => $dayCount,
            ],
            'summary' => $this->buildSummary($ranking),
            'compare_default_ids' => array_values(array_map(
                static fn (array $item): int => (int) ($item['id'] ?? 0),
                array_slice($ranking, 0, $dashboardMode === 'team' ? 3 : 1)
            )),
            'ranking' => $ranking,
        ], $request->requestId);
    }

    private function buildMemberPerformance(
        array $member,
        array $executions,
        array $dailyTasks,
        array $worklogs,
        array $executionProjectMap,
        array $executionLastWorklogDate,
        string $start,
        string $end,
        int $dayCount,
    ): array {
        $memberName = (string) ($member['name'] ?? '');
        $memberExecutions = array_values(array_filter(
            $executions,
            fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
        ));
        $memberDailyTasks = array_values(array_filter(
            $dailyTasks,
            fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
        ));
        $memberWorklogs = array_values(array_filter(
            $worklogs,
            fn (array $item): bool => $this->matchesName((string) ($item['owner_name'] ?? ''), $memberName)
                && $this->dateInRange((string) ($item['work_date'] ?? ''), $start, $end)
        ));

        $updateDates = [];
        $worklogExecutionIds = [];
        $totalHours = 0.0;
        foreach ($memberWorklogs as $worklog) {
            $workDate = (string) ($worklog['work_date'] ?? '');
            if ($workDate !== '') {
                $updateDates[$workDate] = true;
            }

            $executionId = (int) ($worklog['execution_id'] ?? 0);
            if ($executionId > 0) {
                $worklogExecutionIds[$executionId] = true;
            }

            $totalHours += (float) ($worklog['hours'] ?? 0);
        }

        $dueExecutions = array_values(array_filter(
            $memberExecutions,
            fn (array $item): bool => $this->dateInRange((string) ($item['plan_end'] ?? ''), $start, $end)
        ));
        $dueDailyTasks = array_values(array_filter(
            $memberDailyTasks,
            fn (array $item): bool => !($item['exclude_from_report'] ?? false)
                && $this->dateInRange((string) ($item['due_at'] ?? ''), $start, $end)
        ));

        $completedExecutionCount = 0;
        $onTimeExecutionCount = 0;
        foreach ($dueExecutions as $execution) {
            if (!$this->isExecutionClosed((string) ($execution['status'] ?? ''))) {
                continue;
            }

            $completedExecutionCount++;
            $executionId = (int) ($execution['id'] ?? 0);
            $planEnd = (string) ($execution['plan_end'] ?? '');
            $lastWorklogDate = (string) ($executionLastWorklogDate[$executionId] ?? '');
            if ($lastWorklogDate === '' || $planEnd === '' || $lastWorklogDate <= $planEnd) {
                $onTimeExecutionCount++;
            }
        }

        $completedDailyTaskCount = count(array_filter(
            $dueDailyTasks,
            static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Done'
        ));

        $dueItemCount = count($dueExecutions) + count($dueDailyTasks);
        $completedItemCount = $completedExecutionCount + $completedDailyTaskCount;
        $onTimeCompletedCount = $onTimeExecutionCount + $completedDailyTaskCount;
        $overdueItemCount = max(0, $dueItemCount - $completedItemCount);
        $updateDays = count($updateDates);
        $updateRate = $dayCount > 0 ? (int) round(($updateDays / $dayCount) * 100) : 0;
        $averageDailyHours = $updateDays > 0 ? round($totalHours / $updateDays, 1) : 0.0;
        $onTimeRate = $this->resolveOnTimeRate($dueItemCount, $onTimeCompletedCount, $updateDays, $totalHours, $memberExecutions);
        $hourLoadRate = min(100, (int) round(($totalHours / max(1, $dayCount * 1.5)) * 100));
        $score = (int) round(($onTimeRate * 0.55) + ($updateRate * 0.25) + ($hourLoadRate * 0.20));

        $activeExecutionIds = [];
        $projectNames = [];
        $projectIds = [];

        foreach ($memberExecutions as $execution) {
            $executionId = (int) ($execution['id'] ?? 0);
            $projectId = (int) ($execution['project_id'] ?? 0);
            $projectName = trim((string) ($execution['project_name'] ?? ''));

            if ($projectId > 0) {
                $projectIds[$projectId] = true;
            }
            if ($projectName !== '') {
                $projectNames[$projectName] = true;
            }

            if (
                isset($worklogExecutionIds[$executionId])
                || $this->rangeOverlaps(
                    (string) ($execution['plan_start'] ?? ''),
                    (string) ($execution['plan_end'] ?? ''),
                    $start,
                    $end
                )
            ) {
                $activeExecutionIds[$executionId] = true;
            }
        }

        foreach (array_keys($worklogExecutionIds) as $executionId) {
            $project = $executionProjectMap[$executionId] ?? null;
            if (!is_array($project)) {
                continue;
            }

            $projectId = (int) ($project['project_id'] ?? 0);
            $projectName = trim((string) ($project['project_name'] ?? ''));
            if ($projectId > 0) {
                $projectIds[$projectId] = true;
            }
            if ($projectName !== '') {
                $projectNames[$projectName] = true;
            }
            $activeExecutionIds[$executionId] = true;
        }

        $projectNameList = array_values(array_keys($projectNames));
        sort($projectNameList);

        return [
            'id' => (int) ($member['id'] ?? 0),
            'name' => $memberName,
            'email' => (string) ($member['email'] ?? ''),
            'department' => (string) ($member['department'] ?? 'Unknown'),
            'title' => (string) ($member['title'] ?? 'Team member'),
            'status' => (string) ($member['status'] ?? 'Active'),
            'score' => $score,
            'level' => $this->resolveLevel($score),
            'active_project_count' => count($projectIds),
            'active_execution_count' => count($activeExecutionIds),
            'due_item_count' => $dueItemCount,
            'completed_item_count' => $completedItemCount,
            'on_time_completed_count' => $onTimeCompletedCount,
            'on_time_rate' => $onTimeRate,
            'overdue_item_count' => $overdueItemCount,
            'update_days' => $updateDays,
            'update_rate' => $updateRate,
            'total_hours' => round($totalHours, 1),
            'average_daily_hours' => $averageDailyHours,
            'project_names' => $projectNameList,
        ];
    }

    private function buildSummary(array $ranking): array
    {
        $memberCount = count($ranking);
        $totalHours = 0.0;
        $totalCompleted = 0;
        $totalOverdue = 0;
        $scoreSum = 0;
        $onTimeSum = 0;
        $updateRateSum = 0;

        foreach ($ranking as $item) {
            $totalHours += (float) ($item['total_hours'] ?? 0);
            $totalCompleted += (int) ($item['completed_item_count'] ?? 0);
            $totalOverdue += (int) ($item['overdue_item_count'] ?? 0);
            $scoreSum += (int) ($item['score'] ?? 0);
            $onTimeSum += (int) ($item['on_time_rate'] ?? 0);
            $updateRateSum += (int) ($item['update_rate'] ?? 0);
        }

        return [
            'member_count' => $memberCount,
            'completed_item_count' => $totalCompleted,
            'overdue_item_count' => $totalOverdue,
            'total_hours' => round($totalHours, 1),
            'average_score' => $memberCount > 0 ? (int) round($scoreSum / $memberCount) : 0,
            'average_on_time_rate' => $memberCount > 0 ? (int) round($onTimeSum / $memberCount) : 0,
            'average_update_rate' => $memberCount > 0 ? (int) round($updateRateSum / $memberCount) : 0,
        ];
    }

    private function resolveVisibleMembers(
        string $dashboardMode,
        array $users,
        array $projects,
        array $executions,
        array $dailyTasks,
        array $worklogs,
        string $currentUserName,
    ): array {
        if ($dashboardMode !== 'team') {
            foreach ($users as $user) {
                if ($this->matchesName((string) ($user['name'] ?? ''), $currentUserName)) {
                    return [$user];
                }
            }

            return [[
                'id' => 0,
                'name' => $currentUserName !== '' ? $currentUserName : 'Current user',
                'email' => '',
                'department' => 'Unknown',
                'title' => 'Team member',
                'status' => 'Active',
            ]];
        }

        $names = [];
        $this->collectName($names, $currentUserName);
        foreach ($projects as $project) {
            $this->collectName($names, (string) ($project['owner_name'] ?? ''));
        }
        foreach ($executions as $execution) {
            $this->collectName($names, (string) ($execution['owner_name'] ?? ''));
        }
        foreach ($dailyTasks as $dailyTask) {
            $this->collectName($names, (string) ($dailyTask['owner_name'] ?? ''));
        }
        foreach ($worklogs as $worklog) {
            $this->collectName($names, (string) ($worklog['owner_name'] ?? ''));
        }

        $visibleUsers = [];
        foreach ($users as $user) {
            $normalized = $this->normalizeName((string) ($user['name'] ?? ''));
            if ($normalized === '' || !isset($names[$normalized])) {
                continue;
            }

            $visibleUsers[] = $user;
            unset($names[$normalized]);
        }

        foreach ($names as $name) {
            $visibleUsers[] = [
                'id' => 0,
                'name' => $name,
                'email' => '',
                'department' => 'Unknown',
                'title' => 'Team member',
                'status' => 'Active',
            ];
        }

        return $visibleUsers;
    }

    private function resolveRange(ApiContext $request): array
    {
        $today = date('Y-m-d');
        $start = $this->sanitizeDate((string) ($request->query['start'] ?? date('Y-m-d', strtotime('-13 days'))));
        $end = $this->sanitizeDate((string) ($request->query['end'] ?? $today));

        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }

        $startTimestamp = strtotime($start);
        $endTimestamp = strtotime($end);
        $dayCount = 1;
        if ($startTimestamp !== false && $endTimestamp !== false && $endTimestamp >= $startTimestamp) {
            $dayCount = (int) floor(($endTimestamp - $startTimestamp) / 86400) + 1;
        }

        return [$start, $end, max(1, $dayCount)];
    }

    private function sanitizeDate(string $value): string
    {
        $trimmed = trim($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) !== 1) {
            return date('Y-m-d');
        }

        return $trimmed;
    }

    private function resolveOnTimeRate(
        int $dueItemCount,
        int $onTimeCompletedCount,
        int $updateDays,
        float $totalHours,
        array $memberExecutions,
    ): int {
        if ($dueItemCount > 0) {
            return (int) round(($onTimeCompletedCount / $dueItemCount) * 100);
        }

        if ($updateDays > 0 || $totalHours > 0 || count($memberExecutions) > 0) {
            return 80;
        }

        return 0;
    }

    private function resolveLevel(int $score): string
    {
        if ($score >= 80) {
            return 'excellent';
        }

        if ($score >= 60) {
            return 'steady';
        }

        if ($score >= 40) {
            return 'watch';
        }

        return 'risk';
    }

    private function hasPerformanceSignal(array $item): bool
    {
        return (int) ($item['active_project_count'] ?? 0) > 0
            || (int) ($item['due_item_count'] ?? 0) > 0
            || (int) ($item['update_days'] ?? 0) > 0
            || (float) ($item['total_hours'] ?? 0) > 0;
    }

    private function isTeamMode(RecordScope $scope, array $permissions): bool
    {
        return $scope->isOrgScope() || in_array('settings.member.manage.org', $permissions, true);
    }

    private function dateInRange(string $value, string $start, string $end): bool
    {
        $date = trim($value);
        return $date !== '' && $date >= $start && $date <= $end;
    }

    private function rangeOverlaps(string $itemStart, string $itemEnd, string $start, string $end): bool
    {
        if ($itemStart === '' && $itemEnd === '') {
            return false;
        }

        $normalizedStart = $itemStart !== '' ? $itemStart : $itemEnd;
        $normalizedEnd = $itemEnd !== '' ? $itemEnd : $itemStart;

        return $normalizedStart !== '' && $normalizedEnd !== '' && $normalizedStart <= $end && $normalizedEnd >= $start;
    }

    private function isExecutionClosed(string $status): bool
    {
        return in_array($status, ['Done', 'Closed'], true);
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