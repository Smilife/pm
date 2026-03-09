<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\Auth;
use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class PermissionController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function check(Request $request, array $params): Response
    {
        if (!Auth::isAuthorized($request)) {
            return Response::error(401, 'unauthorized', [], $request->requestId);
        }

        $permission = trim((string) ($request->body['permission'] ?? ''));

        if ($permission === '') {
            return Response::error(422, 'missing_permission', [], $request->requestId);
        }

        $users = $this->store->all('users');
        $user = $users[0] ?? [];
        $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return Response::success([
            'permission' => $permission,
            'granted' => in_array($permission, $permissions, true),
            'roles' => $user['roles'] ?? [],
        ], $request->requestId);
    }
}
