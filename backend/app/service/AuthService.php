<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\Auth;
use App\Support\StoreRegistry;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class AuthService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function login(ApiContext $request, array $params): ThinkResponse
    {
        $account = trim((string) ($request->body['account'] ?? ''));
        $password = trim((string) ($request->body['password'] ?? ''));

        if ($account === '' || $password === '') {
            return ApiResponder::error(422, 'missing_credentials', [], $request->requestId);
        }

        $users = $this->store->allUsers();
        $user = null;

        foreach ($users as $candidate) {
            $candidateAccount = (string) ($candidate['email'] ?? $candidate['name'] ?? '');
            $candidateName = (string) ($candidate['name'] ?? '');
            if ($account === $candidateAccount || $account === $candidateName) {
                $user = $candidate;
                break;
            }
        }

        if ($user === null || $password !== (string) ($user['password'] ?? '')) {
            return ApiResponder::error(401, 'invalid_credentials', [], $request->requestId);
        }

        $updatedUser = $this->store->updateUser((int) ($user['id'] ?? 0), [
            'last_login_at' => date('c'),
        ]);
        if ($updatedUser !== null) {
            $user = $updatedUser;
        }

        return ApiResponder::success([
            'token' => Auth::tokenForUser($user),
            'user' => $this->sanitizeUser($user),
        ], $request->requestId);
    }

    public function logout(ApiContext $request, array $params): ThinkResponse
    {
        if (!Auth::isAuthorized($request)) {
            return ApiResponder::error(401, 'unauthorized', [], $request->requestId);
        }

        return ApiResponder::success(['logged_out' => true], $request->requestId);
    }

    public function me(ApiContext $request, array $params): ThinkResponse
    {
        $user = Auth::currentUser($request);
        if ($user === null) {
            return ApiResponder::error(401, 'unauthorized', [], $request->requestId);
        }

        return ApiResponder::success($this->sanitizeUser($user), $request->requestId);
    }

    public function permissions(ApiContext $request, array $params): ThinkResponse
    {
        $user = Auth::currentUser($request);
        if ($user === null) {
            return ApiResponder::error(401, 'unauthorized', [], $request->requestId);
        }

        return ApiResponder::success([
            'roles' => $user['roles'] ?? [],
            'permissions' => $user['permissions'] ?? [],
        ], $request->requestId);
    }

    private function sanitizeUser(array $user): array
    {
        unset($user['password']);

        return $user;
    }
}
