<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class ScheduleService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
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
}
