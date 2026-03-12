<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\JsonStore;
use App\Support\RecordScope;
use App\Support\Request;
use App\Support\Response;

final class ProjectService
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function index(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterProjects($this->store->all('projects'));

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
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

        return Response::success($this->store->create('projects', $payload), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $projectId = (int) ($params['id'] ?? 0);
        $project = $this->store->find('projects', $projectId);

        if ($project === null) {
            return Response::error(404, 'project_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessProject($project)) {
            return $scope->scopeDenied('project', $request->requestId, $projectId);
        }

        return Response::success($project, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $projectId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('projects', $projectId);

        if ($current === null) {
            return Response::error(404, 'project_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessProject($current)) {
            return $scope->scopeDenied('project', $request->requestId, $projectId);
        }

        $updated = $this->store->update('projects', $projectId, $request->body);

        if ($updated === null) {
            return Response::error(404, 'project_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
    }
}
