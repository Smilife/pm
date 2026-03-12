<?php

declare(strict_types=1);

namespace App\Support;

use app\model\SettingsDictionary;
use app\model\SettingsPolicy;
use app\model\SettingsWorkflow;
use think\Model;
use think\facade\Db;

final class SettingsStore
{
    private const POLICY_COLLECTION = 'policies';
    private const DICTIONARY_COLLECTION = 'dictionaries';
    private const WORKFLOW_COLLECTION = 'workflows';

    public function __construct(
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

            Db::transaction(function () use ($collection, $items): void {
                foreach ($items as $item) {
                    $row = $this->toStorageRow($collection, $this->normalizeRecord($collection, $item));
                    $this->insertRow($collection, $row);
                }
            });
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
        $items = [];
        foreach ($this->modelClass($collection)::order('id', 'asc')->select() as $model) {
            $items[] = $this->mapRow($collection, $model->toArray());
        }

        return $items;
    }

    private function find(string $collection, int $id): ?array
    {
        $model = $this->modelClass($collection)::find($id);

        return $model === null ? null : $this->mapRow($collection, $model->toArray());
    }

    private function create(string $collection, array $payload): array
    {
        return Db::transaction(function () use ($collection, $payload): array {
            $normalized = $this->normalizeRecord($collection, $payload);
            $row = $this->toStorageRow($collection, $normalized);
            $id = $this->insertRow($collection, $row);

            return $this->find($collection, $id) ?? array_merge($normalized, ['id' => $id]);
        });
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

        $this->updateRow($collection, $id, $row);

        return $this->find($collection, $id);
    }

    private function replaceAll(string $collection, array $items): void
    {
        Db::transaction(function () use ($collection, $items): void {
            Db::execute('DELETE FROM ' . $this->tableName($collection));

            foreach ($items as $item) {
                $row = $this->toStorageRow($collection, $this->normalizeRecord($collection, $item));
                $this->insertRow($collection, $row);
            }
        });
    }

    private function delete(string $collection, int $id): ?array
    {
        $current = $this->find($collection, $id);
        if ($current === null) {
            return null;
        }

        $model = $this->modelClass($collection)::find($id);
        if ($model !== null) {
            $model->delete();
        }

        return $current;
    }

    private function rawRow(string $collection, int $id): ?array
    {
        $model = $this->modelClass($collection)::find($id);

        return $model === null ? null : $model->toArray();
    }

    private function insertRow(string $collection, array $row): int
    {
        $modelClass = $this->modelClass($collection);
        $model = new $modelClass();
        $data = $row;
        if (!isset($data['id']) || $data['id'] === null || (int) $data['id'] <= 0) {
            unset($data['id']);
        }

        $model->save($data);

        return (int) $model->getAttr('id');
    }

    private function updateRow(string $collection, int $id, array $row): void
    {
        $model = $this->modelClass($collection)::find($id);
        if ($model === null) {
            return;
        }

        $data = $row;
        unset($data['id']);

        $model->save($data);
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

    private function modelClass(string $collection): string
    {
        return match ($collection) {
            self::POLICY_COLLECTION => SettingsPolicy::class,
            self::DICTIONARY_COLLECTION => SettingsDictionary::class,
            self::WORKFLOW_COLLECTION => SettingsWorkflow::class,
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
        return (int) Db::name($this->tableName($collection))->count();
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

    private function ensureMysqlSchema(): void
    {
        Db::execute(
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
        Db::execute(
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
        Db::execute(
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
        Db::execute(
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
        Db::execute(
            'CREATE TABLE IF NOT EXISTS settings_dictionaries (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'dictionary_key VARCHAR(64) NOT NULL UNIQUE,' .
            'name VARCHAR(191) NOT NULL,' .
            'values_json TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute(
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