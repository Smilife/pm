<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\SettingsService;
use App\Support\Request;
use App\Support\Response;

final class SettingsController
{
    private SettingsService $service;

    public function __construct()
    {
        $this->service = new SettingsService();
    }

    public function members(Request $request, array $params): Response
    {
        return $this->service->members($request, $params);
    }

    public function storeMember(Request $request, array $params): Response
    {
        return $this->service->storeMember($request, $params);
    }

    public function updateMember(Request $request, array $params): Response
    {
        return $this->service->updateMember($request, $params);
    }

    public function roles(Request $request, array $params): Response
    {
        return $this->service->roles($request, $params);
    }

    public function storeRole(Request $request, array $params): Response
    {
        return $this->service->storeRole($request, $params);
    }

    public function updateRole(Request $request, array $params): Response
    {
        return $this->service->updateRole($request, $params);
    }

    public function destroyRole(Request $request, array $params): Response
    {
        return $this->service->destroyRole($request, $params);
    }

    public function policies(Request $request, array $params): Response
    {
        return $this->service->policies($request, $params);
    }

    public function storePolicy(Request $request, array $params): Response
    {
        return $this->service->storePolicy($request, $params);
    }

    public function updatePolicy(Request $request, array $params): Response
    {
        return $this->service->updatePolicy($request, $params);
    }

    public function destroyPolicy(Request $request, array $params): Response
    {
        return $this->service->destroyPolicy($request, $params);
    }

    public function dictionaries(Request $request, array $params): Response
    {
        return $this->service->dictionaries($request, $params);
    }

    public function storeDictionary(Request $request, array $params): Response
    {
        return $this->service->storeDictionary($request, $params);
    }

    public function updateDictionary(Request $request, array $params): Response
    {
        return $this->service->updateDictionary($request, $params);
    }

    public function destroyDictionary(Request $request, array $params): Response
    {
        return $this->service->destroyDictionary($request, $params);
    }

    public function workflows(Request $request, array $params): Response
    {
        return $this->service->workflows($request, $params);
    }

    public function storeWorkflow(Request $request, array $params): Response
    {
        return $this->service->storeWorkflow($request, $params);
    }

    public function updateWorkflow(Request $request, array $params): Response
    {
        return $this->service->updateWorkflow($request, $params);
    }

    public function destroyWorkflow(Request $request, array $params): Response
    {
        return $this->service->destroyWorkflow($request, $params);
    }
}