<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class ExecutionService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function index(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterExecutions($this->store->allExecutions());

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $projectId = (int) ($request->body['project_id'] ?? 0);
        if ($projectId > 0 && !$scope->canAccessProjectId($projectId)) {
            return $scope->scopeDenied('project', $request->requestId, $projectId);
        }

        $requirementIds = array_values(array_unique(array_map('intval', is_array($request->body['requirement_ids'] ?? null) ? $request->body['requirement_ids'] : [])));
        foreach ($requirementIds as $requirementId) {
            if (!$scope->canAccessRequirementId($requirementId)) {
                return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
            }
        }

        $projects = $this->store->allProjects();
        $projectName = $this->resolveProjectName($projectId, $projects, (string) ($request->body['project_name'] ?? 'Unassigned project'));
        $ownerName = trim((string) ($request->body['owner_name'] ?? '')) ?: $scope->currentUserName();

        $payload = [
            'name' => $request->body['name'] ?? 'Untitled execution',
            'project_id' => $projectId,
            'project_name' => $projectName,
            'owner_name' => $ownerName !== '' ? $ownerName : 'Unassigned',
            'status' => $request->body['status'] ?? 'NotStarted',
            'plan_start' => $request->body['plan_start'] ?? date('Y-m-d'),
            'plan_end' => $request->body['plan_end'] ?? date('Y-m-d', strtotime('+7 days')),
            'plan_progress' => (int) ($request->body['plan_progress'] ?? 0),
            'actual_progress' => (int) ($request->body['actual_progress'] ?? 0),
            'requirement_ids' => $requirementIds,
        ];

        $created = $this->store->createExecution($payload);

        if ($projectId > 0) {
            foreach ($projects as $index => $project) {
                if ((int) ($project['id'] ?? 0) !== $projectId) {
                    continue;
                }

                $projects[$index]['execution_count'] = (int) ($project['execution_count'] ?? 0) + 1;
                $this->store->replaceAllProjects($projects);
                break;
            }
        }

        return ApiResponder::success($created, $request->requestId);
    }

    public function show(ApiContext $request, array $params): ThinkResponse
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

        return ApiResponder::success($execution, $request->requestId);
    }

    public function update(ApiContext $request, array $params): ThinkResponse
    {
        $executionId = (int) ($params['id'] ?? 0);
        $current = $this->store->findExecution($executionId);

        if ($current === null) {
            return ApiResponder::error(404, 'execution_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessExecution($current)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $updated = $this->store->updateExecution($executionId, $request->body);

        if ($updated === null) {
            return ApiResponder::error(404, 'execution_not_found', [], $request->requestId);
        }

        return ApiResponder::success($updated, $request->requestId);
    }

    public function listTasks(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $executionId = (int) ($params['id'] ?? 0);
        $execution = $this->store->findExecution($executionId);

        if ($execution === null) {
            return ApiResponder::error(404, 'execution_not_found', [], $request->requestId);
        }

        if (!$scope->canAccessExecution($execution)) {
            return $scope->scopeDenied('execution', $request->requestId, $executionId);
        }

        $tasks = $scope->filterTasks(array_values(array_filter(
            $this->store->allTasks(),
            static fn (array $item): bool => (int) ($item['execution_id'] ?? 0) === $executionId
        )));

        return ApiResponder::success(['items' => $tasks], $request->requestId);
    }

    public function taskIndex(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterTasks($this->store->allTasks());

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function taskStore(ApiContext $request, array $params): ThinkResponse
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
        $payload = [
            'execution_id' => $executionId,
            'name' => $request->body['name'] ?? 'Untitled child execution',
            'owner_name' => $ownerName !== '' ? $ownerName : 'Unassigned',
            'status' => $request->body['status'] ?? 'NotStarted',
            'actual_progress' => (int) ($request->body['actual_progress'] ?? 0),
        ];

        return ApiResponder::success($this->store->createTask($payload), $request->requestId);
    }

    public function taskShow(ApiContext $request, array $params): ThinkResponse
    {
        $taskId = (int) ($params['id'] ?? 0);
        $task = $this->store->findTask($taskId);

        if ($task === null) {
            return ApiResponder::error(404, 'task_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessTask($task)) {
            return $scope->scopeDenied('task', $request->requestId, $taskId);
        }

        return ApiResponder::success($task, $request->requestId);
    }

    public function taskUpdate(ApiContext $request, array $params): ThinkResponse
    {
        $taskId = (int) ($params['id'] ?? 0);
        $current = $this->store->findTask($taskId);

        if ($current === null) {
            return ApiResponder::error(404, 'task_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessTask($current)) {
            return $scope->scopeDenied('task', $request->requestId, $taskId);
        }

        $updated = $this->store->updateTask($taskId, [
            'name' => $request->body['name'] ?? ($current['name'] ?? 'Untitled child execution'),
            'owner_name' => $request->body['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'),
            'status' => $request->body['status'] ?? ($current['status'] ?? 'NotStarted'),
            'actual_progress' => (int) ($request->body['actual_progress'] ?? ($current['actual_progress'] ?? 0)),
        ]);

        if ($updated === null) {
            return ApiResponder::error(404, 'task_not_found', [], $request->requestId);
        }

        return ApiResponder::success($updated, $request->requestId);
    }

    private function resolveProjectName(int $projectId, array $projects, string $fallback): string
    {
        foreach ($projects as $project) {
            if ((int) ($project['id'] ?? 0) === $projectId) {
                return (string) ($project['name'] ?? $fallback);
            }
        }

        return $fallback;
    }
}
