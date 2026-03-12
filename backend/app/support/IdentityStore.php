<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use Throwable;

final class IdentityStore
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly string $driver,
        private readonly string $storagePath,
    ) {
    }

    public function ensureSchema(): void
    {
        if ($this->driver === 'mysql') {
            $this->pdo->exec(
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
            $this->pdo->exec(
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
            $this->pdo->exec(
                'CREATE TABLE IF NOT EXISTS `identity_user_roles` (' .
                '`user_id` INT UNSIGNED NOT NULL,' .
                '`role_id` INT UNSIGNED NOT NULL,' .
                'PRIMARY KEY (`user_id`, `role_id`),' .
                'KEY `idx_identity_user_roles_role` (`role_id`)' .
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );

            return;
        }

        $this->pdo->exec(
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
        $this->pdo->exec(
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
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS identity_user_roles (' .
            'user_id INTEGER NOT NULL,' .
            'role_id INTEGER NOT NULL,' .
            'PRIMARY KEY (user_id, role_id)' .
            ')'
        );
        $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_identity_user_roles_role ON identity_user_roles(role_id)');
    }

    public function importIfNeeded(): void
    {
        $roleCount = (int) $this->pdo->query('SELECT COUNT(*) FROM identity_roles')->fetchColumn();
        $userCount = (int) $this->pdo->query('SELECT COUNT(*) FROM identity_users')->fetchColumn();
        if ($roleCount > 0 || $userCount > 0) {
            return;
        }

        $roles = $this->seedRecords('roles');
        $users = $this->seedRecords('users');
        if ($roles === [] && $users === []) {
            return;
        }

        $this->pdo->beginTransaction();
        try {
            foreach ($roles as $role) {
                $this->insertRoleRow($role);
            }

            foreach ($users as $user) {
                $created = $this->insertUserRow($user);
                $this->syncUserRoles((int) $created['id'], $this->normalizeRoleKeys($user['roles'] ?? []));
            }

            $this->pdo->commit();
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    public function allUsers(): array
    {
        $statement = $this->pdo->query('SELECT * FROM identity_users ORDER BY id ASC');
        $users = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $roleMap = $this->rolesById();
        $userRoleMap = $this->userRoleMap();

        return array_map(fn (array $user): array => $this->mapUserRecord($user, $roleMap, $userRoleMap), $users);
    }

    public function findUser(int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM identity_users WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);
        if ($user === false) {
            return null;
        }

        return $this->mapUserRecord($user, $this->rolesById(), $this->userRoleMap());
    }

    public function createUser(array $payload): array
    {
        $this->pdo->beginTransaction();
        try {
            $created = $this->insertUserRow($payload);
            $this->syncUserRoles((int) $created['id'], $this->normalizeRoleKeys($payload['roles'] ?? []));
            $this->pdo->commit();

            return $this->findUser((int) $created['id']) ?? $created;
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
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

        $this->pdo->beginTransaction();
        try {
            $statement = $this->pdo->prepare(
                'UPDATE identity_users SET name = :name, email = :email, password = :password, department = :department, title = :title, status = :status, dingtalk_bound = :dingtalk_bound, last_login_at = :last_login_at, updated_at = :updated_at WHERE id = :id'
            );
            $statement->execute([
                ':id' => $id,
                ':name' => $next['name'],
                ':email' => $next['email'],
                ':password' => $next['password'],
                ':department' => $next['department'],
                ':title' => $next['title'],
                ':status' => $next['status'],
                ':dingtalk_bound' => $next['dingtalk_bound'] ? 1 : 0,
                ':last_login_at' => $next['last_login_at'],
                ':updated_at' => date('c'),
            ]);
            $this->syncUserRoles($id, $roles);
            $this->pdo->commit();

            return $this->findUser($id);
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    public function replaceAllUsers(array $items): void
    {
        $existingIds = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $this->allUsers());
        $incomingIds = array_values(array_filter(array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items), static fn (int $id): bool => $id > 0));

        $this->pdo->beginTransaction();
        try {
            foreach ($items as $item) {
                $id = (int) ($item['id'] ?? 0);
                if ($id > 0 && in_array($id, $existingIds, true)) {
                    $this->updateUser($id, $item);
                    continue;
                }

                $this->insertUserRow($item);
                $this->syncUserRoles((int) ($item['id'] ?? 0), $this->normalizeRoleKeys($item['roles'] ?? []));
            }

            $toDelete = array_diff($existingIds, $incomingIds);
            foreach ($toDelete as $id) {
                $this->deleteUser((int) $id);
            }

            $this->pdo->commit();
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    public function allRoles(): array
    {
        $statement = $this->pdo->query('SELECT * FROM identity_roles ORDER BY id ASC');
        $roles = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn (array $role): array => $this->mapRoleRecord($role), $roles);
    }

    public function findRole(int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM identity_roles WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $role = $statement->fetch(PDO::FETCH_ASSOC);
        if ($role === false) {
            return null;
        }

        return $this->mapRoleRecord($role);
    }

    public function createRole(array $payload): array
    {
        $this->pdo->beginTransaction();
        try {
            $created = $this->insertRoleRow($payload);
            $this->pdo->commit();

            return $this->findRole((int) $created['id']) ?? $created;
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
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

        $statement = $this->pdo->prepare(
            'UPDATE identity_roles SET name = :name, scope = :scope, description = :description, permissions_json = :permissions_json, updated_at = :updated_at WHERE id = :id'
        );
        $statement->execute([
            ':id' => $id,
            ':name' => $next['name'],
            ':scope' => $next['scope'],
            ':description' => $next['description'],
            ':permissions_json' => $this->encodeJsonList($next['permissions']),
            ':updated_at' => date('c'),
        ]);

        return $this->findRole($id);
    }

    public function deleteRole(int $id): ?array
    {
        $current = $this->findRole($id);
        if ($current === null) {
            return null;
        }

        $deleteLinks = $this->pdo->prepare('DELETE FROM identity_user_roles WHERE role_id = :role_id');
        $deleteLinks->execute([':role_id' => $id]);

        $deleteRole = $this->pdo->prepare('DELETE FROM identity_roles WHERE id = :id');
        $deleteRole->execute([':id' => $id]);

        return $current;
    }

    public function roleUserCount(string $roleKey): int
    {
        if ($roleKey === '') {
            return 0;
        }

        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM identity_user_roles link INNER JOIN identity_roles role ON role.id = link.role_id WHERE role.role_key = :role_key'
        );
        $statement->execute([':role_key' => $roleKey]);

        return (int) $statement->fetchColumn();
    }

    public function emailExists(string $email, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM identity_users WHERE LOWER(email) = LOWER(:email)';
        $params = [':email' => $email];
        if ($excludeId !== null) {
            $sql .= ' AND id <> :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return (int) $statement->fetchColumn() > 0;
    }

    public function roleKeyExists(string $roleKey, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM identity_roles WHERE LOWER(role_key) = LOWER(:role_key)';
        $params = [':role_key' => $roleKey];
        if ($excludeId !== null) {
            $sql .= ' AND id <> :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return (int) $statement->fetchColumn() > 0;
    }

    public function roleKeys(): array
    {
        $statement = $this->pdo->query('SELECT role_key FROM identity_roles ORDER BY id ASC');

        return array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $statement->fetchAll(PDO::FETCH_COLUMN) ?: []), static fn (string $item): bool => $item !== ''));
    }

    public function permissionsForRoles(array $roleKeys): array
    {
        $roleKeys = $this->normalizeRoleKeys($roleKeys);
        if ($roleKeys === []) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($roleKeys as $index => $roleKey) {
            $placeholder = ':role_' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $roleKey;
        }

        $statement = $this->pdo->prepare('SELECT permissions_json FROM identity_roles WHERE role_key IN (' . implode(',', $placeholders) . ')');
        $statement->execute($params);

        $permissions = [];
        foreach ($statement->fetchAll(PDO::FETCH_COLUMN) ?: [] as $json) {
            foreach ($this->decodeJsonList((string) $json) as $permission) {
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
            'identity_users' => (int) $this->pdo->query('SELECT COUNT(*) FROM identity_users')->fetchColumn(),
            'identity_roles' => (int) $this->pdo->query('SELECT COUNT(*) FROM identity_roles')->fetchColumn(),
            'identity_user_roles' => (int) $this->pdo->query('SELECT COUNT(*) FROM identity_user_roles')->fetchColumn(),
        ];
    }

    private function seedRecords(string $collection): array
    {
        $statement = $this->pdo->prepare('SELECT payload FROM data_records WHERE collection = :collection ORDER BY record_id ASC');
        $statement->execute([':collection' => $collection]);
        $rows = $statement->fetchAll(PDO::FETCH_COLUMN) ?: [];
        if ($rows !== []) {
            $items = [];
            foreach ($rows as $payload) {
                $decoded = json_decode((string) $payload, true);
                if (is_array($decoded)) {
                    $items[] = $decoded;
                }
            }

            return $items;
        }

        $file = $this->storagePath . '/' . $collection . '.json';
        if (!is_file($file)) {
            return [];
        }

        $decoded = json_decode(file_get_contents($file) ?: '[]', true);

        return is_array($decoded) ? $decoded : [];
    }

    private function insertRoleRow(array $role): array
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO identity_roles (id, role_key, name, scope, description, permissions_json, created_at, updated_at) VALUES (:id, :role_key, :name, :scope, :description, :permissions_json, :created_at, :updated_at)'
        );
        $timestamp = date('c');
        $roleId = (int) ($role['id'] ?? 0);
        $statement->execute([
            ':id' => $roleId > 0 ? $roleId : null,
            ':role_key' => (string) ($role['key'] ?? $role['role_key'] ?? ''),
            ':name' => (string) ($role['name'] ?? ''),
            ':scope' => (string) ($role['scope'] ?? 'org'),
            ':description' => (string) ($role['description'] ?? ''),
            ':permissions_json' => $this->encodeJsonList($role['permissions'] ?? []),
            ':created_at' => (string) ($role['created_at'] ?? $timestamp),
            ':updated_at' => (string) ($role['updated_at'] ?? $timestamp),
        ]);

        $id = $roleId > 0 ? $roleId : (int) $this->pdo->lastInsertId();

        return $this->findRole($id) ?? ['id' => $id];
    }

    private function insertUserRow(array $user): array
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO identity_users (id, name, email, password, department, title, status, dingtalk_bound, last_login_at, created_at, updated_at) VALUES (:id, :name, :email, :password, :department, :title, :status, :dingtalk_bound, :last_login_at, :created_at, :updated_at)'
        );
        $timestamp = date('c');
        $userId = (int) ($user['id'] ?? 0);
        $statement->execute([
            ':id' => $userId > 0 ? $userId : null,
            ':name' => (string) ($user['name'] ?? ''),
            ':email' => (string) ($user['email'] ?? ''),
            ':password' => (string) ($user['password'] ?? 'demo123'),
            ':department' => (string) ($user['department'] ?? 'General'),
            ':title' => (string) ($user['title'] ?? 'Team member'),
            ':status' => (string) ($user['status'] ?? 'Invited'),
            ':dingtalk_bound' => (bool) ($user['dingtalk_bound'] ?? false) ? 1 : 0,
            ':last_login_at' => (string) ($user['last_login_at'] ?? ''),
            ':created_at' => (string) ($user['created_at'] ?? $timestamp),
            ':updated_at' => (string) ($user['updated_at'] ?? $timestamp),
        ]);

        $id = $userId > 0 ? $userId : (int) $this->pdo->lastInsertId();

        return ['id' => $id];
    }

    private function syncUserRoles(int $userId, array $roleKeys): void
    {
        $delete = $this->pdo->prepare('DELETE FROM identity_user_roles WHERE user_id = :user_id');
        $delete->execute([':user_id' => $userId]);

        if ($roleKeys === []) {
            return;
        }

        $roleIdsByKey = $this->roleIdsByKey();
        $insert = $this->pdo->prepare('INSERT INTO identity_user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
        foreach ($roleKeys as $roleKey) {
            $roleId = (int) ($roleIdsByKey[$roleKey] ?? 0);
            if ($roleId <= 0) {
                continue;
            }
            $insert->execute([
                ':user_id' => $userId,
                ':role_id' => $roleId,
            ]);
        }
    }

    private function deleteUser(int $id): void
    {
        $deleteLinks = $this->pdo->prepare('DELETE FROM identity_user_roles WHERE user_id = :user_id');
        $deleteLinks->execute([':user_id' => $id]);
        $deleteUser = $this->pdo->prepare('DELETE FROM identity_users WHERE id = :id');
        $deleteUser->execute([':id' => $id]);
    }

    private function rawUser(int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM identity_users WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function rawRole(int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM identity_roles WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
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
        $statement = $this->pdo->query('SELECT * FROM identity_roles ORDER BY id ASC');
        $roles = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $roles[(int) ($row['id'] ?? 0)] = $this->mapRoleRecord($row);
        }

        return $roles;
    }

    private function roleIdsByKey(): array
    {
        $statement = $this->pdo->query('SELECT id, role_key FROM identity_roles ORDER BY id ASC');
        $roleIds = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $roleIds[(string) ($row['role_key'] ?? '')] = (int) ($row['id'] ?? 0);
        }

        return $roleIds;
    }

    private function userRoleMap(): array
    {
        $statement = $this->pdo->query('SELECT user_id, role_id FROM identity_user_roles ORDER BY user_id ASC, role_id ASC');
        $map = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
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
        $statement = $this->pdo->prepare(
            'SELECT role.role_key FROM identity_user_roles link INNER JOIN identity_roles role ON role.id = link.role_id WHERE link.user_id = :user_id ORDER BY role.role_key ASC'
        );
        $statement->execute([':user_id' => $userId]);

        return array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $statement->fetchAll(PDO::FETCH_COLUMN) ?: []), static fn (string $item): bool => $item !== ''));
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