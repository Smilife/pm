<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\RequirementService;
use App\Support\Request;
use App\Support\Response;

final class RequirementController
{
    private RequirementService $service;

    public function __construct()
    {
        $this->service = new RequirementService();
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

    public function storeAttachment(Request $request, array $params): Response
    {
        return $this->service->storeAttachment($request, $params);
    }

    public function submitForReview(Request $request, array $params): Response
    {
        return $this->service->submitForReview($request, $params);
    }

    public function storeReview(Request $request, array $params): Response
    {
        return $this->service->storeReview($request, $params);
    }

    public function listReviews(Request $request, array $params): Response
    {
        return $this->service->listReviews($request, $params);
    }

    public function batchGenerateExecutions(Request $request, array $params): Response
    {
        return $this->service->batchGenerateExecutions($request, $params);
    }
}