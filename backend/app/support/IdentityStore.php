<?php

declare(strict_types=1);

namespace App\Support;

use app\model\IdentityRole;
use app\model\IdentityUser;
use RuntimeException;
use think\facade\Db;

final class IdentityStore
{
    public function __construct(
        private readonly string $driver,
        private readonly string $storagePath,
    ) {
    }

    public function ensureSchema(): void
    {
        if ($this->driver === 'mysql') {
            Db::execute(
                'CREATE TABLE IF NOT EXISTS `identity_roles` (' .
                '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
                '`role_key` VARCHAR(64) NOT NULL,' .
                '`name` VARCHAR(128) NOT NULL,' .
                '`scope` VARCHAR(32) NOT NULL,' .
                '`description` TEXT NOT NULL,' .
                '`permissions_json` LONGTEXT NOT NULL,' .
                '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                'PRIMARY KEY (`id`),' .
                'UNIQUE KEY `uniq_identity_roles_key` (`role_key`)' .
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );
            Db::execute(
                'CREATE TABLE IF NOT EXISTS `identity_users` (' .
                '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
                '`name` VARCHAR(128) NOT NULL,' .
                '`email` VARCHAR(191) NOT NULL,' .
                '`password` VARCHAR(191) NOT NULL,' .
                '`department` VARCHAR(128) NOT NULL,' .
                '`title` VARCHAR(128) NOT NULL,' .
                '`status` VARCHAR(32) NOT NULL,' .
                '`dingtalk_bound` TINYINT(1) NOT NULL DEFAULT 0,' .
                '`last_login_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                'PRIMARY KEY (`id`),' .
                'UNIQUE KEY `uniq_identity_users_email` (`email`)' .
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );
            Db::execute(
                'CREATE TABLE IF NOT EXISTS `identity_user_roles` (' .
                '`user_id` INT UNSIGNED NOT NULL,' .
                '`role_id` INT UNSIGNED NOT NULL,' .
                'PRIMARY KEY (`user_id`, `role_id`),' .
                'KEY `idx_identity_user_roles_role` (`role_id`)' .
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );

            return;
        }

        Db::execute(
            'CREATE TABLE IF NOT EXISTS identity_roles (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'role_key VARCHAR(64) NOT NULL UNIQUE,' .
            'name VARCHAR(128) NOT NULL,' .
            'scope VARCHAR(32) NOT NULL,' .
            'description TEXT NOT NULL,' .
            'permissions_json TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS identity_users (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'name VARCHAR(128) NOT NULL,' .
            'email VARCHAR(191) NOT NULL UNIQUE,' .
            'password VARCHAR(191) NOT NULL,' .
            'department VARCHAR(128) NOT NULL,' .
            'title VARCHAR(128) NOT NULL,' .
            'status VARCHAR(32) NOT NULL,' .
            'dingtalk_bound INTEGER NOT NULL DEFAULT 0,' .
            'last_login_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS identity_user_roles (' .
            'user_id INTEGER NOT NULL,' .
            'role_id INTEGER NOT NULL,' .
            'PRIMARY KEY (user_id, role_id)' .
            ')'
        );
        Db::execute('CREATE INDEX IF NOT EXISTS idx_identity_user_roles_role ON identity_user_roles(role_id)');
    }

    public function importIfNeeded(): void
    {
        $roleCount = (int) IdentityRole::count();
        $userCount = (int) IdentityUser::count();
        if ($roleCount > 0 || $userCount > 0) {
            return;
        }

        $roles = $this->seedRecords('roles');
        $users = $this->seedRecords('users');
        if ($roles === [] && $users === []) {
            return;
        }

        Db::transaction(function () use ($roles, $users): void {
            foreach ($roles as $role) {
                $this->insertRoleRow($role);
            }

            foreach ($users as $user) {
                $created = $this->insertUserRow($user);
                $this->syncUserRoles((int) $created['id'], $this->normalizeRoleKeys($user['roles'] ?? []));
            }
        });
    }

    public function allUsers(): array
    {
        $roleMap = $this->rolesById();
        $userRoleMap = $this->userRoleMap();
        $items = [];

        foreach (IdentityUser::order('id', 'asc')->select() as $user) {
            $items[] = $this->mapUserRecord($user->toArray(), $roleMap, $userRoleMap);
        }

        return $items;
    }

    public function findUser(int $id): ?array
    {
        $user = IdentityUser::find($id);
        if ($user === null) {
            return null;
        }

        return $this->mapUserRecord($user->toArray(), $this->rolesById(), $this->userRoleMap());
    }

    public function createUser(array $payload): array
    {
        return Db::transaction(function () use ($payload): array {
            $created = $this->insertUserRow($payload);
            $this->syncUserRoles((int) $created['id'], $this->normalizeRoleKeys($payload['roles'] ?? []));

            return $this->findUser((int) $created['id']) ?? $created;
        });
    }

    public function updateUser(int $id, array $payload): ?array
    {
        $current = $this->rawUser($id);
        if ($current === null) {
            return null;
        }

        $roles = array_key_exists('roles', $payload)
            ? $this->normalizeRoleKeys($payload['roles'])
            : $this->rolesForUser($id);

        $next = [
            'id' => $id,
            'name' => (string) ($payload['name'] ?? $current['name']),
            'email' => (string) ($payload['email'] ?? $current['email']),
            'password' => (string) ($payload['password'] ?? $current['password']),
            'department' => (string) ($payload['department'] ?? $current['department']),
            'title' => (string) ($payload['title'] ?? $current['title']),
            'status' => (string) ($payload['status'] ?? $current['status']),
            'dingtalk_bound' => (bool) ($payload['dingtalk_bound'] ?? (bool) $current['dingtalk_bound']),
            'last_login_at' => (string) ($payload['last_login_at'] ?? $current['last_login_at']),
            'roles' => $roles,
        ];

        return Db::transaction(function () use ($id, $next, $roles): ?array {
            $this->persistUserUpdate($id, $next);
            $this->syncUserRoles($id, $roles);

            return $this->findUser($id);
        });
    }

    public function replaceAllUsers(array $items): void
    {
        $existingIds = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $this->allUsers());
        $incomingIds = array_values(array_filter(array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items), static fn (int $id): bool => $id > 0));

        Db::transaction(function () use ($items, $existingIds, $incomingIds): void {
            foreach ($items as $item) {
                $id = (int) ($item['id'] ?? 0);
                if ($id > 0 && in_array($id, $existingIds, true)) {
                    $current = $this->rawUser($id);
                    if ($current === null) {
                        continue;
                    }

                    $roles = array_key_exists('roles', $item)
                        ? $this->normalizeRoleKeys($item['roles'])
                        : $this->rolesForUser($id);

                    $next = [
                        'id' => $id,
                        'name' => (string) ($item['name'] ?? $current['name']),
                        'email' => (string) ($item['email'] ?? $current['email']),
                        'password' => (string) ($item['password'] ?? $current['password']),
                        'department' => (string) ($item['department'] ?? $current['department']),
                        'title' => (string) ($item['title'] ?? $current['title']),
                        'status' => (string) ($item['status'] ?? $current['status']),
                        'dingtalk_bound' => (bool) ($item['dingtalk_bound'] ?? (bool) $current['dingtalk_bound']),
                        'last_login_at' => (string) ($item['last_login_at'] ?? $current['last_login_at']),
                        'roles' => $roles,
                    ];

                    $this->persistUserUpdate($id, $next);
                    $this->syncUserRoles($id, $roles);
                    continue;
                }

                $created = $this->insertUserRow($item);
                $this->syncUserRoles((int) $created['id'], $this->normalizeRoleKeys($item['roles'] ?? []));
            }

            $toDelete = array_diff($existingIds, $incomingIds);
            foreach ($toDelete as $id) {
                $this->deleteUser((int) $id);
            }
        });
    }

    public function allRoles(): array
    {
        $items = [];

        foreach (IdentityRole::order('id', 'asc')->select() as $role) {
            $items[] = $this->mapRoleRecord($role->toArray());
        }

        return $items;
    }

    public function findRole(int $id): ?array
    {
        $role = IdentityRole::find($id);
        if ($role === null) {
            return null;
        }

        return $this->mapRoleRecord($role->toArray());
    }

    public function createRole(array $payload): array
    {
        return Db::transaction(function () use ($payload): array {
            $created = $this->insertRoleRow($payload);

            return $this->findRole((int) $created['id']) ?? $created;
        });
    }

    public function updateRole(int $id, array $payload): ?array
    {
        $current = $this->rawRole($id);
        if ($current === null) {
            return null;
        }

        $next = [
            'id' => $id,
            'role_key' => (string) ($current['role_key'] ?? ''),
            'name' => (string) ($payload['name'] ?? $current['name']),
            'scope' => (string) ($payload['scope'] ?? $current['scope']),
            'description' => (string) ($payload['description'] ?? $current['description']),
            'permissions' => $this->normalizeStringList($payload['permissions'] ?? $this->decodeJsonList((string) ($current['permissions_json'] ?? '[]'))),
        ];

        $role = IdentityRole::find($id);
        if ($role === null) {
            return null;
        }

        $role->save([
            'name' => $next['name'],
            'scope' => $next['scope'],
            'description' => $next['description'],
            'permissions_json' => $this->encodeJsonList($next['permissions']),
            'updated_at' => date('c'),
        ]);

        return $this->findRole($id);
    }

    public function deleteRole(int $id): ?array
    {
        $current = $this->findRole($id);
        if ($current === null) {
            return null;
        }

        Db::name('identity_user_roles')->where('role_id', $id)->delete();

        $role = IdentityRole::find($id);
        if ($role !== null) {
            $role->delete();
        }

        return $current;
    }

    public function roleUserCount(string $roleKey): int
    {
        if ($roleKey === '') {
            return 0;
        }

        $role = Db::name('identity_roles')->where('role_key', $roleKey)->find();
        $roleId = (int) ($role['id'] ?? 0);
        if ($roleId <= 0) {
            return 0;
        }

        return (int) Db::name('identity_user_roles')->where('role_id', $roleId)->count();
    }

    public function emailExists(string $email, ?int $excludeId = null): bool
    {
        $needle = strtolower(trim($email));
        if ($needle === '') {
            return false;
        }

        foreach (IdentityUser::field(['id', 'email'])->select() as $user) {
            $userId = (int) $user->getAttr('id');
            if ($excludeId !== null && $userId === $excludeId) {
                continue;
            }

            if (strtolower((string) $user->getAttr('email')) === $needle) {
                return true;
            }
        }

        return false;
    }

    public function roleKeyExists(string $roleKey, ?int $excludeId = null): bool
    {
        $needle = strtolower(trim($roleKey));
        if ($needle === '') {
            return false;
        }

        foreach (IdentityRole::field(['id', 'role_key'])->select() as $role) {
            $roleId = (int) $role->getAttr('id');
            if ($excludeId !== null && $roleId === $excludeId) {
                continue;
            }

            if (strtolower((string) $role->getAttr('role_key')) === $needle) {
                return true;
            }
        }

        return false;
    }

    public function roleKeys(): array
    {
        $items = [];
        foreach (IdentityRole::order('id', 'asc')->select() as $role) {
            $key = trim((string) $role->getAttr('role_key'));
            if ($key !== '') {
                $items[] = $key;
            }
        }

        $items = array_values(array_unique($items));
        sort($items);

        return $items;
    }

    public function permissionsForRoles(array $roleKeys): array
    {
        $roleKeys = $this->normalizeRoleKeys($roleKeys);
        if ($roleKeys === []) {
            return [];
        }

        $permissions = [];
        foreach (IdentityRole::where('role_key', 'in', $roleKeys)->select() as $role) {
            foreach ($this->decodeJsonList((string) $role->getAttr('permissions_json')) as $permission) {
                $permissions[] = $permission;
            }
        }

        $permissions = array_values(array_unique(array_filter($permissions, static fn (string $item): bool => $item !== '')));
        sort($permissions);

        return $permissions;
    }

    public function diagnostics(): array
    {
        return [
            'identity_users' => (int) IdentityUser::count(),
            'identity_roles' => (int) IdentityRole::count(),
            'identity_user_roles' => (int) Db::name('identity_user_roles')->count(),
        ];
    }

    private function seedRecords(string $collection): array
    {
        $file = $this->storagePath . '/' . $collection . '.json';
        if (!is_file($file)) {
            return [];
        }

        $decoded = json_decode(file_get_contents($file) ?: '[]', true);

        return is_array($decoded) ? $decoded : [];
    }

    private function insertRoleRow(array $role): array
    {
        $timestamp = date('c');
        $roleId = (int) ($role['id'] ?? 0);
        $model = new IdentityRole();
        $data = [
            'role_key' => (string) ($role['key'] ?? $role['role_key'] ?? ''),
            'name' => (string) ($role['name'] ?? ''),
            'scope' => (string) ($role['scope'] ?? 'org'),
            'description' => (string) ($role['description'] ?? ''),
            'permissions_json' => $this->encodeJsonList($role['permissions'] ?? []),
            'created_at' => (string) ($role['created_at'] ?? $timestamp),
            'updated_at' => (string) ($role['updated_at'] ?? $timestamp),
        ];
        if ($roleId > 0) {
            $data['id'] = $roleId;
        }

        $model->save($data);
        $id = (int) $model->getAttr('id');

        return $this->findRole($id) ?? ['id' => $id];
    }

    private function insertUserRow(array $user): array
    {
        $timestamp = date('c');
        $userId = (int) ($user['id'] ?? 0);
        $model = new IdentityUser();
        $data = [
            'name' => (string) ($user['name'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'password' => (string) ($user['password'] ?? 'demo123'),
            'department' => (string) ($user['department'] ?? 'General'),
            'title' => (string) ($user['title'] ?? 'Team member'),
            'status' => (string) ($user['status'] ?? 'Invited'),
            'dingtalk_bound' => (bool) ($user['dingtalk_bound'] ?? false),
            'last_login_at' => (string) ($user['last_login_at'] ?? ''),
            'created_at' => (string) ($user['created_at'] ?? $timestamp),
            'updated_at' => (string) ($user['updated_at'] ?? $timestamp),
        ];
        if ($userId > 0) {
            $data['id'] = $userId;
        }

        $model->save($data);
        $id = (int) $model->getAttr('id');

        return ['id' => $id];
    }

    private function persistUserUpdate(int $id, array $payload): void
    {
        $user = IdentityUser::find($id);
        if ($user === null) {
            throw new RuntimeException('user_not_found');
        }

        $user->save([
            'name' => $payload['name'],
            'email' => $payload['email'],
            'password' => $payload['password'],
            'department' => $payload['department'],
            'title' => $payload['title'],
            'status' => $payload['status'],
            'dingtalk_bound' => $payload['dingtalk_bound'],
            'last_login_at' => $payload['last_login_at'],
            'updated_at' => date('c'),
        ]);
    }

    private function syncUserRoles(int $userId, array $roleKeys): void
    {
        Db::name('identity_user_roles')->where('user_id', $userId)->delete();

        if ($roleKeys === []) {
            return;
        }

        $roleIdsByKey = $this->roleIdsByKey();
        foreach ($roleKeys as $roleKey) {
            $roleId = (int) ($roleIdsByKey[$roleKey] ?? 0);
            if ($roleId <= 0) {
                continue;
            }

            Db::name('identity_user_roles')->insert([
                'user_id' => $userId,
                'role_id' => $roleId,
            ]);
        }
    }

    private function deleteUser(int $id): void
    {
        Db::name('identity_user_roles')->where('user_id', $id)->delete();
        $user = IdentityUser::find($id);
        if ($user !== null) {
            $user->delete();
        }
    }

    private function rawUser(int $id): ?array
    {
        $user = IdentityUser::find($id);

        return $user === null ? null : $user->toArray();
    }

    private function rawRole(int $id): ?array
    {
        $role = IdentityRole::find($id);

        return $role === null ? null : $role->toArray();
    }

    private function mapUserRecord(array $user, array $rolesById, array $userRoleMap): array
    {
        $roleKeys = [];
        $permissions = [];
        foreach ($userRoleMap[(int) ($user['id'] ?? 0)] ?? [] as $roleId) {
            $role = $rolesById[$roleId] ?? null;
            if ($role === null) {
                continue;
            }
            $roleKeys[] = (string) ($role['key'] ?? '');
            foreach ($role['permissions'] ?? [] as $permission) {
                $permissions[] = (string) $permission;
            }
        }

        $roleKeys = array_values(array_filter(array_unique($roleKeys), static fn (string $item): bool => $item !== ''));
        sort($roleKeys);
        $permissions = array_values(array_filter(array_unique($permissions), static fn (string $item): bool => $item !== ''));
        sort($permissions);

        return [
            'id' => (int) ($user['id'] ?? 0),
            'name' => (string) ($user['name'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'password' => (string) ($user['password'] ?? ''),
            'department' => (string) ($user['department'] ?? 'General'),
            'title' => (string) ($user['title'] ?? 'Team member'),
            'status' => (string) ($user['status'] ?? 'Invited'),
            'roles' => $roleKeys,
            'permissions' => $permissions,
            'dingtalk_bound' => (bool) ($user['dingtalk_bound'] ?? false),
            'last_login_at' => (string) ($user['last_login_at'] ?? ''),
        ];
    }

    private function mapRoleRecord(array $role): array
    {
        return [
            'id' => (int) ($role['id'] ?? 0),
            'key' => (string) ($role['role_key'] ?? ''),
            'name' => (string) ($role['name'] ?? ''),
            'scope' => (string) ($role['scope'] ?? 'org'),
            'description' => (string) ($role['description'] ?? ''),
            'permissions' => $this->decodeJsonList((string) ($role['permissions_json'] ?? '[]')),
            'created_at' => (string) ($role['created_at'] ?? ''),
            'updated_at' => (string) ($role['updated_at'] ?? ''),
        ];
    }

    private function rolesById(): array
    {
        $roles = [];
        foreach (IdentityRole::order('id', 'asc')->select() as $role) {
            $roles[(int) $role->getAttr('id')] = $this->mapRoleRecord($role->toArray());
        }

        return $roles;
    }

    private function roleIdsByKey(): array
    {
        $roleIds = [];
        foreach (IdentityRole::field(['id', 'role_key'])->order('id', 'asc')->select() as $role) {
            $roleIds[(string) $role->getAttr('role_key')] = (int) $role->getAttr('id');
        }

        return $roleIds;
    }

    private function userRoleMap(): array
    {
        $map = [];
        foreach (Db::name('identity_user_roles')->field(['user_id', 'role_id'])->order('user_id', 'asc')->order('role_id', 'asc')->select()->toArray() as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            $roleId = (int) ($row['role_id'] ?? 0);
            if ($userId <= 0 || $roleId <= 0) {
                continue;
            }
            $map[$userId] ??= [];
            $map[$userId][] = $roleId;
        }

        return $map;
    }

    private function rolesForUser(int $userId): array
    {
        $roleIds = array_values(array_filter(array_map(
            static fn ($item): int => (int) $item,
            Db::name('identity_user_roles')->where('user_id', $userId)->column('role_id')
        ), static fn (int $id): bool => $id > 0));

        if ($roleIds === []) {
            return [];
        }

        $items = Db::name('identity_roles')
            ->where('id', 'in', $roleIds)
            ->order('role_key', 'asc')
            ->column('role_key');

        return array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $items), static fn (string $item): bool => $item !== ''));
    }

    private function normalizeRoleKeys(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $items = array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $value), static fn (string $item): bool => $item !== ''));
        $items = array_values(array_unique($items));
        sort($items);

        return $items;
    }

    private function normalizeStringList(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $items = array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $value), static fn (string $item): bool => $item !== ''));
        $items = array_values(array_unique($items));
        sort($items);

        return $items;
    }

    private function decodeJsonList(string $value): array
    {
        $decoded = json_decode($value, true);

        return $this->normalizeStringList(is_array($decoded) ? $decoded : []);
    }

    private function encodeJsonList(mixed $value): string
    {
        return json_encode($this->normalizeStringList($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    }
}