<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class ExecutionController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function index(Request $request, array $params): Response
    {
        $items = $this->store->all('executions');

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $projectId = (int) ($request->body['project_id'] ?? 0);
        $projects = $this->store->all('projects');
        $projectName = $this->resolveProjectName($projectId, $projects, (string) ($request->body['project_name'] ?? 'Unassigned project'));

        $payload = [
            'name' => $request->body['name'] ?? 'Untitled execution',
            'project_id' => $projectId,
            'project_name' => $projectName,
            'owner_name' => $request->body['owner_name'] ?? 'Unassigned',
            'status' => $request->body['status'] ?? 'NotStarted',
            'plan_start' => $request->body['plan_start'] ?? date('Y-m-d'),
            'plan_end' => $request->body['plan_end'] ?? date('Y-m-d', strtotime('+7 days')),
            'plan_progress' => (int) ($request->body['plan_progress'] ?? 0),
            'actual_progress' => (int) ($request->body['actual_progress'] ?? 0),
            'requirement_ids' => $request->body['requirement_ids'] ?? [],
        ];

        $created = $this->store->create('executions', $payload);

        if ($projectId > 0) {
            foreach ($projects as $index => $project) {
                if ((int) ($project['id'] ?? 0) !== $projectId) {
                    continue;
                }

                $projects[$index]['execution_count'] = (int) ($project['execution_count'] ?? 0) + 1;
                $this->store->replaceAll('projects', $projects);
                break;
            }
        }

        return Response::success($created, $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $execution = $this->store->find('executions', (int) $params['id']);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        return Response::success($execution, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $updated = $this->store->update('executions', (int) $params['id'], $request->body);

        if ($updated === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
    }

    public function listTasks(Request $request, array $params): Response
    {
        $executionId = (int) $params['id'];
        $tasks = $this->store->filter('tasks', static fn (array $item): bool => (int) ($item['execution_id'] ?? 0) === $executionId);

        return Response::success(['items' => $tasks], $request->requestId);
    }

    public function taskIndex(Request $request, array $params): Response
    {
        $items = $this->store->all('tasks');

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function taskStore(Request $request, array $params): Response
    {
        $executionId = (int) ($request->body['execution_id'] ?? 0);
        $execution = $this->store->find('executions', $executionId);

        if ($execution === null) {
            return Response::error(404, 'execution_not_found', [], $request->requestId);
        }

        $payload = [
            'execution_id' => $executionId,
            'name' => $request->body['name'] ?? 'Untitled child execution',
            'owner_name' => $request->body['owner_name'] ?? 'Unassigned',
            'status' => $request->body['status'] ?? 'NotStarted',
            'actual_progress' => (int) ($request->body['actual_progress'] ?? 0),
        ];

        return Response::success($this->store->create('tasks', $payload), $request->requestId);
    }

    public function taskShow(Request $request, array $params): Response
    {
        $task = $this->store->find('tasks', (int) $params['id']);

        if ($task === null) {
            return Response::error(404, 'task_not_found', [], $request->requestId);
        }

        return Response::success($task, $request->requestId);
    }

    public function taskUpdate(Request $request, array $params): Response
    {
        $updated = $this->store->update('tasks', (int) $params['id'], $request->body);

        if ($updated === null) {
            return Response::error(404, 'task_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
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