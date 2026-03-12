<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use Throwable;

final class SettingsStore
{
    private const POLICY_COLLECTION = 'policies';
    private const DICTIONARY_COLLECTION = 'dictionaries';
    private const WORKFLOW_COLLECTION = 'workflows';

    public function __construct(
        private readonly PDO $pdo,
        private readonly string $driver,
        private readonly string $storagePath,
    ) {
    }

    public function ensureSchema(): void
    {
        if ($this->driver === 'mysql') {
            $this->ensureMysqlSchema();
            return;
        }

        $this->ensureSqliteSchema();
    }

    public function importIfNeeded(): void
    {
        foreach ($this->collections() as $collection) {
            if ($this->tableCount($collection) > 0) {
                continue;
            }

            $items = $this->seedRecords($collection);
            if ($items === []) {
                continue;
            }

            $startedTransaction = !$this->pdo->inTransaction();
            if ($startedTransaction) {
                $this->pdo->beginTransaction();
            }

            try {
                foreach ($items as $item) {
                    $row = $this->toStorageRow($collection, $this->normalizeRecord($collection, $item));
                    $this->insertRow($collection, $row);
                }

                if ($startedTransaction) {
                    $this->pdo->commit();
                }
            } catch (Throwable $exception) {
                if ($startedTransaction && $this->pdo->inTransaction()) {
                    $this->pdo->rollBack();
                }

                throw $exception;
            }
        }
    }

    public function diagnostics(): array
    {
        return [
            'settings_policies' => $this->tableCount(self::POLICY_COLLECTION),
            'settings_dictionaries' => $this->tableCount(self::DICTIONARY_COLLECTION),
            'settings_workflows' => $this->tableCount(self::WORKFLOW_COLLECTION),
        ];
    }

    public function allPolicies(): array { return $this->all(self::POLICY_COLLECTION); }

    public function findPolicy(int $id): ?array { return $this->find(self::POLICY_COLLECTION, $id); }

    public function createPolicy(array $payload): array { return $this->create(self::POLICY_COLLECTION, $payload); }

    public function updatePolicy(int $id, array $payload): ?array { return $this->update(self::POLICY_COLLECTION, $id, $payload); }

    public function replaceAllPolicies(array $items): void { $this->replaceAll(self::POLICY_COLLECTION, $items); }

    public function deletePolicy(int $id): ?array { return $this->delete(self::POLICY_COLLECTION, $id); }

    public function allDictionaries(): array { return $this->all(self::DICTIONARY_COLLECTION); }

    public function findDictionary(int $id): ?array { return $this->find(self::DICTIONARY_COLLECTION, $id); }

    public function createDictionary(array $payload): array { return $this->create(self::DICTIONARY_COLLECTION, $payload); }

    public function updateDictionary(int $id, array $payload): ?array { return $this->update(self::DICTIONARY_COLLECTION, $id, $payload); }

    public function replaceAllDictionaries(array $items): void { $this->replaceAll(self::DICTIONARY_COLLECTION, $items); }

    public function deleteDictionary(int $id): ?array { return $this->delete(self::DICTIONARY_COLLECTION, $id); }

    public function allWorkflows(): array { return $this->all(self::WORKFLOW_COLLECTION); }

    public function findWorkflow(int $id): ?array { return $this->find(self::WORKFLOW_COLLECTION, $id); }

    public function createWorkflow(array $payload): array { return $this->create(self::WORKFLOW_COLLECTION, $payload); }

    public function updateWorkflow(int $id, array $payload): ?array { return $this->update(self::WORKFLOW_COLLECTION, $id, $payload); }

    public function replaceAllWorkflows(array $items): void { $this->replaceAll(self::WORKFLOW_COLLECTION, $items); }

    public function deleteWorkflow(int $id): ?array { return $this->delete(self::WORKFLOW_COLLECTION, $id); }

    private function all(string $collection): array
    {
        $statement = $this->pdo->query('SELECT * FROM ' . $this->tableName($collection) . ' ORDER BY id ASC');
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn (array $row): array => $this->mapRow($collection, $row), $rows);
    }

    private function find(string $collection, int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM ' . $this->tableName($collection) . ' WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $this->mapRow($collection, $row);
    }

    private function create(string $collection, array $payload): array
    {
        $startedTransaction = !$this->pdo->inTransaction();
        if ($startedTransaction) {
            $this->pdo->beginTransaction();
        }

        try {
            $normalized = $this->normalizeRecord($collection, $payload);
            $row = $this->toStorageRow($collection, $normalized);
            $id = $this->insertRow($collection, $row);

            if ($startedTransaction) {
                $this->pdo->commit();
            }

            return $this->find($collection, $id) ?? array_merge($normalized, ['id' => $id]);
        } catch (Throwable $exception) {
            if ($startedTransaction && $this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $exception;
        }
    }

    private function update(string $collection, int $id, array $payload): ?array
    {
        $currentRow = $this->rawRow($collection, $id);
        if ($currentRow === null) {
            return null;
        }

        $current = $this->mapRow($collection, $currentRow);
        $normalized = $this->normalizeRecord($collection, $payload, $current);
        $row = $this->toStorageRow(
            $collection,
            array_merge($normalized, ['id' => $id]),
            (string) ($currentRow['created_at'] ?? date('c')),
            date('c'),
        );

        $assignments = [];
        $params = [':id' => $id];
        foreach ($row as $column => $value) {
            if ($column === 'id' || $column === 'created_at') {
                continue;
            }

            $assignments[] = $column . ' = :' . $column;
            $params[':' . $column] = $value;
        }

        $statement = $this->pdo->prepare(
            'UPDATE ' . $this->tableName($collection) . ' SET ' . implode(', ', $assignments) . ' WHERE id = :id'
        );
        $statement->execute($params);

        return $this->find($collection, $id);
    }

    private function replaceAll(string $collection, array $items): void
    {
        $startedTransaction = !$this->pdo->inTransaction();
        if ($startedTransaction) {
            $this->pdo->beginTransaction();
        }

        try {
            $this->pdo->exec('DELETE FROM ' . $this->tableName($collection));

            foreach ($items as $item) {
                $row = $this->toStorageRow($collection, $this->normalizeRecord($collection, $item));
                $this->insertRow($collection, $row);
            }

            if ($startedTransaction) {
                $this->pdo->commit();
            }
        } catch (Throwable $exception) {
            if ($startedTransaction && $this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $exception;
        }
    }

    private function delete(string $collection, int $id): ?array
    {
        $current = $this->find($collection, $id);
        if ($current === null) {
            return null;
        }

        $statement = $this->pdo->prepare('DELETE FROM ' . $this->tableName($collection) . ' WHERE id = :id');
        $statement->execute([':id' => $id]);

        return $current;
    }

    private function rawRow(string $collection, int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM ' . $this->tableName($collection) . ' WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function insertRow(string $collection, array $row): int
    {
        $columns = [];
        $placeholders = [];
        $params = [];

        foreach ($row as $column => $value) {
            if ($column === 'id' && ($value === null || (int) $value <= 0)) {
                continue;
            }

            $columns[] = $column;
            $placeholders[] = ':' . $column;
            $params[':' . $column] = $value;
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO ' . $this->tableName($collection) . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')'
        );
        $statement->execute($params);

        return isset($row['id']) && (int) $row['id'] > 0 ? (int) $row['id'] : (int) $this->pdo->lastInsertId();
    }

    private function normalizeRecord(string $collection, array $payload, ?array $current = null): array
    {
        return match ($collection) {
            self::POLICY_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'name' => trim((string) ($payload['name'] ?? ($current['name'] ?? 'Untitled policy'))),
                'scope' => trim((string) ($payload['scope'] ?? ($current['scope'] ?? 'org'))),
                'description' => trim((string) ($payload['description'] ?? ($current['description'] ?? ''))),
                'permissions' => $this->normalizeStringList($payload['permissions'] ?? ($current['permissions'] ?? [])),
            ],
            self::DICTIONARY_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'key' => trim((string) ($payload['key'] ?? ($current['key'] ?? ''))),
                'name' => trim((string) ($payload['name'] ?? ($current['name'] ?? 'Untitled dictionary'))),
                'values' => $this->normalizeStringList($payload['values'] ?? ($current['values'] ?? [])),
                'updated_at' => trim((string) ($payload['updated_at'] ?? ($current['updated_at'] ?? date('c')))),
            ],
            self::WORKFLOW_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'name' => trim((string) ($payload['name'] ?? ($current['name'] ?? 'Untitled workflow'))),
                'scope' => trim((string) ($payload['scope'] ?? ($current['scope'] ?? 'org'))),
                'stages' => $this->normalizeStringList($payload['stages'] ?? ($current['stages'] ?? [])),
                'enabled' => (bool) ($payload['enabled'] ?? ($current['enabled'] ?? false)),
                'updated_at' => trim((string) ($payload['updated_at'] ?? ($current['updated_at'] ?? date('c')))),
            ],
            default => throw new \InvalidArgumentException('unsupported_settings_collection'),
        };
    }

    private function toStorageRow(string $collection, array $record, ?string $createdAt = null, ?string $updatedAt = null): array
    {
        $timestamp = date('c');
        $createdAt = $createdAt ?? (string) ($record['created_at'] ?? $timestamp);
        $updatedAt = $updatedAt ?? (string) ($record['updated_at'] ?? $timestamp);

        return match ($collection) {
            self::POLICY_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'name' => (string) ($record['name'] ?? 'Untitled policy'),
                'scope' => (string) ($record['scope'] ?? 'org'),
                'description' => (string) ($record['description'] ?? ''),
                'permissions_json' => $this->encodeJsonList($record['permissions'] ?? []),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::DICTIONARY_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'dictionary_key' => (string) ($record['key'] ?? ''),
                'name' => (string) ($record['name'] ?? 'Untitled dictionary'),
                'values_json' => $this->encodeJsonList($record['values'] ?? []),
                'created_at' => $createdAt,
                'updated_at' => (string) ($record['updated_at'] ?? $updatedAt),
            ],
            self::WORKFLOW_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'name' => (string) ($record['name'] ?? 'Untitled workflow'),
                'scope' => (string) ($record['scope'] ?? 'org'),
                'stages_json' => $this->encodeJsonList($record['stages'] ?? []),
                'enabled' => (bool) ($record['enabled'] ?? false) ? 1 : 0,
                'created_at' => $createdAt,
                'updated_at' => (string) ($record['updated_at'] ?? $updatedAt),
            ],
            default => throw new \InvalidArgumentException('unsupported_settings_collection'),
        };
    }

    private function mapRow(string $collection, array $row): array
    {
        return match ($collection) {
            self::POLICY_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'scope' => (string) ($row['scope'] ?? 'org'),
                'description' => (string) ($row['description'] ?? ''),
                'permissions' => $this->decodeJsonList((string) ($row['permissions_json'] ?? '[]')),
            ],
            self::DICTIONARY_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'key' => (string) ($row['dictionary_key'] ?? ''),
                'name' => (string) ($row['name'] ?? ''),
                'values' => $this->decodeJsonList((string) ($row['values_json'] ?? '[]')),
                'updated_at' => (string) ($row['updated_at'] ?? ''),
            ],
            self::WORKFLOW_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'scope' => (string) ($row['scope'] ?? 'org'),
                'stages' => $this->decodeJsonList((string) ($row['stages_json'] ?? '[]')),
                'enabled' => (bool) ($row['enabled'] ?? false),
                'updated_at' => (string) ($row['updated_at'] ?? ''),
            ],
            default => throw new \InvalidArgumentException('unsupported_settings_collection'),
        };
    }

    private function collections(): array
    {
        return [
            self::POLICY_COLLECTION,
            self::DICTIONARY_COLLECTION,
            self::WORKFLOW_COLLECTION,
        ];
    }

    private function tableName(string $collection): string
    {
        return match ($collection) {
            self::POLICY_COLLECTION => 'settings_policies',
            self::DICTIONARY_COLLECTION => 'settings_dictionaries',
            self::WORKFLOW_COLLECTION => 'settings_workflows',
            default => throw new \InvalidArgumentException('unsupported_settings_collection'),
        };
    }

    private function tableCount(string $collection): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM ' . $this->tableName($collection))->fetchColumn();
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

    private function ensureMysqlSchema(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS `settings_policies` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`name` VARCHAR(191) NOT NULL,' .
            '`scope` VARCHAR(32) NOT NULL,' .
            '`description` LONGTEXT NOT NULL,' .
            '`permissions_json` LONGTEXT NOT NULL,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS `settings_dictionaries` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`dictionary_key` VARCHAR(64) NOT NULL,' .
            '`name` VARCHAR(191) NOT NULL,' .
            '`values_json` LONGTEXT NOT NULL,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`),' .
            'UNIQUE KEY `uniq_settings_dictionaries_key` (`dictionary_key`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS `settings_workflows` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`name` VARCHAR(191) NOT NULL,' .
            '`scope` VARCHAR(32) NOT NULL,' .
            '`stages_json` LONGTEXT NOT NULL,' .
            '`enabled` TINYINT(1) NOT NULL DEFAULT 0,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    private function ensureSqliteSchema(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS settings_policies (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'name VARCHAR(191) NOT NULL,' .
            'scope VARCHAR(32) NOT NULL,' .
            'description TEXT NOT NULL,' .
            'permissions_json TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS settings_dictionaries (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'dictionary_key VARCHAR(64) NOT NULL UNIQUE,' .
            'name VARCHAR(191) NOT NULL,' .
            'values_json TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS settings_workflows (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'name VARCHAR(191) NOT NULL,' .
            'scope VARCHAR(32) NOT NULL,' .
            'stages_json TEXT NOT NULL,' .
            'enabled INTEGER NOT NULL DEFAULT 0,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
    }

    private function normalizeStringList(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $items = [];
        foreach ($value as $item) {
            $normalized = trim((string) $item);
            if ($normalized === '') {
                continue;
            }

            $items[] = $normalized;
        }

        return array_values(array_unique($items));
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
