<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\WorklogService;
use App\Support\Request as LegacyRequest;
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
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->index($legacyRequest, []));
    }

    public function listByExecution(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->listByExecution($legacyRequest, ['id' => $id]));
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
}