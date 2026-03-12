<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\PerformanceService;
use App\Support\Request as ApiRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class PerformanceApiController extends BaseApiController
{
    private PerformanceService $service;

    public function __construct()
    {
        $this->service = new PerformanceService();
    }

    public function members(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->members($apiRequest, []));
    }
}