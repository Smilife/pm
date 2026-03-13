<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\PerformanceService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class PerformanceApiController extends BaseApiController
{
    public function __construct(
        private readonly PerformanceService $service,
    ) {
    }

    public function members(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->members($apiRequest, []));
    }
}