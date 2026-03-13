<?php

declare(strict_types=1);

namespace App\Support;

use app\model\DeliveryExecution;
use app\model\DeliveryProject;
use app\model\DeliveryRequirement;
use app\model\DeliveryTask;
use think\facade\Db;

final class DeliveryStore
{
    private const PROJECT_COLLECTION = 'projects';
    private const REQUIREMENT_COLLECTION = 'requirements';
    private const EXECUTION_COLLECTION = 'executions';
    private const TASK_COLLECTION = 'tasks';

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

    public function allProjects(): array { return $this->all(self::PROJECT_COLLECTION); }

    public function findProject(int $id): ?array { return $this->find(self::PROJECT_COLLECTION, $id); }

    public function createProject(array $payload): array { return $this->create(self::PROJECT_COLLECTION, $payload); }

    public function updateProject(int $id, array $payload): ?array { return $this->update(self::PROJECT_COLLECTION, $id, $payload); }

    public function replaceAllProjects(array $items): void { $this->replaceAll(self::PROJECT_COLLECTION, $items); }

    public function deleteProject(int $id): ?array { return $this->delete(self::PROJECT_COLLECTION, $id); }

    public function allRequirements(): array { return $this->all(self::REQUIREMENT_COLLECTION); }

    public function findRequirement(int $id): ?array { return $this->find(self::REQUIREMENT_COLLECTION, $id); }

    public function createRequirement(array $payload): array { return $this->create(self::REQUIREMENT_COLLECTION, $payload); }

    public function updateRequirement(int $id, array $payload): ?array { return $this->update(self::REQUIREMENT_COLLECTION, $id, $payload); }

    public function replaceAllRequirements(array $items): void { $this->replaceAll(self::REQUIREMENT_COLLECTION, $items); }

    public function deleteRequirement(int $id): ?array { return $this->delete(self::REQUIREMENT_COLLECTION, $id); }

    public function allExecutions(): array { return $this->all(self::EXECUTION_COLLECTION); }

    public function findExecution(int $id): ?array { return $this->find(self::EXECUTION_COLLECTION, $id); }

    public function createExecution(array $payload): array { return $this->create(self::EXECUTION_COLLECTION, $payload); }

    public function updateExecution(int $id, array $payload): ?array { return $this->update(self::EXECUTION_COLLECTION, $id, $payload); }

    public function replaceAllExecutions(array $items): void { $this->replaceAll(self::EXECUTION_COLLECTION, $items); }

    public function deleteExecution(int $id): ?array { return $this->delete(self::EXECUTION_COLLECTION, $id); }

    public function allTasks(): array { return $this->all(self::TASK_COLLECTION); }

    public function findTask(int $id): ?array { return $this->find(self::TASK_COLLECTION, $id); }

    public function createTask(array $payload): array { return $this->create(self::TASK_COLLECTION, $payload); }

    public function updateTask(int $id, array $payload): ?array { return $this->update(self::TASK_COLLECTION, $id, $payload); }

    public function replaceAllTasks(array $items): void { $this->replaceAll(self::TASK_COLLECTION, $items); }

    public function deleteTask(int $id): ?array { return $this->delete(self::TASK_COLLECTION, $id); }

    public function diagnostics(): array
    {
        return [
            'delivery_projects' => $this->tableCount(self::PROJECT_COLLECTION),
            'delivery_requirements' => $this->tableCount(self::REQUIREMENT_COLLECTION),
            'delivery_executions' => $this->tableCount(self::EXECUTION_COLLECTION),
            'delivery_tasks' => $this->tableCount(self::TASK_COLLECTION),
        ];
    }

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

    private function modelClass(string $collection): string
    {
        return match ($collection) {
            self::PROJECT_COLLECTION => DeliveryProject::class,
            self::REQUIREMENT_COLLECTION => DeliveryRequirement::class,
            self::EXECUTION_COLLECTION => DeliveryExecution::class,
            self::TASK_COLLECTION => DeliveryTask::class,
            default => throw new \InvalidArgumentException('unsupported_delivery_collection'),
        };
    }

    private function normalizeRecord(string $collection, array $payload, ?array $current = null): array
    {
        return match ($collection) {
            self::PROJECT_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'name' => trim((string) ($payload['name'] ?? ($current['name'] ?? 'Untitled project'))),
                'code' => trim((string) ($payload['code'] ?? ($current['code'] ?? 'AUTO-' . date('His')))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'status' => trim((string) ($payload['status'] ?? ($current['status'] ?? 'Active'))),
                'risk_count' => (int) ($payload['risk_count'] ?? ($current['risk_count'] ?? 0)),
                'execution_count' => (int) ($payload['execution_count'] ?? ($current['execution_count'] ?? 0)),
            ],
            self::REQUIREMENT_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'title' => trim((string) ($payload['title'] ?? ($current['title'] ?? 'Untitled draft'))),
                'status' => trim((string) ($payload['status'] ?? ($current['status'] ?? 'Draft'))),
                'priority' => trim((string) ($payload['priority'] ?? ($current['priority'] ?? 'P1'))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'expected_release_at' => trim((string) ($payload['expected_release_at'] ?? ($current['expected_release_at'] ?? ''))),
                'description' => (string) ($payload['description'] ?? ($current['description'] ?? '')),
                'current_stage' => (string) ($payload['current_stage'] ?? ($current['current_stage'] ?? 'Drafting')),
                'solution_summary' => (string) ($payload['solution_summary'] ?? ($current['solution_summary'] ?? '')),
                'acceptance_criteria' => $this->normalizeStringList($payload['acceptance_criteria'] ?? ($current['acceptance_criteria'] ?? [])),
                'impact_scope' => $this->normalizeStringList($payload['impact_scope'] ?? ($current['impact_scope'] ?? [])),
                'risks' => $this->normalizeStringList($payload['risks'] ?? ($current['risks'] ?? [])),
                'maturity_checks' => $this->normalizeMaturityChecks($payload['maturity_checks'] ?? ($current['maturity_checks'] ?? [])),
                'linked_execution_ids' => $this->normalizeIntList($payload['linked_execution_ids'] ?? ($current['linked_execution_ids'] ?? [])),
            ],
            self::EXECUTION_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'name' => trim((string) ($payload['name'] ?? ($current['name'] ?? 'Untitled execution'))),
                'project_id' => (int) ($payload['project_id'] ?? ($current['project_id'] ?? 0)),
                'project_name' => trim((string) ($payload['project_name'] ?? ($current['project_name'] ?? 'Unassigned project'))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'status' => trim((string) ($payload['status'] ?? ($current['status'] ?? 'NotStarted'))),
                'plan_start' => trim((string) ($payload['plan_start'] ?? ($current['plan_start'] ?? ''))),
                'plan_end' => trim((string) ($payload['plan_end'] ?? ($current['plan_end'] ?? ''))),
                'plan_progress' => (int) ($payload['plan_progress'] ?? ($current['plan_progress'] ?? 0)),
                'actual_progress' => (int) ($payload['actual_progress'] ?? ($current['actual_progress'] ?? 0)),
                'requirement_ids' => $this->normalizeIntList($payload['requirement_ids'] ?? ($current['requirement_ids'] ?? [])),
            ],
            self::TASK_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'execution_id' => (int) ($payload['execution_id'] ?? ($current['execution_id'] ?? 0)),
                'name' => trim((string) ($payload['name'] ?? ($current['name'] ?? 'Untitled child execution'))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'status' => trim((string) ($payload['status'] ?? ($current['status'] ?? 'NotStarted'))),
                'actual_progress' => (int) ($payload['actual_progress'] ?? ($current['actual_progress'] ?? 0)),
            ],
            default => throw new \InvalidArgumentException('unsupported_delivery_collection'),
        };
    }

    private function toStorageRow(string $collection, array $item, ?string $createdAt = null, ?string $updatedAt = null): array
    {
        $timestamp = date('c');
        $createdAt = $createdAt ?? (string) ($item['created_at'] ?? $timestamp);
        $updatedAt = $updatedAt ?? (string) ($item['updated_at'] ?? $timestamp);

        return match ($collection) {
            self::PROJECT_COLLECTION => [
                'id' => (int) ($item['id'] ?? 0) > 0 ? (int) $item['id'] : null,
                'name' => (string) ($item['name'] ?? 'Untitled project'),
                'code' => (string) ($item['code'] ?? 'AUTO-' . date('His')),
                'owner_name' => (string) ($item['owner_name'] ?? 'Unassigned'),
                'status' => (string) ($item['status'] ?? 'Active'),
                'risk_count' => (int) ($item['risk_count'] ?? 0),
                'execution_count' => (int) ($item['execution_count'] ?? 0),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::REQUIREMENT_COLLECTION => [
                'id' => (int) ($item['id'] ?? 0) > 0 ? (int) $item['id'] : null,
                'title' => (string) ($item['title'] ?? 'Untitled draft'),
                'status' => (string) ($item['status'] ?? 'Draft'),
                'priority' => (string) ($item['priority'] ?? 'P1'),
                'owner_name' => (string) ($item['owner_name'] ?? 'Unassigned'),
                'expected_release_at' => (string) ($item['expected_release_at'] ?? ''),
                'description' => (string) ($item['description'] ?? ''),
                'current_stage' => (string) ($item['current_stage'] ?? 'Drafting'),
                'solution_summary' => (string) ($item['solution_summary'] ?? ''),
                'acceptance_criteria_json' => $this->encodeJson($item['acceptance_criteria'] ?? []),
                'impact_scope_json' => $this->encodeJson($item['impact_scope'] ?? []),
                'risks_json' => $this->encodeJson($item['risks'] ?? []),
                'maturity_checks_json' => $this->encodeJson($item['maturity_checks'] ?? []),
                'linked_execution_ids_json' => $this->encodeJson($item['linked_execution_ids'] ?? []),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::EXECUTION_COLLECTION => [
                'id' => (int) ($item['id'] ?? 0) > 0 ? (int) $item['id'] : null,
                'name' => (string) ($item['name'] ?? 'Untitled execution'),
                'project_id' => (int) ($item['project_id'] ?? 0),
                'project_name' => (string) ($item['project_name'] ?? 'Unassigned project'),
                'owner_name' => (string) ($item['owner_name'] ?? 'Unassigned'),
                'status' => (string) ($item['status'] ?? 'NotStarted'),
                'plan_start' => (string) ($item['plan_start'] ?? ''),
                'plan_end' => (string) ($item['plan_end'] ?? ''),
                'plan_progress' => (int) ($item['plan_progress'] ?? 0),
                'actual_progress' => (int) ($item['actual_progress'] ?? 0),
                'requirement_ids_json' => $this->encodeJson($item['requirement_ids'] ?? []),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::TASK_COLLECTION => [
                'id' => (int) ($item['id'] ?? 0) > 0 ? (int) $item['id'] : null,
                'execution_id' => (int) ($item['execution_id'] ?? 0),
                'name' => (string) ($item['name'] ?? 'Untitled child execution'),
                'owner_name' => (string) ($item['owner_name'] ?? 'Unassigned'),
                'status' => (string) ($item['status'] ?? 'NotStarted'),
                'actual_progress' => (int) ($item['actual_progress'] ?? 0),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            default => throw new \InvalidArgumentException('unsupported_delivery_collection'),
        };
    }

    private function mapRow(string $collection, array $row): array
    {
        return match ($collection) {
            self::PROJECT_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'code' => (string) ($row['code'] ?? ''),
                'owner_name' => (string) ($row['owner_name'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'risk_count' => (int) ($row['risk_count'] ?? 0),
                'execution_count' => (int) ($row['execution_count'] ?? 0),
            ],
            self::REQUIREMENT_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'title' => (string) ($row['title'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'priority' => (string) ($row['priority'] ?? ''),
                'owner_name' => (string) ($row['owner_name'] ?? ''),
                'expected_release_at' => (string) ($row['expected_release_at'] ?? ''),
                'description' => (string) ($row['description'] ?? ''),
                'current_stage' => (string) ($row['current_stage'] ?? ''),
                'solution_summary' => (string) ($row['solution_summary'] ?? ''),
                'acceptance_criteria' => $this->normalizeStringList($this->decodeJson((string) ($row['acceptance_criteria_json'] ?? '[]'))),
                'impact_scope' => $this->normalizeStringList($this->decodeJson((string) ($row['impact_scope_json'] ?? '[]'))),
                'risks' => $this->normalizeStringList($this->decodeJson((string) ($row['risks_json'] ?? '[]'))),
                'maturity_checks' => $this->normalizeMaturityChecks($this->decodeJson((string) ($row['maturity_checks_json'] ?? '[]'))),
                'linked_execution_ids' => $this->normalizeIntList($this->decodeJson((string) ($row['linked_execution_ids_json'] ?? '[]'))),
            ],
            self::EXECUTION_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'project_id' => (int) ($row['project_id'] ?? 0),
                'project_name' => (string) ($row['project_name'] ?? ''),
                'owner_name' => (string) ($row['owner_name'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'plan_start' => (string) ($row['plan_start'] ?? ''),
                'plan_end' => (string) ($row['plan_end'] ?? ''),
                'plan_progress' => (int) ($row['plan_progress'] ?? 0),
                'actual_progress' => (int) ($row['actual_progress'] ?? 0),
                'requirement_ids' => $this->normalizeIntList($this->decodeJson((string) ($row['requirement_ids_json'] ?? '[]'))),
            ],
            self::TASK_COLLECTION => [
                'id' => (int) ($row['id'] ?? 0),
                'execution_id' => (int) ($row['execution_id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'owner_name' => (string) ($row['owner_name'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'actual_progress' => (int) ($row['actual_progress'] ?? 0),
            ],
            default => throw new \InvalidArgumentException('unsupported_delivery_collection'),
        };
    }

    private function collections(): array
    {
        return [
            self::PROJECT_COLLECTION,
            self::REQUIREMENT_COLLECTION,
            self::EXECUTION_COLLECTION,
            self::TASK_COLLECTION,
        ];
    }

    private function tableName(string $collection): string
    {
        return match ($collection) {
            self::PROJECT_COLLECTION => 'delivery_projects',
            self::REQUIREMENT_COLLECTION => 'delivery_requirements',
            self::EXECUTION_COLLECTION => 'delivery_executions',
            self::TASK_COLLECTION => 'delivery_tasks',
            default => throw new \InvalidArgumentException('unsupported_delivery_collection'),
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
            'CREATE TABLE IF NOT EXISTS `delivery_projects` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`name` VARCHAR(191) NOT NULL,' .
            '`code` VARCHAR(64) NOT NULL,' .
            '`owner_name` VARCHAR(128) NOT NULL,' .
            '`status` VARCHAR(32) NOT NULL,' .
            '`risk_count` INT NOT NULL DEFAULT 0,' .
            '`execution_count` INT NOT NULL DEFAULT 0,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS `delivery_requirements` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`title` VARCHAR(191) NOT NULL,' .
            '`status` VARCHAR(32) NOT NULL,' .
            '`priority` VARCHAR(32) NOT NULL,' .
            '`owner_name` VARCHAR(128) NOT NULL,' .
            '`expected_release_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`description` LONGTEXT NOT NULL,' .
            '`current_stage` VARCHAR(64) NOT NULL,' .
            '`solution_summary` LONGTEXT NOT NULL,' .
            '`acceptance_criteria_json` LONGTEXT NOT NULL,' .
            '`impact_scope_json` LONGTEXT NOT NULL,' .
            '`risks_json` LONGTEXT NOT NULL,' .
            '`maturity_checks_json` LONGTEXT NOT NULL,' .
            '`linked_execution_ids_json` LONGTEXT NOT NULL,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS `delivery_executions` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`name` VARCHAR(191) NOT NULL,' .
            '`project_id` INT NOT NULL DEFAULT 0,' .
            '`project_name` VARCHAR(191) NOT NULL,' .
            '`owner_name` VARCHAR(128) NOT NULL,' .
            '`status` VARCHAR(32) NOT NULL,' .
            '`plan_start` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`plan_end` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`plan_progress` INT NOT NULL DEFAULT 0,' .
            '`actual_progress` INT NOT NULL DEFAULT 0,' .
            '`requirement_ids_json` LONGTEXT NOT NULL,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`),' .
            'KEY `idx_delivery_executions_project` (`project_id`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS `delivery_tasks` (' .
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
            '`execution_id` INT NOT NULL DEFAULT 0,' .
            '`name` VARCHAR(191) NOT NULL,' .
            '`owner_name` VARCHAR(128) NOT NULL,' .
            '`status` VARCHAR(32) NOT NULL,' .
            '`actual_progress` INT NOT NULL DEFAULT 0,' .
            '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'PRIMARY KEY (`id`),' .
            'KEY `idx_delivery_tasks_execution` (`execution_id`)' .
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    private function ensureSqliteSchema(): void
    {
        Db::execute(
            'CREATE TABLE IF NOT EXISTS delivery_projects (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'name VARCHAR(191) NOT NULL,' .
            'code VARCHAR(64) NOT NULL,' .
            'owner_name VARCHAR(128) NOT NULL,' .
            'status VARCHAR(32) NOT NULL,' .
            'risk_count INTEGER NOT NULL DEFAULT 0,' .
            'execution_count INTEGER NOT NULL DEFAULT 0,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS delivery_requirements (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'title VARCHAR(191) NOT NULL,' .
            'status VARCHAR(32) NOT NULL,' .
            'priority VARCHAR(32) NOT NULL,' .
            'owner_name VARCHAR(128) NOT NULL,' .
            'expected_release_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'description TEXT NOT NULL,' .
            'current_stage VARCHAR(64) NOT NULL,' .
            'solution_summary TEXT NOT NULL,' .
            'acceptance_criteria_json TEXT NOT NULL,' .
            'impact_scope_json TEXT NOT NULL,' .
            'risks_json TEXT NOT NULL,' .
            'maturity_checks_json TEXT NOT NULL,' .
            'linked_execution_ids_json TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute(
            'CREATE TABLE IF NOT EXISTS delivery_executions (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'name VARCHAR(191) NOT NULL,' .
            'project_id INTEGER NOT NULL DEFAULT 0,' .
            'project_name VARCHAR(191) NOT NULL,' .
            'owner_name VARCHAR(128) NOT NULL,' .
            'status VARCHAR(32) NOT NULL,' .
            'plan_start VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'plan_end VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'plan_progress INTEGER NOT NULL DEFAULT 0,' .
            'actual_progress INTEGER NOT NULL DEFAULT 0,' .
            'requirement_ids_json TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute('CREATE INDEX IF NOT EXISTS idx_delivery_executions_project ON delivery_executions(project_id)');
        Db::execute(
            'CREATE TABLE IF NOT EXISTS delivery_tasks (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'execution_id INTEGER NOT NULL DEFAULT 0,' .
            'name VARCHAR(191) NOT NULL,' .
            'owner_name VARCHAR(128) NOT NULL,' .
            'status VARCHAR(32) NOT NULL,' .
            'actual_progress INTEGER NOT NULL DEFAULT 0,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\'' .
            ')'
        );
        Db::execute('CREATE INDEX IF NOT EXISTS idx_delivery_tasks_execution ON delivery_tasks(execution_id)');
    }

    private function encodeJson(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    }

    private function decodeJson(string $value): array
    {
        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeStringList(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            $value = trim((string) $item);
            if ($value !== '') {
                $normalized[] = $value;
            }
        }

        return array_values($normalized);
    }

    private function normalizeIntList(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            $value = (int) $item;
            if ($value > 0) {
                $normalized[] = $value;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function normalizeMaturityChecks(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $normalized[] = [
                'key' => trim((string) ($item['key'] ?? '')),
                'label' => trim((string) ($item['label'] ?? '')),
                'passed' => (bool) ($item['passed'] ?? false),
            ];
        }

        return array_values($normalized);
    }
}