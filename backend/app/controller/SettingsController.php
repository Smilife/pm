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
        $items = array_map(fn (array $user): array => $this->mapMember($user), $this->store->all('users'));

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeMember(Request $request, array $params): Response
    {
        $error = $this->validateMemberRequest($request);
        if ($error !== null) {
            return $error;
        }

        $email = trim((string) ($request->body['email'] ?? ''));
        if ($this->emailExists($email)) {
            return Response::error(422, 'duplicate_member_email', [], $request->requestId);
        }

        $roles = $this->normalizeRoles($request->body['roles'] ?? []);
        $payload = [
            'name' => trim((string) ($request->body['name'] ?? '')),
            'email' => $email,
            'password' => 'demo123',
            'department' => trim((string) ($request->body['department'] ?? 'General')),
            'title' => trim((string) ($request->body['title'] ?? 'Team member')),
            'status' => $this->normalizeMemberStatus((string) ($request->body['status'] ?? 'Invited')),
            'roles' => $roles,
            'permissions' => $this->permissionsForRoles($roles),
            'dingtalk_bound' => (bool) ($request->body['dingtalk_bound'] ?? false),
            'last_login_at' => '',
        ];

        $created = $this->store->create('users', $payload);

        return Response::success($this->mapMember($created), $request->requestId);
    }

    public function updateMember(Request $request, array $params): Response
    {
        $memberId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('users', $memberId);

        if ($current === null) {
            return Response::error(404, 'member_not_found', [], $request->requestId);
        }

        $error = $this->validateMemberRequest($request, $current);
        if ($error !== null) {
            return $error;
        }

        $email = trim((string) ($request->body['email'] ?? ($current['email'] ?? '')));
        if ($this->emailExists($email, $memberId)) {
            return Response::error(422, 'duplicate_member_email', [], $request->requestId);
        }

        $roles = $this->normalizeRoles($request->body['roles'] ?? ($current['roles'] ?? []));
        $updated = $this->store->update('users', $memberId, [
            'name' => trim((string) ($request->body['name'] ?? ($current['name'] ?? ''))),
            'email' => $email,
            'department' => trim((string) ($request->body['department'] ?? ($current['department'] ?? 'General'))),
            'title' => trim((string) ($request->body['title'] ?? ($current['title'] ?? 'Team member'))),
            'status' => $this->normalizeMemberStatus((string) ($request->body['status'] ?? ($current['status'] ?? 'Active'))),
            'roles' => $roles,
            'permissions' => $this->permissionsForRoles($roles),
            'dingtalk_bound' => (bool) ($request->body['dingtalk_bound'] ?? ($current['dingtalk_bound'] ?? false)),
        ]);

        if ($updated === null) {
            return Response::error(404, 'member_not_found', [], $request->requestId);
        }

        return Response::success($this->mapMember($updated), $request->requestId);
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

    private function validateMemberRequest(Request $request, ?array $current = null): ?Response
    {
        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $email = trim((string) ($request->body['email'] ?? ($current['email'] ?? '')));
        $roles = $this->normalizeRoles($request->body['roles'] ?? ($current['roles'] ?? []));

        if ($name === '') {
            return Response::error(422, 'missing_member_name', [], $request->requestId);
        }

        if ($email === '') {
            return Response::error(422, 'missing_member_email', [], $request->requestId);
        }

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return Response::error(422, 'invalid_member_email', [], $request->requestId);
        }

        if ($roles === []) {
            return Response::error(422, 'missing_member_roles', [], $request->requestId);
        }

        return null;
    }

    private function mapMember(array $user): array
    {
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
    }

    private function normalizeRoles(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $roleKeys = array_column($this->store->all('roles'), 'key');
        $normalized = array_values(array_unique(array_filter(array_map(
            static fn ($item): string => trim((string) $item),
            $value
        ), static fn (string $item): bool => $item !== '' && in_array($item, $roleKeys, true))));

        return $normalized;
    }

    private function permissionsForRoles(array $roles): array
    {
        $roleMap = [];
        foreach ($this->store->all('roles') as $role) {
            $roleKey = (string) ($role['key'] ?? '');
            if ($roleKey !== '') {
                $roleMap[$roleKey] = is_array($role['permissions'] ?? null) ? $role['permissions'] : [];
            }
        }

        $permissions = [];
        foreach ($roles as $roleKey) {
            foreach ($roleMap[$roleKey] ?? [] as $permission) {
                $permissions[] = (string) $permission;
            }
        }

        $permissions = array_values(array_unique(array_filter($permissions, static fn (string $item): bool => $item !== '')));
        sort($permissions);

        return $permissions;
    }

    private function normalizeMemberStatus(string $status): string
    {
        return in_array($status, ['Active', 'Invited'], true) ? $status : 'Invited';
    }

    private function emailExists(string $email, ?int $excludeMemberId = null): bool
    {
        foreach ($this->store->all('users') as $user) {
            $userId = (int) ($user['id'] ?? 0);
            if ($excludeMemberId !== null && $excludeMemberId === $userId) {
                continue;
            }

            if (strcasecmp((string) ($user['email'] ?? ''), $email) === 0) {
                return true;
            }
        }

        return false;
    }
}
