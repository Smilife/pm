<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class SettingsService
{
    private const VALID_SCOPES = ['org', 'project', 'self'];

    private const PROTECTED_DICTIONARY_KEYS = ['requirement_status', 'execution_status', 'bug_severity', 'project_status'];

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
        $created = $this->store->create('users', [
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
        ]);

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
        $items = array_map(fn (array $role): array => $this->mapRole($role), $this->store->all('roles'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeRole(Request $request, array $params): Response
    {
        $key = $this->normalizeMachineKey((string) ($request->body['key'] ?? ''));
        $name = trim((string) ($request->body['name'] ?? ''));
        $description = trim((string) ($request->body['description'] ?? ''));
        $scope = (string) ($request->body['scope'] ?? 'org');
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? []);

        if ($key === '') {
            return Response::error(422, 'missing_role_key', [], $request->requestId);
        }
        if (!preg_match('/^[a-z][a-z0-9_]*$/', $key)) {
            return Response::error(422, 'invalid_role_key', [], $request->requestId);
        }
        if ($this->machineKeyExists('roles', $key)) {
            return Response::error(422, 'duplicate_role_key', [], $request->requestId);
        }
        if ($name === '') {
            return Response::error(422, 'missing_role_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return Response::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return Response::error(422, 'missing_role_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return Response::error(422, 'missing_role_permissions', [], $request->requestId);
        }

        $created = $this->store->create('roles', [
            'key' => $key,
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        return Response::success($this->mapRole($created), $request->requestId);
    }

    public function updateRole(Request $request, array $params): Response
    {
        $roleId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('roles', $roleId);
        if ($current === null) {
            return Response::error(404, 'role_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $description = trim((string) ($request->body['description'] ?? ($current['description'] ?? '')));
        $scope = (string) ($request->body['scope'] ?? ($current['scope'] ?? 'org'));
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? ($current['permissions'] ?? []));

        if ($name === '') {
            return Response::error(422, 'missing_role_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return Response::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return Response::error(422, 'missing_role_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return Response::error(422, 'missing_role_permissions', [], $request->requestId);
        }

        $updated = $this->store->update('roles', $roleId, [
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        if ($updated === null) {
            return Response::error(404, 'role_not_found', [], $request->requestId);
        }

        $this->syncUsersForRole((string) ($current['key'] ?? ''));

        return Response::success($this->mapRole($updated), $request->requestId);
    }

    public function destroyRole(Request $request, array $params): Response
    {
        $roleId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('roles', $roleId);
        if ($current === null) {
            return Response::error(404, 'role_not_found', [], $request->requestId);
        }

        $roleKey = (string) ($current['key'] ?? '');
        $userCount = $this->roleUserCount($roleKey);
        if ($userCount > 0) {
            return Response::error(409, 'role_in_use', ['user_count' => $userCount], $request->requestId);
        }

        $deleted = $this->store->delete('roles', $roleId);
        if ($deleted === null) {
            return Response::error(404, 'role_not_found', [], $request->requestId);
        }

        return Response::success($this->mapRole($deleted), $request->requestId);
    }

    public function policies(Request $request, array $params): Response
    {
        $items = array_map(fn (array $policy): array => $this->mapPolicy($policy), $this->store->all('policies'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storePolicy(Request $request, array $params): Response
    {
        $name = trim((string) ($request->body['name'] ?? ''));
        $description = trim((string) ($request->body['description'] ?? ''));
        $scope = (string) ($request->body['scope'] ?? 'org');
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? []);

        if ($name === '') {
            return Response::error(422, 'missing_policy_name', [], $request->requestId);
        }
        if ($this->nameExists('policies', $name)) {
            return Response::error(422, 'duplicate_policy_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return Response::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return Response::error(422, 'missing_policy_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return Response::error(422, 'missing_policy_permissions', [], $request->requestId);
        }

        $created = $this->store->create('policies', [
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        return Response::success($this->mapPolicy($created), $request->requestId);
    }

    public function updatePolicy(Request $request, array $params): Response
    {
        $policyId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('policies', $policyId);
        if ($current === null) {
            return Response::error(404, 'policy_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $description = trim((string) ($request->body['description'] ?? ($current['description'] ?? '')));
        $scope = (string) ($request->body['scope'] ?? ($current['scope'] ?? 'org'));
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? ($current['permissions'] ?? []));

        if ($name === '') {
            return Response::error(422, 'missing_policy_name', [], $request->requestId);
        }
        if ($this->nameExists('policies', $name, $policyId)) {
            return Response::error(422, 'duplicate_policy_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return Response::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return Response::error(422, 'missing_policy_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return Response::error(422, 'missing_policy_permissions', [], $request->requestId);
        }

        $updated = $this->store->update('policies', $policyId, [
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        if ($updated === null) {
            return Response::error(404, 'policy_not_found', [], $request->requestId);
        }

        return Response::success($this->mapPolicy($updated), $request->requestId);
    }

    public function destroyPolicy(Request $request, array $params): Response
    {
        $policyId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('policies', $policyId);
        if ($current === null) {
            return Response::error(404, 'policy_not_found', [], $request->requestId);
        }

        $deleted = $this->store->delete('policies', $policyId);
        if ($deleted === null) {
            return Response::error(404, 'policy_not_found', [], $request->requestId);
        }

        return Response::success($this->mapPolicy($deleted), $request->requestId);
    }

    public function dictionaries(Request $request, array $params): Response
    {
        $items = array_map(fn (array $dictionary): array => $this->mapDictionary($dictionary), $this->store->all('dictionaries'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeDictionary(Request $request, array $params): Response
    {
        $key = $this->normalizeMachineKey((string) ($request->body['key'] ?? ''));
        $name = trim((string) ($request->body['name'] ?? ''));
        $values = $this->normalizeStringList($request->body['values'] ?? []);

        if ($key === '') {
            return Response::error(422, 'missing_dictionary_key', [], $request->requestId);
        }
        if (!preg_match('/^[a-z][a-z0-9_]*$/', $key)) {
            return Response::error(422, 'invalid_dictionary_key', [], $request->requestId);
        }
        if ($this->machineKeyExists('dictionaries', $key)) {
            return Response::error(422, 'duplicate_dictionary_key', [], $request->requestId);
        }
        if ($name === '') {
            return Response::error(422, 'missing_dictionary_name', [], $request->requestId);
        }
        if ($values === []) {
            return Response::error(422, 'missing_dictionary_values', [], $request->requestId);
        }

        $created = $this->store->create('dictionaries', [
            'key' => $key,
            'name' => $name,
            'values' => $values,
            'updated_at' => date('c'),
        ]);

        return Response::success($this->mapDictionary($created), $request->requestId);
    }

    public function updateDictionary(Request $request, array $params): Response
    {
        $dictionaryId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('dictionaries', $dictionaryId);
        if ($current === null) {
            return Response::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $values = $this->normalizeStringList($request->body['values'] ?? ($current['values'] ?? []));

        if ($name === '') {
            return Response::error(422, 'missing_dictionary_name', [], $request->requestId);
        }
        if ($values === []) {
            return Response::error(422, 'missing_dictionary_values', [], $request->requestId);
        }

        $updated = $this->store->update('dictionaries', $dictionaryId, [
            'name' => $name,
            'values' => $values,
            'updated_at' => date('c'),
        ]);

        if ($updated === null) {
            return Response::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        return Response::success($this->mapDictionary($updated), $request->requestId);
    }

    public function destroyDictionary(Request $request, array $params): Response
    {
        $dictionaryId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('dictionaries', $dictionaryId);
        if ($current === null) {
            return Response::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        $key = (string) ($current['key'] ?? '');
        if ($this->isProtectedDictionaryKey($key)) {
            return Response::error(409, 'dictionary_locked', ['key' => $key], $request->requestId);
        }

        $deleted = $this->store->delete('dictionaries', $dictionaryId);
        if ($deleted === null) {
            return Response::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        return Response::success($this->mapDictionary($deleted), $request->requestId);
    }

    public function workflows(Request $request, array $params): Response
    {
        $items = array_map(fn (array $workflow): array => $this->mapWorkflow($workflow), $this->store->all('workflows'));

        return Response::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeWorkflow(Request $request, array $params): Response
    {
        $name = trim((string) ($request->body['name'] ?? ''));
        $scope = (string) ($request->body['scope'] ?? 'org');
        $stages = $this->normalizeStringList($request->body['stages'] ?? []);
        $enabled = (bool) ($request->body['enabled'] ?? false);

        if ($name === '') {
            return Response::error(422, 'missing_workflow_name', [], $request->requestId);
        }
        if ($this->nameExists('workflows', $name)) {
            return Response::error(422, 'duplicate_workflow_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return Response::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($stages === []) {
            return Response::error(422, 'missing_workflow_stages', [], $request->requestId);
        }

        $created = $this->store->create('workflows', [
            'name' => $name,
            'scope' => $scope,
            'stages' => $stages,
            'enabled' => $enabled,
            'updated_at' => date('c'),
        ]);

        return Response::success($this->mapWorkflow($created), $request->requestId);
    }

    public function updateWorkflow(Request $request, array $params): Response
    {
        $workflowId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('workflows', $workflowId);
        if ($current === null) {
            return Response::error(404, 'workflow_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $scope = (string) ($request->body['scope'] ?? ($current['scope'] ?? 'org'));
        $stages = $this->normalizeStringList($request->body['stages'] ?? ($current['stages'] ?? []));
        $enabled = array_key_exists('enabled', $request->body) ? (bool) $request->body['enabled'] : (bool) ($current['enabled'] ?? false);

        if ($name === '') {
            return Response::error(422, 'missing_workflow_name', [], $request->requestId);
        }
        if ($this->nameExists('workflows', $name, $workflowId)) {
            return Response::error(422, 'duplicate_workflow_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return Response::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($stages === []) {
            return Response::error(422, 'missing_workflow_stages', [], $request->requestId);
        }

        $updated = $this->store->update('workflows', $workflowId, [
            'name' => $name,
            'scope' => $scope,
            'stages' => $stages,
            'enabled' => $enabled,
            'updated_at' => date('c'),
        ]);

        if ($updated === null) {
            return Response::error(404, 'workflow_not_found', [], $request->requestId);
        }

        return Response::success($this->mapWorkflow($updated), $request->requestId);
    }

    public function destroyWorkflow(Request $request, array $params): Response
    {
        $workflowId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('workflows', $workflowId);
        if ($current === null) {
            return Response::error(404, 'workflow_not_found', [], $request->requestId);
        }

        $deleted = $this->store->delete('workflows', $workflowId);
        if ($deleted === null) {
            return Response::error(404, 'workflow_not_found', [], $request->requestId);
        }

        return Response::success($this->mapWorkflow($deleted), $request->requestId);
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
        $roles = is_array($user['roles'] ?? null) ? $user['roles'] : [];
        $permissions = $this->permissionsForRoles($roles);

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

    private function mapRole(array $role): array
    {
        $roleKey = (string) ($role['key'] ?? '');
        $userCount = count(array_filter(
            $this->store->all('users'),
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
    }

    private function mapPolicy(array $policy): array
    {
        return [
            'id' => (int) ($policy['id'] ?? 0),
            'name' => (string) ($policy['name'] ?? ''),
            'scope' => (string) ($policy['scope'] ?? 'org'),
            'description' => (string) ($policy['description'] ?? ''),
            'permissions' => array_values(array_map(static fn ($item): string => (string) $item, is_array($policy['permissions'] ?? null) ? $policy['permissions'] : [])),
        ];
    }

    private function mapDictionary(array $dictionary): array
    {
        return [
            'id' => (int) ($dictionary['id'] ?? 0),
            'key' => (string) ($dictionary['key'] ?? ''),
            'name' => (string) ($dictionary['name'] ?? ''),
            'values' => array_values(array_map(static fn ($item): string => (string) $item, is_array($dictionary['values'] ?? null) ? $dictionary['values'] : [])),
            'updated_at' => (string) ($dictionary['updated_at'] ?? ''),
        ];
    }

    private function mapWorkflow(array $workflow): array
    {
        return [
            'id' => (int) ($workflow['id'] ?? 0),
            'name' => (string) ($workflow['name'] ?? ''),
            'scope' => (string) ($workflow['scope'] ?? 'org'),
            'stages' => array_values(array_map(static fn ($item): string => (string) $item, is_array($workflow['stages'] ?? null) ? $workflow['stages'] : [])),
            'enabled' => (bool) ($workflow['enabled'] ?? false),
            'updated_at' => (string) ($workflow['updated_at'] ?? ''),
        ];
    }

    private function normalizeRoles(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $roleKeys = array_column($this->store->all('roles'), 'key');

        return array_values(array_unique(array_filter(array_map(
            static fn ($item): string => trim((string) $item),
            $value
        ), static fn (string $item): bool => $item !== '' && in_array($item, $roleKeys, true))));
    }

    private function normalizePermissionList(mixed $value): array
    {
        return $this->normalizeStringList($value);
    }

    private function normalizeStringList(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $normalized = array_values(array_unique(array_filter(array_map(
            static fn ($item): string => trim((string) $item),
            $value
        ), static fn (string $item): bool => $item !== '')));
        sort($normalized);

        return $normalized;
    }

    private function normalizeMachineKey(string $value): string
    {
        return strtolower(trim($value));
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

    private function syncUsersForRole(string $roleKey): void
    {
        if ($roleKey === '') {
            return;
        }

        $users = $this->store->all('users');
        $changed = false;

        foreach ($users as $index => $user) {
            $roles = is_array($user['roles'] ?? null) ? $user['roles'] : [];
            if (!in_array($roleKey, $roles, true)) {
                continue;
            }

            $permissions = $this->permissionsForRoles($roles);
            $existingPermissions = is_array($user['permissions'] ?? null)
                ? array_values(array_map(static fn ($item): string => (string) $item, $user['permissions']))
                : [];
            sort($existingPermissions);

            if ($existingPermissions === $permissions) {
                continue;
            }

            $users[$index]['permissions'] = $permissions;
            $changed = true;
        }

        if ($changed) {
            $this->store->replaceAll('users', $users);
        }
    }

    private function roleUserCount(string $roleKey): int
    {
        if ($roleKey === '') {
            return 0;
        }

        return count(array_filter(
            $this->store->all('users'),
            static fn (array $user): bool => in_array($roleKey, is_array($user['roles'] ?? null) ? $user['roles'] : [], true)
        ));
    }

    private function isProtectedDictionaryKey(string $key): bool
    {
        return in_array($this->normalizeMachineKey($key), self::PROTECTED_DICTIONARY_KEYS, true);
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

    private function machineKeyExists(string $collection, string $key, ?int $excludeId = null): bool
    {
        foreach ($this->store->all($collection) as $item) {
            $itemId = (int) ($item['id'] ?? 0);
            if ($excludeId !== null && $excludeId === $itemId) {
                continue;
            }
            if ($this->normalizeMachineKey((string) ($item['key'] ?? '')) === $key) {
                return true;
            }
        }

        return false;
    }

    private function nameExists(string $collection, string $name, ?int $excludeId = null): bool
    {
        foreach ($this->store->all($collection) as $item) {
            $itemId = (int) ($item['id'] ?? 0);
            if ($excludeId !== null && $excludeId === $itemId) {
                continue;
            }
            if (strcasecmp((string) ($item['name'] ?? ''), $name) === 0) {
                return true;
            }
        }

        return false;
    }

    private function isValidScope(string $scope): bool
    {
        return in_array($scope, self::VALID_SCOPES, true);
    }
}