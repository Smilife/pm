<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\AuthService;
use App\Support\ApiContext;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class AuthApiController extends BaseApiController
{
    public function __construct(
        private readonly AuthService $service,
    ) {
    }

    public function login(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->login($apiRequest, []), true);
    }

    public function logout(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->logout($apiRequest, []));
    }

    public function me(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->me($apiRequest, []));
    }

    public function permissions(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiContext $apiRequest) => $this->service->permissions($apiRequest, []));
    }
}