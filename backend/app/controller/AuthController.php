<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\Auth;
use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class AuthController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function login(Request $request, array $params): Response
    {
        $account = trim((string) ($request->body['account'] ?? ''));
        $password = trim((string) ($request->body['password'] ?? ''));

        if ($account === '' || $password === '') {
            return Response::error(422, 'missing_credentials', [], $request->requestId);
        }

        $users = $this->store->all('users');
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
            return Response::error(401, 'invalid_credentials', [], $request->requestId);
        }

        return Response::success([
            'token' => Auth::DEMO_TOKEN,
            'user' => $this->sanitizeUser($user),
        ], $request->requestId);
    }

    public function logout(Request $request, array $params): Response
    {
        if (!Auth::isAuthorized($request)) {
            return Response::error(401, 'unauthorized', [], $request->requestId);
        }

        return Response::success(['logged_out' => true], $request->requestId);
    }

    public function me(Request $request, array $params): Response
    {
        if (!Auth::isAuthorized($request)) {
            return Response::error(401, 'unauthorized', [], $request->requestId);
        }

        $users = $this->store->all('users');

        return Response::success($this->sanitizeUser($users[0] ?? []), $request->requestId);
    }

    public function permissions(Request $request, array $params): Response
    {
        if (!Auth::isAuthorized($request)) {
            return Response::error(401, 'unauthorized', [], $request->requestId);
        }

        $users = $this->store->all('users');
        $user = $users[0] ?? [];

        return Response::success([
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
