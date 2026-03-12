<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\SystemService;
use App\Support\Request;
use App\Support\Response;

final class SystemController
{
    private SystemService $service;

    public function __construct()
    {
        $this->service = new SystemService();
    }

    public function summary(Request $request, array $params): Response
    {
        return $this->service->summary($request, $params);
    }
}