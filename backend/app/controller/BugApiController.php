<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\BugService;
use App\Support\Request as LegacyRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class BugApiController extends BaseApiController
{
    private BugService $service;

    public function __construct()
    {
        $this->service = new BugService();
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

    public function batchSubmit(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->batchSubmit($legacyRequest, []));
    }
}