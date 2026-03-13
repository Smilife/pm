<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class SettingsService
{
    private const VALID_SCOPES = ['org', 'project', 'self'];

    private const PROTECTED_DICTIONARY_KEYS = ['requirement_status', 'execution_status', 'bug_severity', 'project_status'];

    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function members(ApiContext $request, array $params): ThinkResponse
    {
        $items = array_map(fn (array $user): array => $this->mapMember($user), $this->store->allUsers());

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });

        return ApiResponder::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeMember(ApiContext $request, array $params): ThinkResponse
    {
        $error = $this->validateMemberRequest($request);
        if ($error !== null) {
            return $error;
        }

        $email = trim((string) ($request->body['email'] ?? ''));
        if ($this->emailExists($email)) {
            return ApiResponder::error(422, 'duplicate_member_email', [], $request->requestId);
        }

        $roles = $this->normalizeRoles($request->body['roles'] ?? []);
        $created = $this->store->createUser([
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

        return ApiResponder::success($this->mapMember($created), $request->requestId);
    }

    public function updateMember(ApiContext $request, array $params): ThinkResponse
    {
        $memberId = (int) ($params['id'] ?? 0);
        $current = $this->store->findUser($memberId);
        if ($current === null) {
            return ApiResponder::error(404, 'member_not_found', [], $request->requestId);
        }

        $error = $this->validateMemberRequest($request, $current);
        if ($error !== null) {
            return $error;
        }

        $email = trim((string) ($request->body['email'] ?? ($current['email'] ?? '')));
        if ($this->emailExists($email, $memberId)) {
            return ApiResponder::error(422, 'duplicate_member_email', [], $request->requestId);
        }

        $roles = $this->normalizeRoles($request->body['roles'] ?? ($current['roles'] ?? []));
        $updated = $this->store->updateUser($memberId, [
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
            return ApiResponder::error(404, 'member_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapMember($updated), $request->requestId);
    }

    public function roles(ApiContext $request, array $params): ThinkResponse
    {
        $items = array_map(fn (array $role): array => $this->mapRole($role), $this->store->allRoles());

        return ApiResponder::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeRole(ApiContext $request, array $params): ThinkResponse
    {
        $key = $this->normalizeMachineKey((string) ($request->body['key'] ?? ''));
        $name = trim((string) ($request->body['name'] ?? ''));
        $description = trim((string) ($request->body['description'] ?? ''));
        $scope = (string) ($request->body['scope'] ?? 'org');
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? []);

        if ($key === '') {
            return ApiResponder::error(422, 'missing_role_key', [], $request->requestId);
        }
        if (!preg_match('/^[a-z][a-z0-9_]*$/', $key)) {
            return ApiResponder::error(422, 'invalid_role_key', [], $request->requestId);
        }
        if ($this->machineKeyExists('roles', $key)) {
            return ApiResponder::error(422, 'duplicate_role_key', [], $request->requestId);
        }
        if ($name === '') {
            return ApiResponder::error(422, 'missing_role_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return ApiResponder::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return ApiResponder::error(422, 'missing_role_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return ApiResponder::error(422, 'missing_role_permissions', [], $request->requestId);
        }

        $created = $this->store->createRole([
            'key' => $key,
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        return ApiResponder::success($this->mapRole($created), $request->requestId);
    }

    public function updateRole(ApiContext $request, array $params): ThinkResponse
    {
        $roleId = (int) ($params['id'] ?? 0);
        $current = $this->store->findRole($roleId);
        if ($current === null) {
            return ApiResponder::error(404, 'role_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $description = trim((string) ($request->body['description'] ?? ($current['description'] ?? '')));
        $scope = (string) ($request->body['scope'] ?? ($current['scope'] ?? 'org'));
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? ($current['permissions'] ?? []));

        if ($name === '') {
            return ApiResponder::error(422, 'missing_role_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return ApiResponder::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return ApiResponder::error(422, 'missing_role_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return ApiResponder::error(422, 'missing_role_permissions', [], $request->requestId);
        }

        $updated = $this->store->updateRole($roleId, [
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        if ($updated === null) {
            return ApiResponder::error(404, 'role_not_found', [], $request->requestId);
        }

        $this->syncUsersForRole((string) ($current['key'] ?? ''));

        return ApiResponder::success($this->mapRole($updated), $request->requestId);
    }

    public function destroyRole(ApiContext $request, array $params): ThinkResponse
    {
        $roleId = (int) ($params['id'] ?? 0);
        $current = $this->store->findRole($roleId);
        if ($current === null) {
            return ApiResponder::error(404, 'role_not_found', [], $request->requestId);
        }

        $roleKey = (string) ($current['key'] ?? '');
        $userCount = $this->roleUserCount($roleKey);
        if ($userCount > 0) {
            return ApiResponder::error(409, 'role_in_use', ['user_count' => $userCount], $request->requestId);
        }

        $deleted = $this->store->deleteRole($roleId);
        if ($deleted === null) {
            return ApiResponder::error(404, 'role_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapRole($deleted), $request->requestId);
    }

    public function policies(ApiContext $request, array $params): ThinkResponse
    {
        $items = array_map(fn (array $policy): array => $this->mapPolicy($policy), $this->store->allPolicies());

        return ApiResponder::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storePolicy(ApiContext $request, array $params): ThinkResponse
    {
        $name = trim((string) ($request->body['name'] ?? ''));
        $description = trim((string) ($request->body['description'] ?? ''));
        $scope = (string) ($request->body['scope'] ?? 'org');
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? []);

        if ($name === '') {
            return ApiResponder::error(422, 'missing_policy_name', [], $request->requestId);
        }
        if ($this->nameExists('policies', $name)) {
            return ApiResponder::error(422, 'duplicate_policy_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return ApiResponder::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return ApiResponder::error(422, 'missing_policy_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return ApiResponder::error(422, 'missing_policy_permissions', [], $request->requestId);
        }

        $created = $this->store->createPolicy([
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        return ApiResponder::success($this->mapPolicy($created), $request->requestId);
    }

    public function updatePolicy(ApiContext $request, array $params): ThinkResponse
    {
        $policyId = (int) ($params['id'] ?? 0);
        $current = $this->store->findPolicy($policyId);
        if ($current === null) {
            return ApiResponder::error(404, 'policy_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $description = trim((string) ($request->body['description'] ?? ($current['description'] ?? '')));
        $scope = (string) ($request->body['scope'] ?? ($current['scope'] ?? 'org'));
        $permissions = $this->normalizePermissionList($request->body['permissions'] ?? ($current['permissions'] ?? []));

        if ($name === '') {
            return ApiResponder::error(422, 'missing_policy_name', [], $request->requestId);
        }
        if ($this->nameExists('policies', $name, $policyId)) {
            return ApiResponder::error(422, 'duplicate_policy_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return ApiResponder::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($description === '') {
            return ApiResponder::error(422, 'missing_policy_description', [], $request->requestId);
        }
        if ($permissions === []) {
            return ApiResponder::error(422, 'missing_policy_permissions', [], $request->requestId);
        }

        $updated = $this->store->updatePolicy($policyId, [
            'name' => $name,
            'scope' => $scope,
            'description' => $description,
            'permissions' => $permissions,
        ]);

        if ($updated === null) {
            return ApiResponder::error(404, 'policy_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapPolicy($updated), $request->requestId);
    }

    public function destroyPolicy(ApiContext $request, array $params): ThinkResponse
    {
        $policyId = (int) ($params['id'] ?? 0);
        $current = $this->store->findPolicy($policyId);
        if ($current === null) {
            return ApiResponder::error(404, 'policy_not_found', [], $request->requestId);
        }

        $deleted = $this->store->deletePolicy($policyId);
        if ($deleted === null) {
            return ApiResponder::error(404, 'policy_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapPolicy($deleted), $request->requestId);
    }

    public function dictionaries(ApiContext $request, array $params): ThinkResponse
    {
        $items = array_map(fn (array $dictionary): array => $this->mapDictionary($dictionary), $this->store->allDictionaries());

        return ApiResponder::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeDictionary(ApiContext $request, array $params): ThinkResponse
    {
        $key = $this->normalizeMachineKey((string) ($request->body['key'] ?? ''));
        $name = trim((string) ($request->body['name'] ?? ''));
        $values = $this->normalizeStringList($request->body['values'] ?? []);

        if ($key === '') {
            return ApiResponder::error(422, 'missing_dictionary_key', [], $request->requestId);
        }
        if (!preg_match('/^[a-z][a-z0-9_]*$/', $key)) {
            return ApiResponder::error(422, 'invalid_dictionary_key', [], $request->requestId);
        }
        if ($this->machineKeyExists('dictionaries', $key)) {
            return ApiResponder::error(422, 'duplicate_dictionary_key', [], $request->requestId);
        }
        if ($name === '') {
            return ApiResponder::error(422, 'missing_dictionary_name', [], $request->requestId);
        }
        if ($values === []) {
            return ApiResponder::error(422, 'missing_dictionary_values', [], $request->requestId);
        }

        $created = $this->store->createDictionary([
            'key' => $key,
            'name' => $name,
            'values' => $values,
            'updated_at' => date('c'),
        ]);

        return ApiResponder::success($this->mapDictionary($created), $request->requestId);
    }

    public function updateDictionary(ApiContext $request, array $params): ThinkResponse
    {
        $dictionaryId = (int) ($params['id'] ?? 0);
        $current = $this->store->findDictionary($dictionaryId);
        if ($current === null) {
            return ApiResponder::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $values = $this->normalizeStringList($request->body['values'] ?? ($current['values'] ?? []));

        if ($name === '') {
            return ApiResponder::error(422, 'missing_dictionary_name', [], $request->requestId);
        }
        if ($values === []) {
            return ApiResponder::error(422, 'missing_dictionary_values', [], $request->requestId);
        }

        $updated = $this->store->updateDictionary($dictionaryId, [
            'name' => $name,
            'values' => $values,
            'updated_at' => date('c'),
        ]);

        if ($updated === null) {
            return ApiResponder::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapDictionary($updated), $request->requestId);
    }

    public function destroyDictionary(ApiContext $request, array $params): ThinkResponse
    {
        $dictionaryId = (int) ($params['id'] ?? 0);
        $current = $this->store->findDictionary($dictionaryId);
        if ($current === null) {
            return ApiResponder::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        $key = (string) ($current['key'] ?? '');
        if ($this->isProtectedDictionaryKey($key)) {
            return ApiResponder::error(409, 'dictionary_locked', ['key' => $key], $request->requestId);
        }

        $deleted = $this->store->deleteDictionary($dictionaryId);
        if ($deleted === null) {
            return ApiResponder::error(404, 'dictionary_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapDictionary($deleted), $request->requestId);
    }

    public function workflows(ApiContext $request, array $params): ThinkResponse
    {
        $items = array_map(fn (array $workflow): array => $this->mapWorkflow($workflow), $this->store->allWorkflows());

        return ApiResponder::success(['items' => array_values($items), 'total' => count($items)], $request->requestId);
    }

    public function storeWorkflow(ApiContext $request, array $params): ThinkResponse
    {
        $name = trim((string) ($request->body['name'] ?? ''));
        $scope = (string) ($request->body['scope'] ?? 'org');
        $stages = $this->normalizeStringList($request->body['stages'] ?? []);
        $enabled = (bool) ($request->body['enabled'] ?? false);

        if ($name === '') {
            return ApiResponder::error(422, 'missing_workflow_name', [], $request->requestId);
        }
        if ($this->nameExists('workflows', $name)) {
            return ApiResponder::error(422, 'duplicate_workflow_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return ApiResponder::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($stages === []) {
            return ApiResponder::error(422, 'missing_workflow_stages', [], $request->requestId);
        }

        $created = $this->store->createWorkflow([
            'name' => $name,
            'scope' => $scope,
            'stages' => $stages,
            'enabled' => $enabled,
            'updated_at' => date('c'),
        ]);

        return ApiResponder::success($this->mapWorkflow($created), $request->requestId);
    }

    public function updateWorkflow(ApiContext $request, array $params): ThinkResponse
    {
        $workflowId = (int) ($params['id'] ?? 0);
        $current = $this->store->findWorkflow($workflowId);
        if ($current === null) {
            return ApiResponder::error(404, 'workflow_not_found', [], $request->requestId);
        }

        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $scope = (string) ($request->body['scope'] ?? ($current['scope'] ?? 'org'));
        $stages = $this->normalizeStringList($request->body['stages'] ?? ($current['stages'] ?? []));
        $enabled = array_key_exists('enabled', $request->body) ? (bool) $request->body['enabled'] : (bool) ($current['enabled'] ?? false);

        if ($name === '') {
            return ApiResponder::error(422, 'missing_workflow_name', [], $request->requestId);
        }
        if ($this->nameExists('workflows', $name, $workflowId)) {
            return ApiResponder::error(422, 'duplicate_workflow_name', [], $request->requestId);
        }
        if (!$this->isValidScope($scope)) {
            return ApiResponder::error(422, 'invalid_setting_scope', [], $request->requestId);
        }
        if ($stages === []) {
            return ApiResponder::error(422, 'missing_workflow_stages', [], $request->requestId);
        }

        $updated = $this->store->updateWorkflow($workflowId, [
            'name' => $name,
            'scope' => $scope,
            'stages' => $stages,
            'enabled' => $enabled,
            'updated_at' => date('c'),
        ]);

        if ($updated === null) {
            return ApiResponder::error(404, 'workflow_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapWorkflow($updated), $request->requestId);
    }

    public function destroyWorkflow(ApiContext $request, array $params): ThinkResponse
    {
        $workflowId = (int) ($params['id'] ?? 0);
        $current = $this->store->findWorkflow($workflowId);
        if ($current === null) {
            return ApiResponder::error(404, 'workflow_not_found', [], $request->requestId);
        }

        $deleted = $this->store->deleteWorkflow($workflowId);
        if ($deleted === null) {
            return ApiResponder::error(404, 'workflow_not_found', [], $request->requestId);
        }

        return ApiResponder::success($this->mapWorkflow($deleted), $request->requestId);
    }

    private function validateMemberRequest(ApiContext $request, ?array $current = null): ?Response
    {
        $name = trim((string) ($request->body['name'] ?? ($current['name'] ?? '')));
        $email = trim((string) ($request->body['email'] ?? ($current['email'] ?? '')));
        $roles = $this->normalizeRoles($request->body['roles'] ?? ($current['roles'] ?? []));

        if ($name === '') {
            return ApiResponder::error(422, 'missing_member_name', [], $request->requestId);
        }
        if ($email === '') {
            return ApiResponder::error(422, 'missing_member_email', [], $request->requestId);
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return ApiResponder::error(422, 'invalid_member_email', [], $request->requestId);
        }
        if ($roles === []) {
            return ApiResponder::error(422, 'missing_member_roles', [], $request->requestId);
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
            $this->store->allUsers(),
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

        $roleKeys = array_column($this->store->allRoles(), 'key');

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
        return $this->store->permissionsForRoles($roles);
    }

    private function syncUsersForRole(string $roleKey): void
    {
        if ($roleKey === '') {
            return;
        }

        $users = $this->store->allUsers();
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
            $this->store->replaceAllUsers($users);
        }
    }

    private function roleUserCount(string $roleKey): int
    {
        return $this->store->roleUserCount($roleKey);
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
        return $this->store->emailExists($email, $excludeMemberId);
    }

    private function machineKeyExists(string $collection, string $key, ?int $excludeId = null): bool
    {
        return match ($collection) {
            'roles' => $this->store->roleKeyExists($key, $excludeId),
            'dictionaries' => $this->dictionaryKeyExists($key, $excludeId),
            default => false,
        };
    }

    private function nameExists(string $collection, string $name, ?int $excludeId = null): bool
    {
        $items = match ($collection) {
            'policies' => $this->store->allPolicies(),
            'workflows' => $this->store->allWorkflows(),
            default => [],
        };

        foreach ($items as $item) {
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

    private function dictionaryKeyExists(string $key, ?int $excludeId = null): bool
    {
        foreach ($this->store->allDictionaries() as $item) {
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

    private function isValidScope(string $scope): bool
    {
        return in_array($scope, self::VALID_SCOPES, true);
    }
}