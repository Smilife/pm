<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\ProjectService;
use App\Support\Request;
use App\Support\Response;

final class ProjectController
{
    private ProjectService $service;

    public function __construct()
    {
        $this->service = new ProjectService();
    }

    public function index(Request $request, array $params): Response
    {
        return $this->service->index($request, $params);
    }

    public function store(Request $request, array $params): Response
    {
        return $this->service->store($request, $params);
    }

    public function show(Request $request, array $params): Response
    {
        return $this->service->show($request, $params);
    }

    public function update(Request $request, array $params): Response
    {
        return $this->service->update($request, $params);
    }
}