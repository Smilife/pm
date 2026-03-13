<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ScheduleService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ScheduleApiController extends BaseApiController
{
    public function __construct(
        private readonly ScheduleService $service,
    ) {
    }

    public function projectGantt(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->projectGantt($apiRequest, []));
    }

    public function teamGantt(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->teamGantt($apiRequest, []));
    }

    public function executionGantt(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->executionGantt($apiRequest, []));
    }
}
