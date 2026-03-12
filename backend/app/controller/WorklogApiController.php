<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\WorklogService;
use App\Support\Request as ApiRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class WorklogApiController extends BaseApiController
{
    private WorklogService $service;

    public function __construct()
    {
        $this->service = new WorklogService();
    }

    public function index(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->index($apiRequest, []));
    }

    public function listByExecution(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->listByExecution($apiRequest, ['id' => $id]));
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
}