<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class WorklogController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function index(Request $request, array $params): Response
    {
        $items = $this->store->all('worklogs');

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function listByExecution(Request $request, array $params): Response
    {
        $executionId = (int) $params['id'];
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        $items = $this->store->filter(
            'worklogs',
            static fn (array $item): bool => (int) ($item['execution_id'] ?? 0) === $executionId
        );

        usort($items, static fn (array $left, array $right): int => strcmp((string) ($right['work_date'] ?? ''), (string) ($left['work_date'] ?? '')));

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $executionId = (int) ($request->body['execution_id'] ?? 0);
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        $payload = [
            'execution_id' => $executionId,
            'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
            'owner_name' => $request->body['owner_name'] ?? 'Unassigned',
            'work_date' => $request->body['work_date'] ?? date('Y-m-d'),
            'hours' => (float) ($request->body['hours'] ?? 0),
            'summary' => $request->body['summary'] ?? '',
        ];

        return Response::success($this->store->create('worklogs', $payload), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $item = $this->store->find('worklogs', (int) $params['id']);

        if ($item === null) {
            return Response::error(404, 'worklog_not_found', [], $request->requestId);
        }

        return Response::success($item, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $id = (int) $params['id'];
        $current = $this->store->find('worklogs', $id);

        if ($current === null) {
            return Response::error(404, 'worklog_not_found', [], $request->requestId);
        }

        $executionId = (int) ($request->body['execution_id'] ?? $current['execution_id'] ?? 0);
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        $updated = $this->store->update('worklogs', $id, [
            'execution_id' => $executionId,
            'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
            'owner_name' => $request->body['owner_name'] ?? $current['owner_name'] ?? 'Unassigned',
            'work_date' => $request->body['work_date'] ?? $current['work_date'] ?? date('Y-m-d'),
            'hours' => (float) ($request->body['hours'] ?? $current['hours'] ?? 0),
            'summary' => $request->body['summary'] ?? $current['summary'] ?? '',
        ]);

        return Response::success($updated ?? $current, $request->requestId);
    }
}