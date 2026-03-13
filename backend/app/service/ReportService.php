<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class ReportService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }
    public function generateDaily(ApiContext $request, array $params): ThinkResponse
    {
        $store = $this->store;
        $scope = new RecordScope($request, $store);
        $executions = $scope->filterExecutions($store->allExecutions());
        $dailyTasks = array_values(array_filter(
            $scope->filterDailyTasks($store->allDailyTasks()),
            static fn (array $item): bool => !($item['exclude_from_report'] ?? false)
        ));

        $completed = array_values(array_map(
            static fn (array $item): string => (string) ($item['name'] ?? ''),
            array_filter($executions, static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Done')
        ));
        if ($completed === []) {
            $completed = array_values(array_map(
                static fn (array $item): string => (string) ($item['name'] ?? ''),
                array_slice($executions, 0, 1)
            ));
        }

        $inProgress = array_values(array_map(
            static fn (array $item): string => (string) ($item['name'] ?? ''),
            array_filter(
                $executions,
                static fn (array $item): bool => in_array((string) ($item['status'] ?? ''), ['InProgress', 'NotStarted', 'ToVerify'], true)
            )
        ));

        $risks = array_values(array_map(
            static fn (array $item): string => 'Blocked execution: ' . (string) ($item['name'] ?? ''),
            array_filter($executions, static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Blocked')
        ));
        if ($risks === []) {
            $risks[] = 'No active blockers were captured today.';
        }

        $nextSteps = array_values(array_map(
            static fn (array $item): string => (string) ($item['title'] ?? ''),
            array_filter($dailyTasks, static fn (array $item): bool => (string) ($item['status'] ?? '') !== 'Done')
        ));
        if ($nextSteps === []) {
            $nextSteps = array_values(array_map(
                static fn (array $item): string => 'Follow up on ' . (string) ($item['name'] ?? ''),
                array_slice($executions, 0, 2)
            ));
        }

        return ApiResponder::success([
            'report_type' => 'daily',
            'generated_at' => date(DATE_ATOM),
            'completed' => $completed,
            'in_progress' => $inProgress,
            'risks' => $risks,
            'next_steps' => $nextSteps,
        ], $request->requestId);
    }

    public function generateWeekly(ApiContext $request, array $params): ThinkResponse
    {
        $store = $this->store;
        $scope = new RecordScope($request, $store);
        $executions = $scope->filterExecutions($store->allExecutions());
        $dailyTasks = array_values(array_filter(
            $scope->filterDailyTasks($store->allDailyTasks()),
            static fn (array $item): bool => !($item['exclude_from_report'] ?? false)
        ));
        $worklogs = $scope->filterWorklogs($store->allWorklogs());
        usort($worklogs, static fn (array $left, array $right): int => strcmp((string) ($right['work_date'] ?? ''), (string) ($left['work_date'] ?? '')));

        $completed = array_values(array_map(
            static fn (array $item): string => (string) ($item['name'] ?? ''),
            array_filter($executions, static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Done')
        ));
        foreach ($dailyTasks as $item) {
            if ((string) ($item['status'] ?? '') === 'Done') {
                $completed[] = (string) ($item['title'] ?? '');
            }
        }
        $completed = array_values(array_unique(array_filter($completed, static fn (string $item): bool => $item !== '')));

        $inProgress = array_values(array_map(
            static fn (array $item): string => (string) ($item['name'] ?? ''),
            array_filter(
                $executions,
                static fn (array $item): bool => in_array((string) ($item['status'] ?? ''), ['InProgress', 'NotStarted', 'ToVerify'], true)
            )
        ));

        $risks = array_values(array_map(
            static fn (array $item): string => 'Blocked execution: ' . (string) ($item['name'] ?? ''),
            array_filter($executions, static fn (array $item): bool => (string) ($item['status'] ?? '') === 'Blocked')
        ));
        if ($risks === []) {
            $risks[] = 'No active blockers were captured this week.';
        }

        $nextWeek = array_values(array_map(
            static fn (array $item): string => (string) ($item['title'] ?? ''),
            array_filter($dailyTasks, static fn (array $item): bool => (string) ($item['status'] ?? '') !== 'Done')
        ));
        if ($nextWeek === []) {
            $nextWeek = array_values(array_map(
                static fn (array $item): string => 'Advance ' . (string) ($item['name'] ?? ''),
                array_slice($executions, 0, 3)
            ));
        }

        $worklogHighlights = array_values(array_map(
            static fn (array $item): string => sprintf(
                '%s logged %.1fh on %s: %s',
                (string) ($item['owner_name'] ?? 'Unknown'),
                (float) ($item['hours'] ?? 0),
                (string) ($item['execution_name'] ?? 'Unknown execution'),
                (string) ($item['summary'] ?? '')
            ),
            array_slice($worklogs, 0, 5)
        ));

        $totalHours = array_reduce(
            $worklogs,
            static fn (float $carry, array $item): float => $carry + (float) ($item['hours'] ?? 0),
            0.0
        );

        $summary = sprintf(
            'Weekly report generated from %d executions, %d included daily tasks and %d worklog entries.',
            count($executions),
            count($dailyTasks),
            count($worklogs)
        );

        return ApiResponder::success([
            'report_type' => 'weekly',
            'generated_at' => date(DATE_ATOM),
            'summary' => $summary,
            'completed' => $completed,
            'in_progress' => $inProgress,
            'risks' => $risks,
            'next_week' => $nextWeek,
            'worklog_highlights' => $worklogHighlights,
            'total_hours' => round($totalHours, 1),
        ], $request->requestId);
    }
}