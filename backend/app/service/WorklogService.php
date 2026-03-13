<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class WorklogService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function index(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterWorklogs($this->store->allWorklogs());

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function listByExecution(ApiContext $request, array $params): ThinkResponse
    {
        $executionId = (int) ($params['id'] ?? 0);
        $execution = $this->store->findExecution($executionId);

        if ($execution === null) {
            return ApiResponder::error(404, 'execution_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessExecution($execution)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $items = $scope->filterWorklogs(array_values(array_filter(
            $this->store->allWorklogs(),
            static fn (array $item): bool => (int) ($item['execution_id'] ?? 0) === $executionId
        )));

        usort($items, static fn (array $left, array $right): int => strcmp((string) ($right['work_date'] ?? ''), (string) ($left['work_date'] ?? '')));

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $executionId = (int) ($request->body['execution_id'] ?? 0);
        $execution = $this->store->findExecution($executionId);

        if ($execution === null) {
            return ApiResponder::error(404, 'execution_not_found', [], $request->requestId);
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

        return ApiResponder::success($this->store->createWorklog($payload), $request->requestId);
    }

    public function show(ApiContext $request, array $params): ThinkResponse
    {
        $worklogId = (int) ($params['id'] ?? 0);
        $item = $this->store->findWorklog($worklogId);

        if ($item === null) {
            return ApiResponder::error(404, 'worklog_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessWorklog($item)) {
            return $scope->scopeDenied('worklog', $request->requestId, $worklogId);
        }

        return ApiResponder::success($item, $request->requestId);
    }

    public function update(ApiContext $request, array $params): ThinkResponse
    {
        $id = (int) ($params['id'] ?? 0);
        $current = $this->store->findWorklog($id);

        if ($current === null) {
            return ApiResponder::error(404, 'worklog_not_found', [], $request->requestId);
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
        $execution = $this->store->findExecution($executionId);

        if ($execution === null) {
            return ApiResponder::error(404, 'execution_not_found', [], $request->requestId);
        }

        if (!$scope->canAccessExecution($execution)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $ownerName = trim((string) ($request->body['owner_name'] ?? ($current['owner_name'] ?? '')));
        $ownerError = $scope->ensureCurrentUserField($ownerName, 'owner_name', 'worklog', $request->requestId, $id);
        if ($ownerError !== null) {
            return $ownerError;
        }

        $updated = $this->store->updateWorklog($id, [
            'execution_id' => $executionId,
            'execution_name' => (string) ($execution['name'] ?? 'Unknown execution'),
            'owner_name' => $ownerName !== '' ? $ownerName : (string) ($current['owner_name'] ?? 'Unassigned'),
            'work_date' => $request->body['work_date'] ?? ($current['work_date'] ?? date('Y-m-d')),
            'hours' => (float) ($request->body['hours'] ?? ($current['hours'] ?? 0)),
            'summary' => $request->body['summary'] ?? ($current['summary'] ?? ''),
        ]);

        return ApiResponder::success($updated ?? $current, $request->requestId);
    }
}
