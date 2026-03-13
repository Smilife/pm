<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\ReportService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ReportApiController extends BaseApiController
{
    public function __construct(
        private readonly ReportService $service,
    ) {
    }

    public function generateDaily(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->generateDaily($apiRequest, []));
    }

    public function generateWeekly(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->generateWeekly($apiRequest, []));
    }
}