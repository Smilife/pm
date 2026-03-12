<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\PermissionService;
use App\Support\Request;
use App\Support\Response;

final class PermissionController
{
    private PermissionService $service;

    public function __construct()
    {
        $this->service = new PermissionService();
    }

    public function check(Request $request, array $params): Response
    {
        return $this->service->check($request, $params);
    }
}