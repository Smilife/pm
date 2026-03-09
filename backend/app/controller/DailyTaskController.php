<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
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
        $items = $this->store->all('daily_tasks');

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $payload = [
            'title' => $request->body['title'] ?? 'Untitled daily item',
            'owner_name' => $request->body['owner_name'] ?? 'Unassigned',
            'status' => $request->body['status'] ?? 'NotStarted',
            'due_at' => $request->body['due_at'] ?? date('Y-m-d'),
            'exclude_from_report' => (bool) ($request->body['exclude_from_report'] ?? false),
        ];

        return Response::success($this->store->create('daily_tasks', $payload), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $item = $this->store->find('daily_tasks', (int) $params['id']);

        if ($item === null) {
            return Response::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        return Response::success($item, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $updated = $this->store->update('daily_tasks', (int) $params['id'], $request->body);

        if ($updated === null) {
            return Response::error(404, 'daily_task_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
    }
}