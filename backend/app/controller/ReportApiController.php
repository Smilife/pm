<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ReportService;
use App\Support\Request as ApiRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ReportApiController extends BaseApiController
{
    private ReportService $service;

    public function __construct()
    {
        $this->service = new ReportService();
    }

    public function generateDaily(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->generateDaily($apiRequest, []));
    }

    public function generateWeekly(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->generateWeekly($apiRequest, []));
    }
}