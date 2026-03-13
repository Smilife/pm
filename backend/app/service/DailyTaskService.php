<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class DailyTaskService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function index(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterDailyTasks($this->store->allDailyTasks());

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $ownerName = trim((string) ($request->body['owner_name'] ?? '')) ?: $scope->currentUserName();
        $ownerError = $scope->ensureCurrentUserField($ownerName, 'owner_name', 'daily_task', $request->requestId);
        if ($ownerError !== null) {
            return $ownerError;
        }

        $payload = [
            'title' => $request->body['title'] ?? 'Untitled daily item',
            'owner_name' => $ownerName !== '' ? $ownerName : 'Unassigned',
            'status' => $request->body['status'] ?? 'NotStarted',
            'due_at' => $request->body['due_at'] ?? date('Y-m-d'),
            'exclude_from_report' => (bool) ($request->body['exclude_from_report'] ?? false),
        ];

        return ApiResponder::success($this->store->createDailyTask($payload), $request->requestId);
    }

    public function show(ApiContext $request, array $params): ThinkResponse
    {
        $dailyTaskId = (int) ($params['id'] ?? 0);
        $item = $this->store->findDailyTask($dailyTaskId);

        if ($item === null) {
            return ApiResponder::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessDailyTask($item)) {
            return $scope->scopeDenied('daily_task', $request->requestId, $dailyTaskId);
        }

        return ApiResponder::success($item, $request->requestId);
    }

    public function update(ApiContext $request, array $params): ThinkResponse
    {
        $dailyTaskId = (int) ($params['id'] ?? 0);
        $current = $this->store->findDailyTask($dailyTaskId);

        if ($current === null) {
            return ApiResponder::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessDailyTask($current)) {
            return $scope->scopeDenied('daily_task', $request->requestId, $dailyTaskId);
        }

        $currentOwnerError = $scope->ensureCurrentUserField((string) ($current['owner_name'] ?? ''), 'owner_name', 'daily_task', $request->requestId, $dailyTaskId);
        if ($currentOwnerError !== null) {
            return $currentOwnerError;
        }

        $ownerName = trim((string) ($request->body['owner_name'] ?? ($current['owner_name'] ?? '')));
        $ownerError = $scope->ensureCurrentUserField($ownerName, 'owner_name', 'daily_task', $request->requestId, $dailyTaskId);
        if ($ownerError !== null) {
            return $ownerError;
        }

        $updated = $this->store->updateDailyTask($dailyTaskId, [
            'title' => $request->body['title'] ?? ($current['title'] ?? 'Untitled daily item'),
            'owner_name' => $ownerName !== '' ? $ownerName : (string) ($current['owner_name'] ?? 'Unassigned'),
            'status' => $request->body['status'] ?? ($current['status'] ?? 'NotStarted'),
            'due_at' => $request->body['due_at'] ?? ($current['due_at'] ?? date('Y-m-d')),
            'exclude_from_report' => (bool) ($request->body['exclude_from_report'] ?? ($current['exclude_from_report'] ?? false)),
        ]);

        if ($updated === null) {
            return ApiResponder::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        return ApiResponder::success($updated, $request->requestId);
    }
}
