<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\RecordScope;
use App\Support\Request;
use App\Support\Response;

final class DailyTaskController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function index(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterDailyTasks($this->store->all('daily_tasks'));

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
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

        return Response::success($this->store->create('daily_tasks', $payload), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $dailyTaskId = (int) ($params['id'] ?? 0);
        $item = $this->store->find('daily_tasks', $dailyTaskId);

        if ($item === null) {
            return Response::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessDailyTask($item)) {
            return $scope->scopeDenied('daily_task', $request->requestId, $dailyTaskId);
        }

        return Response::success($item, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $dailyTaskId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('daily_tasks', $dailyTaskId);

        if ($current === null) {
            return Response::error(404, 'daily_task_not_found', [], $request->requestId);
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

        $updated = $this->store->update('daily_tasks', $dailyTaskId, [
            'title' => $request->body['title'] ?? ($current['title'] ?? 'Untitled daily item'),
            'owner_name' => $ownerName !== '' ? $ownerName : (string) ($current['owner_name'] ?? 'Unassigned'),
            'status' => $request->body['status'] ?? ($current['status'] ?? 'NotStarted'),
            'due_at' => $request->body['due_at'] ?? ($current['due_at'] ?? date('Y-m-d')),
            'exclude_from_report' => (bool) ($request->body['exclude_from_report'] ?? ($current['exclude_from_report'] ?? false)),
        ]);

        if ($updated === null) {
            return Response::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
    }
}
