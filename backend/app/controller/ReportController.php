<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\ReportService;
use App\Support\Request;
use App\Support\Response;

final class ReportController
{
    private ReportService $service;

    public function __construct()
    {
        $this->service = new ReportService();
    }

    public function generateDaily(Request $request, array $params): Response
    {
        return $this->service->generateDaily($request, $params);
    }

    public function generateWeekly(Request $request, array $params): Response
    {
        return $this->service->generateWeekly($request, $params);
    }
}