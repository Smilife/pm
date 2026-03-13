<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\RequirementService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class RequirementApiController extends BaseApiController
{
    public function __construct(
        private readonly RequirementService $service,
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

    public function batchGenerateExecutions(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->batchGenerateExecutions($apiRequest, []));
    }

    public function batchGenerateTasks(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->batchGenerateExecutions($apiRequest, []));
    }

    public function show(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->show($apiRequest, ['id' => $id]));
    }

    public function update(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->update($apiRequest, ['id' => $id]));
    }

    public function storeAttachment(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->storeAttachment($apiRequest, ['id' => $id]));
    }

    public function submitForReview(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->submitForReview($apiRequest, ['id' => $id]));
    }

    public function storeReview(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->storeReview($apiRequest, ['id' => $id]));
    }

    public function listReviews(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->listReviews($apiRequest, ['id' => $id]));
    }
}