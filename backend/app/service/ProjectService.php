<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class ProjectService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function index(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterProjects($this->store->allProjects());

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $ownerName = trim((string) ($request->body['owner_name'] ?? '')) ?: $scope->currentUserName();

        $payload = [
            'name' => $request->body['name'] ?? 'Untitled project',
            'code' => $request->body['code'] ?? 'AUTO-' . date('His'),
            'owner_name' => $ownerName !== '' ? $ownerName : 'Unassigned',
            'status' => $request->body['status'] ?? 'Active',
            'risk_count' => 0,
            'execution_count' => 0,
        ];

        return ApiResponder::success($this->store->createProject($payload), $request->requestId);
    }

    public function show(ApiContext $request, array $params): ThinkResponse
    {
        $projectId = (int) ($params['id'] ?? 0);
        $project = $this->store->findProject($projectId);

        if ($project === null) {
            return ApiResponder::error(404, 'project_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessProject($project)) {
            return $scope->scopeDenied('project', $request->requestId, $projectId);
        }

        return ApiResponder::success($project, $request->requestId);
    }

    public function update(ApiContext $request, array $params): ThinkResponse
    {
        $projectId = (int) ($params['id'] ?? 0);
        $current = $this->store->findProject($projectId);

        if ($current === null) {
            return ApiResponder::error(404, 'project_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessProject($current)) {
            return $scope->scopeDenied('project', $request->requestId, $projectId);
        }

        $updated = $this->store->updateProject($projectId, $request->body);

        if ($updated === null) {
            return ApiResponder::error(404, 'project_not_found', [], $request->requestId);
        }

        return ApiResponder::success($updated, $request->requestId);
    }
}
