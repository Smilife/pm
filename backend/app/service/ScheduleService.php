<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\ApiContext;
use App\Support\ApiResponder;
use App\Support\RecordScope;
use App\Support\StoreRegistry;
use think\Response as ThinkResponse;

final class ScheduleService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function projectGantt(ApiContext $request, array $params): ThinkResponse
    {
        $store = $this->store;
        $scope = new RecordScope($request, $store);
        $projects = $scope->filterProjects($store->allProjects());
        $executions = $scope->filterExecutions($store->allExecutions());
        $bugs = $scope->filterBugs($store->allBugs());
        $worklogs = $scope->filterWorklogs($store->allWorklogs());
        $today = date('Y-m-d');
        $dueSoonBoundary = date('Y-m-d', strtotime('+3 days'));
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
                'plan_start' => $this->earliestDate(array_map(
                    static fn (array $item): string => (string) ($item['plan_start'] ?? ''),
                    $projectExecutions
                )),
                'plan_end' => $this->latestDate(array_map(
                    static fn (array $item): string => (string) ($item['plan_end'] ?? ''),
                    $projectExecutions
                )),
                'execution_count' => count($projectExecutions),
                'active_execution_count' => $activeExecutionCount,
                'blocked_execution_count' => $blockedExecutionCount,
                'open_bug_count' => $openBugCount,
                'risk_count' => $riskCount,
                'average_progress' => $averageProgress,
                'due_soon_count' => $dueSoonCount,
                'overdue_count' => $overdueCount,
                'execution_names' => array_slice(array_values(array_filter(array_map(
                    static fn (array $item): string => trim((string) ($item['name'] ?? '')),
                    $projectExecutions
                ))), 0, 3),
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

        return ApiResponder::success([
            'items' => array_values($items),
            'view' => 'project',
            'total' => count($items),
        ], $request->requestId);
    }

    public function teamGantt(ApiContext $request, array $params): ThinkResponse
    {
        $store = $this->store;
        $scope = new RecordScope($request, $store);
        $executions = $scope->filterExecutions($store->allExecutions());

        return ApiResponder::success([
            'items' => $executions,
            'view' => 'team',
            'total' => count($executions),
        ], $request->requestId);
    }

    public function executionGantt(ApiContext $request, array $params): ThinkResponse
    {
        $store = $this->store;
        $scope = new RecordScope($request, $store);
        $tasks = $scope->filterTasks($store->allTasks());
        $executions = $scope->filterExecutions($store->allExecutions());
        $executionMap = [];

        foreach ($executions as $execution) {
            $executionMap[(int) ($execution['id'] ?? 0)] = $execution;
        }

        $items = array_values(array_filter(array_map(static function (array $task) use ($executionMap): ?array {
            $executionId = (int) ($task['execution_id'] ?? 0);
            $execution = $executionMap[$executionId] ?? null;

            if (!is_array($execution)) {
                return null;
            }

            return [
                ...$task,
                'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
                'project_name' => (string) ($execution['project_name'] ?? 'Unknown project'),
                'plan_start' => (string) ($execution['plan_start'] ?? ''),
                'plan_end' => (string) ($execution['plan_end'] ?? ''),
            ];
        }, $tasks)));

        return ApiResponder::success([
            'items' => $items,
            'view' => 'execution',
            'total' => count($items),
        ], $request->requestId);
    }

    private function isExecutionClosed(string $status): bool
    {
        return in_array($status, ['Done', 'Closed'], true);
    }

    private function isBugOpen(string $status): bool
    {
        return !in_array($status, ['Resolved', 'Closed'], true);
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

    private function earliestDate(array $values): string
    {
        $earliestValue = '';
        $earliestTimestamp = null;

        foreach ($values as $value) {
            $normalizedValue = trim((string) $value);
            if ($normalizedValue === '') {
                continue;
            }

            $timestamp = strtotime($normalizedValue);
            if ($timestamp === false) {
                continue;
            }

            if ($earliestTimestamp === null || $timestamp < $earliestTimestamp) {
                $earliestTimestamp = $timestamp;
                $earliestValue = $normalizedValue;
            }
        }

        return $earliestValue;
    }

    private function latestDate(array $values): string
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
}
