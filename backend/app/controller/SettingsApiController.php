<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\SettingsService;
use App\Support\Request as ApiRequest;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class SettingsApiController extends BaseApiController
{
    private SettingsService $service;

    public function __construct()
    {
        $this->service = new SettingsService();
    }

    public function members(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->members($apiRequest, []));
    }

    public function storeMember(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->storeMember($apiRequest, []));
    }

    public function updateMember(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->updateMember($apiRequest, ['id' => $id]));
    }

    public function roles(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->roles($apiRequest, []));
    }

    public function storeRole(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->storeRole($apiRequest, []));
    }

    public function updateRole(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->updateRole($apiRequest, ['id' => $id]));
    }

    public function destroyRole(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->destroyRole($apiRequest, ['id' => $id]));
    }

    public function policies(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->policies($apiRequest, []));
    }

    public function storePolicy(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->storePolicy($apiRequest, []));
    }

    public function updatePolicy(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->updatePolicy($apiRequest, ['id' => $id]));
    }

    public function destroyPolicy(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->destroyPolicy($apiRequest, ['id' => $id]));
    }

    public function dictionaries(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->dictionaries($apiRequest, []));
    }

    public function storeDictionary(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->storeDictionary($apiRequest, []));
    }

    public function updateDictionary(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->updateDictionary($apiRequest, ['id' => $id]));
    }

    public function destroyDictionary(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->destroyDictionary($apiRequest, ['id' => $id]));
    }

    public function workflows(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->workflows($apiRequest, []));
    }

    public function storeWorkflow(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->storeWorkflow($apiRequest, []));
    }

    public function updateWorkflow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->updateWorkflow($apiRequest, ['id' => $id]));
    }

    public function destroyWorkflow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (ApiRequest $apiRequest) => $this->service->destroyWorkflow($apiRequest, ['id' => $id]));
    }
}