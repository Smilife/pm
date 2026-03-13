<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\Auth;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class PermissionService
{
    public function check(ApiContext $request, array $params): ThinkResponse
    {
        $user = Auth::currentUser($request);
        if ($user === null) {
            return ApiResponder::error(401, 'unauthorized', [], $request->requestId);
        }

        $permission = trim((string) ($request->body['permission'] ?? ''));

        if ($permission === '') {
            return ApiResponder::error(422, 'missing_permission', [], $request->requestId);
        }

        $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return ApiResponder::success([
            'permission' => $permission,
            'granted' => in_array($permission, $permissions, true),
            'roles' => $user['roles'] ?? [],
        ], $request->requestId);
    }
}
