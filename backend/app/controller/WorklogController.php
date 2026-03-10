<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\RecordScope;
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
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterWorklogs($this->store->all('worklogs'));

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function listByExecution(Request $request, array $params): Response
    {
        $executionId = (int) ($params['id'] ?? 0);
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessExecution($execution)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $items = $scope->filterWorklogs($this->store->filter(
            'worklogs',
            static fn (array $item): bool => (int) ($item['execution_id'] ?? 0) === $executionId
        ));

        usort($items, static fn (array $left, array $right): int => strcmp((string) ($right['work_date'] ?? ''), (string) ($left['work_date'] ?? '')));

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $executionId = (int) ($request->body['execution_id'] ?? 0);
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        if (!$scope->canAccessExecution($execution)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $ownerName = trim((string) ($request->body['owner_name'] ?? '')) ?: $scope->currentUserName();
        $ownerError = $scope->ensureCurrentUserField($ownerName, 'owner_name', 'worklog', $request->requestId);
        if ($ownerError !== null) {
            return $ownerError;
        }

        $payload = [
            'execution_id' => $executionId,
            'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
            'owner_name' => $ownerName !== '' ? $ownerName : 'Unassigned',
            'work_date' => $request->body['work_date'] ?? date('Y-m-d'),
            'hours' => (float) ($request->body['hours'] ?? 0),
            'summary' => $request->body['summary'] ?? '',
        ];

        return Response::success($this->store->create('worklogs', $payload), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $worklogId = (int) ($params['id'] ?? 0);
        $item = $this->store->find('worklogs', $worklogId);

        if ($item === null) {
            return Response::error(404, 'worklog_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessWorklog($item)) {
            return $scope->scopeDenied('worklog', $request->requestId, $worklogId);
        }

        return Response::success($item, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $id = (int) ($params['id'] ?? 0);
        $current = $this->store->find('worklogs', $id);

        if ($current === null) {
            return Response::error(404, 'worklog_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessWorklog($current)) {
            return $scope->scopeDenied('worklog', $request->requestId, $id);
        }

        $currentOwnerError = $scope->ensureCurrentUserField((string) ($current['owner_name'] ?? ''), 'owner_name', 'worklog', $request->requestId, $id);
        if ($currentOwnerError !== null) {
            return $currentOwnerError;
        }

        $executionId = (int) ($request->body['execution_id'] ?? ($current['execution_id'] ?? 0));
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        if (!$scope->canAccessExecution($execution)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $ownerName = trim((string) ($request->body['owner_name'] ?? ($current['owner_name'] ?? '')));
        $ownerError = $scope->ensureCurrentUserField($ownerName, 'owner_name', 'worklog', $request->requestId, $id);
        if ($ownerError !== null) {
            return $ownerError;
        }

        $updated = $this->store->update('worklogs', $id, [
            'execution_id' => $executionId,
            'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
            'owner_name' => $ownerName !== '' ? $ownerName : (string) ($current['owner_name'] ?? 'Unassigned'),
            'work_date' => $request->body['work_date'] ?? ($current['work_date'] ?? date('Y-m-d')),
            'hours' => (float) ($request->body['hours'] ?? ($current['hours'] ?? 0)),
            'summary' => $request->body['summary'] ?? ($current['summary'] ?? ''),
        ]);

        return Response::success($updated ?? $current, $request->requestId);
    }
}
