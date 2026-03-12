<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\RequirementService;
use App\Support\Request as LegacyRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class RequirementApiController extends BaseApiController
{
    private RequirementService $service;

    public function __construct()
    {
        $this->service = new RequirementService();
    }

    public function index(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->index($legacyRequest, []));
    }

    public function store(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->store($legacyRequest, []));
    }

    public function batchGenerateExecutions(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->batchGenerateExecutions($legacyRequest, []));
    }

    public function batchGenerateTasks(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->batchGenerateExecutions($legacyRequest, []));
    }

    public function show(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->show($legacyRequest, ['id' => $id]));
    }

    public function update(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->update($legacyRequest, ['id' => $id]));
    }

    public function storeAttachment(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storeAttachment($legacyRequest, ['id' => $id]));
    }

    public function submitForReview(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->submitForReview($legacyRequest, ['id' => $id]));
    }

    public function storeReview(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storeReview($legacyRequest, ['id' => $id]));
    }

    public function listReviews(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->listReviews($legacyRequest, ['id' => $id]));
    }
}