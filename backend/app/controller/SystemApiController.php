<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\SystemService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class SystemApiController extends BaseApiController
{
    public function __construct(
        private readonly SystemService $service,
    ) {
    }

    public function summary(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->summary($apiRequest, []));
    }
}