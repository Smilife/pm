<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\PermissionService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class PermissionApiController extends BaseApiController
{
    public function __construct(
        private readonly PermissionService $service,
    ) {
    }

    public function check(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->check($apiRequest, []));
    }
}