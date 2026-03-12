<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\PerformanceService;
use App\Support\Request;
use App\Support\Response;

final class PerformanceController
{
    private PerformanceService $service;

    public function __construct()
    {
        $this->service = new PerformanceService();
    }

    public function members(Request $request, array $params): Response
    {
        return $this->service->members($request, $params);
    }
}