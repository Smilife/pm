<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ScheduleService;
use App\Support\Request as ApiRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ScheduleApiController extends BaseApiController
{
    private ScheduleService $service;

    public function __construct()
    {
        $this->service = new ScheduleService();
    }

    public function teamGantt(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->teamGantt($apiRequest, []));
    }

    public function executionGantt(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->executionGantt($apiRequest, []));
    }
}