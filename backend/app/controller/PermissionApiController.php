<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\PermissionService;
use App\Support\Request as LegacyRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class PermissionApiController extends BaseApiController
{
    private PermissionService $service;

    public function __construct()
    {
        $this->service = new PermissionService();
    }

    public function check(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->check($legacyRequest, []));
    }
}