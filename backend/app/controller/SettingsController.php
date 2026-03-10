<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class SettingsController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function members(Request $request, array $params): Response
    {
        $items = array_map(function (array $user): array {
            $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
            $roles = is_array($user['roles'] ?? null) ? $user['roles'] : [];

            return [
                'id' => (int) ($user['id'] ?? 0),
                'name' => (string) ($user['name'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'department' => (string) ($user['department'] ?? 'Unknown'),
                'title' => (string) ($user['title'] ?? 'Team member'),
                'status' => (string) ($user['status'] ?? 'Active'),
                'roles' => array_values(array_map(static fn ($item): string => (string) $item, $roles)),
                'permission_count' => count($permissions),
                'dingtalk_bound' => (bool) ($user['dingtalk_bound'] ?? false),
                'last_login_at' => (string) ($user['last_login_at'] ?? ''),
            ];
        }, $this->store->all('users'));

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function roles(Request $request, array $params): Response
    {
        $users = $this->store->all('users');
        $items = array_map(function (array $role) use ($users): array {
            $roleKey = (string) ($role['key'] ?? '');
            $userCount = count(array_filter(
                $users,
                static fn (array $user): bool => in_array($roleKey, is_array($user['roles'] ?? null) ? $user['roles'] : [], true)
            ));

            return [
                'id' => (int) ($role['id'] ?? 0),
                'key' => $roleKey,
                'name' => (string) ($role['name'] ?? ''),
                'scope' => (string) ($role['scope'] ?? 'org'),
                'description' => (string) ($role['description'] ?? ''),
                'user_count' => $userCount,
                'permissions' => array_values(array_map(static fn ($item): string => (string) $item, is_array($role['permissions'] ?? null) ? $role['permissions'] : [])),
            ];
        }, $this->store->all('roles'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function policies(Request $request, array $params): Response
    {
        $items = array_map(function (array $policy): array {
            return [
                'id' => (int) ($policy['id'] ?? 0),
                'name' => (string) ($policy['name'] ?? ''),
                'scope' => (string) ($policy['scope'] ?? 'org'),
                'description' => (string) ($policy['description'] ?? ''),
                'permissions' => array_values(array_map(static fn ($item): string => (string) $item, is_array($policy['permissions'] ?? null) ? $policy['permissions'] : [])),
            ];
        }, $this->store->all('policies'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function dictionaries(Request $request, array $params): Response
    {
        $items = array_map(function (array $dictionary): array {
            return [
                'id' => (int) ($dictionary['id'] ?? 0),
                'key' => (string) ($dictionary['key'] ?? ''),
                'name' => (string) ($dictionary['name'] ?? ''),
                'values' => array_values(array_map(static fn ($item): string => (string) $item, is_array($dictionary['values'] ?? null) ? $dictionary['values'] : [])),
                'updated_at' => (string) ($dictionary['updated_at'] ?? ''),
            ];
        }, $this->store->all('dictionaries'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function workflows(Request $request, array $params): Response
    {
        $items = array_map(function (array $workflow): array {
            return [
                'id' => (int) ($workflow['id'] ?? 0),
                'name' => (string) ($workflow['name'] ?? ''),
                'scope' => (string) ($workflow['scope'] ?? 'org'),
                'stages' => array_values(array_map(static fn ($item): string => (string) $item, is_array($workflow['stages'] ?? null) ? $workflow['stages'] : [])),
                'enabled' => (bool) ($workflow['enabled'] ?? false),
                'updated_at' => (string) ($workflow['updated_at'] ?? ''),
            ];
        }, $this->store->all('workflows'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }
}
