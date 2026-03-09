<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class ScheduleController
{
    public function teamGantt(Request $request, array $params): Response
    {
        $store = new JsonStore();
        $executions = $store->all('executions');

        return Response::success([
            'items' => $executions,
            'view' => 'team',
            'total' => count($executions),
        ], $request->requestId);
    }

    public function executionGantt(Request $request, array $params): Response
    {
        $store = new JsonStore();
        $tasks = $store->all('tasks');
        $executions = $store->all('executions');
        $executionMap = [];

        foreach ($executions as $execution) {
            $executionMap[(int) ($execution['id'] ?? 0)] = $execution;
        }

        $items = array_map(static function (array $task) use ($executionMap): array {
            $executionId = (int) ($task['execution_id'] ?? 0);
            $execution = $executionMap[$executionId] ?? [];

            return [
                ...$task,
                'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
                'project_name' => (string) ($execution['project_name'] ?? 'Unknown project'),
                'plan_start' => (string) ($execution['plan_start'] ?? ''),
                'plan_end' => (string) ($execution['plan_end'] ?? ''),
            ];
        }, $tasks);

        return Response::success([
            'items' => $items,
            'view' => 'execution',
            'total' => count($items),
        ], $request->requestId);
    }
}