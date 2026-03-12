<?php

declare(strict_types=1);

namespace app\controller;

use App\Service\SettingsService;
use App\Support\Request as LegacyRequest;
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
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->members($legacyRequest, []));
    }

    public function storeMember(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storeMember($legacyRequest, []));
    }

    public function updateMember(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->updateMember($legacyRequest, ['id' => $id]));
    }

    public function roles(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->roles($legacyRequest, []));
    }

    public function storeRole(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storeRole($legacyRequest, []));
    }

    public function updateRole(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->updateRole($legacyRequest, ['id' => $id]));
    }

    public function destroyRole(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->destroyRole($legacyRequest, ['id' => $id]));
    }

    public function policies(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->policies($legacyRequest, []));
    }

    public function storePolicy(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storePolicy($legacyRequest, []));
    }

    public function updatePolicy(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->updatePolicy($legacyRequest, ['id' => $id]));
    }

    public function destroyPolicy(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->destroyPolicy($legacyRequest, ['id' => $id]));
    }

    public function dictionaries(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->dictionaries($legacyRequest, []));
    }

    public function storeDictionary(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storeDictionary($legacyRequest, []));
    }

    public function updateDictionary(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->updateDictionary($legacyRequest, ['id' => $id]));
    }

    public function destroyDictionary(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->destroyDictionary($legacyRequest, ['id' => $id]));
    }

    public function workflows(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->workflows($legacyRequest, []));
    }

    public function storeWorkflow(ThinkRequest $request): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->storeWorkflow($legacyRequest, []));
    }

    public function updateWorkflow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->updateWorkflow($legacyRequest, ['id' => $id]));
    }

    public function destroyWorkflow(ThinkRequest $request, int $id): ThinkResponse
    {
        return $this->run($request, fn (LegacyRequest $legacyRequest) => $this->service->destroyWorkflow($legacyRequest, ['id' => $id]));
    }
}