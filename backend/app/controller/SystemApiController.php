<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\SystemService;
use App\Support\Request as ApiRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class SystemApiController extends BaseApiController
{
    private SystemService $service;

    public function __construct()
    {
        $this->service = new SystemService();
    }

    public function summary(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->summary($apiRequest, []));
    }
}