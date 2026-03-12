<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ExecutionService;
use App\Support\Request as LegacyRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ExecutionApiController extends BaseApiController
{
    private ExecutionService $service;

    public function __construct()
    {
        $this->service = new ExecutionService();
    }

    public function index(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->index($legacyRequest, []));
    }

    public function store(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->store($legacyRequest, []));
    }

    public function show(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->show($legacyRequest, ['id' => $id]));
    }

    public function update(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->update($legacyRequest, ['id' => $id]));
    }

    public function listTasks(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->listTasks($legacyRequest, ['id' => $id]));
    }

    public function taskIndex(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->taskIndex($legacyRequest, []));
    }

    public function taskStore(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->taskStore($legacyRequest, []));
    }

    public function taskShow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->taskShow($legacyRequest, ['id' => $id]));
    }

    public function taskUpdate(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->taskUpdate($legacyRequest, ['id' => $id]));
    }
}