<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ScheduleService;
use App\Support\Request as LegacyRequest;
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
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->teamGantt($legacyRequest, []));
    }

    public function executionGantt(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->executionGantt($legacyRequest, []));
    }
}