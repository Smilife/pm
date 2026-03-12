<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\AuthService;
use App\Support\Request;
use App\Support\Response;

final class AuthController
{
    private AuthService $service;

    public function __construct()
    {
        $this->service = new AuthService();
    }

    public function login(Request $request, array $params): Response
    {
        return $this->service->login($request, $params);
    }

    public function logout(Request $request, array $params): Response
    {
        return $this->service->logout($request, $params);
    }

    public function me(Request $request, array $params): Response
    {
        return $this->service->me($request, $params);
    }

    public function permissions(Request $request, array $params): Response
    {
        return $this->service->permissions($request, $params);
    }
}