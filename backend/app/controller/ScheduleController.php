<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\ScheduleService;
use App\Support\Request;
use App\Support\Response;

final class ScheduleController
{
    private ScheduleService $service;

    public function __construct()
    {
        $this->service = new ScheduleService();
    }

    public function teamGantt(Request $request, array $params): Response
    {
        return $this->service->teamGantt($request, $params);
    }

    public function executionGantt(Request $request, array $params): Response
    {
        return $this->service->executionGantt($request, $params);
    }
}