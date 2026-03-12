<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ExecutionService;
use App\Support\Request as ApiRequest;
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
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->index($apiRequest, []));
    }

    public function store(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->store($apiRequest, []));
    }

    public function show(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->show($apiRequest, ['id' => $id]));
    }

    public function update(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->update($apiRequest, ['id' => $id]));
    }

    public function listTasks(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->listTasks($apiRequest, ['id' => $id]));
    }

    public function taskIndex(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->taskIndex($apiRequest, []));
    }

    public function taskStore(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->taskStore($apiRequest, []));
    }

    public function taskShow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->taskShow($apiRequest, ['id' => $id]));
    }

    public function taskUpdate(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->taskUpdate($apiRequest, ['id' => $id]));
    }
}