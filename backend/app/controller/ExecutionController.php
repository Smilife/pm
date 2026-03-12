<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\ExecutionService;
use App\Support\Request;
use App\Support\Response;

final class ExecutionController
{
    private ExecutionService $service;

    public function __construct()
    {
        $this->service = new ExecutionService();
    }

    public function index(Request $request, array $params): Response
    {
        return $this->service->index($request, $params);
    }

    public function store(Request $request, array $params): Response
    {
        return $this->service->store($request, $params);
    }

    public function show(Request $request, array $params): Response
    {
        return $this->service->show($request, $params);
    }

    public function update(Request $request, array $params): Response
    {
        return $this->service->update($request, $params);
    }

    public function listTasks(Request $request, array $params): Response
    {
        return $this->service->listTasks($request, $params);
    }

    public function taskIndex(Request $request, array $params): Response
    {
        return $this->service->taskIndex($request, $params);
    }

    public function taskStore(Request $request, array $params): Response
    {
        return $this->service->taskStore($request, $params);
    }

    public function taskShow(Request $request, array $params): Response
    {
        return $this->service->taskShow($request, $params);
    }

    public function taskUpdate(Request $request, array $params): Response
    {
        return $this->service->taskUpdate($request, $params);
    }
}