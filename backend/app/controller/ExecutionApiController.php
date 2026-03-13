<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ExecutionService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ExecutionApiController extends BaseApiController
{
    public function __construct(
        private readonly ExecutionService $service,
    ) {
    }

    public function index(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->index($apiRequest, []));
    }

    public function store(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->store($apiRequest, []));
    }

    public function show(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->show($apiRequest, ['id' => $id]));
    }

    public function update(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->update($apiRequest, ['id' => $id]));
    }

    public function listTasks(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->listTasks($apiRequest, ['id' => $id]));
    }

    public function taskIndex(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->taskIndex($apiRequest, []));
    }

    public function taskStore(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->taskStore($apiRequest, []));
    }

    public function taskShow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->taskShow($apiRequest, ['id' => $id]));
    }

    public function taskUpdate(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->taskUpdate($apiRequest, ['id' => $id]));
    }
}