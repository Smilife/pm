<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\Auth;
use App\Support\Request;
use App\Support\Response;

final class PermissionController
{
    public function check(Request $request, array $params): Response
    {
        $user = Auth::currentUser($request);
        if ($user === null) {
            return Response::error(401, 'unauthorized', [], $request->requestId);
        }

        $permission = trim((string) ($request->body['permission'] ?? ''));

        if ($permission === '') {
            return Response::error(422, 'missing_permission', [], $request->requestId);
        }

        $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return Response::success([
            'permission' => $permission,
            'granted' => in_array($permission, $permissions, true),
            'roles' => $user['roles'] ?? [],
        ], $request->requestId);
    }
}
