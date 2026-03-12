<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use Throwable;

final class CollaborationStore
{
    private const WORKLOG_COLLECTION = 'worklogs';
    private const DAILY_TASK_COLLECTION = 'daily_tasks';
    private const BUG_COLLECTION = 'bugs';
    private const REQUIREMENT_REVIEW_COLLECTION = 'requirement_reviews';
    private const REQUIREMENT_ATTACHMENT_COLLECTION = 'requirement_attachments';

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
                    $this->insertRow($collection, $this->rowFromRecord($collection, $this->normalizeRecord($collection, $item)));
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
            'collaboration_worklogs' => $this->tableCount(self::WORKLOG_COLLECTION),
            'collaboration_daily_tasks' => $this->tableCount(self::DAILY_TASK_COLLECTION),
            'collaboration_bugs' => $this->tableCount(self::BUG_COLLECTION),
            'collaboration_requirement_reviews' => $this->tableCount(self::REQUIREMENT_REVIEW_COLLECTION),
            'collaboration_requirement_attachments' => $this->tableCount(self::REQUIREMENT_ATTACHMENT_COLLECTION),
        ];
    }

    public function allWorklogs(): array { return $this->all(self::WORKLOG_COLLECTION); }
    public function findWorklog(int $id): ?array { return $this->find(self::WORKLOG_COLLECTION, $id); }
    public function createWorklog(array $payload): array { return $this->create(self::WORKLOG_COLLECTION, $payload); }
    public function updateWorklog(int $id, array $payload): ?array { return $this->update(self::WORKLOG_COLLECTION, $id, $payload); }
    public function replaceAllWorklogs(array $items): void { $this->replaceAll(self::WORKLOG_COLLECTION, $items); }
    public function deleteWorklog(int $id): ?array { return $this->delete(self::WORKLOG_COLLECTION, $id); }

    public function allDailyTasks(): array { return $this->all(self::DAILY_TASK_COLLECTION); }
    public function findDailyTask(int $id): ?array { return $this->find(self::DAILY_TASK_COLLECTION, $id); }
    public function createDailyTask(array $payload): array { return $this->create(self::DAILY_TASK_COLLECTION, $payload); }
    public function updateDailyTask(int $id, array $payload): ?array { return $this->update(self::DAILY_TASK_COLLECTION, $id, $payload); }
    public function replaceAllDailyTasks(array $items): void { $this->replaceAll(self::DAILY_TASK_COLLECTION, $items); }
    public function deleteDailyTask(int $id): ?array { return $this->delete(self::DAILY_TASK_COLLECTION, $id); }

    public function allBugs(): array { return $this->all(self::BUG_COLLECTION); }
    public function findBug(int $id): ?array { return $this->find(self::BUG_COLLECTION, $id); }
    public function createBug(array $payload): array { return $this->create(self::BUG_COLLECTION, $payload); }
    public function updateBug(int $id, array $payload): ?array { return $this->update(self::BUG_COLLECTION, $id, $payload); }
    public function replaceAllBugs(array $items): void { $this->replaceAll(self::BUG_COLLECTION, $items); }
    public function deleteBug(int $id): ?array { return $this->delete(self::BUG_COLLECTION, $id); }

    public function allRequirementReviews(): array { return $this->all(self::REQUIREMENT_REVIEW_COLLECTION); }
    public function findRequirementReview(int $id): ?array { return $this->find(self::REQUIREMENT_REVIEW_COLLECTION, $id); }
    public function createRequirementReview(array $payload): array { return $this->create(self::REQUIREMENT_REVIEW_COLLECTION, $payload); }
    public function updateRequirementReview(int $id, array $payload): ?array { return $this->update(self::REQUIREMENT_REVIEW_COLLECTION, $id, $payload); }
    public function replaceAllRequirementReviews(array $items): void { $this->replaceAll(self::REQUIREMENT_REVIEW_COLLECTION, $items); }
    public function deleteRequirementReview(int $id): ?array { return $this->delete(self::REQUIREMENT_REVIEW_COLLECTION, $id); }

    public function allRequirementAttachments(): array { return $this->all(self::REQUIREMENT_ATTACHMENT_COLLECTION); }
    public function findRequirementAttachment(int $id): ?array { return $this->find(self::REQUIREMENT_ATTACHMENT_COLLECTION, $id); }
    public function createRequirementAttachment(array $payload): array { return $this->create(self::REQUIREMENT_ATTACHMENT_COLLECTION, $payload); }
    public function updateRequirementAttachment(int $id, array $payload): ?array { return $this->update(self::REQUIREMENT_ATTACHMENT_COLLECTION, $id, $payload); }
    public function replaceAllRequirementAttachments(array $items): void { $this->replaceAll(self::REQUIREMENT_ATTACHMENT_COLLECTION, $items); }
    public function deleteRequirementAttachment(int $id): ?array { return $this->delete(self::REQUIREMENT_ATTACHMENT_COLLECTION, $id); }

    private function all(string $collection): array
    {
        $statement = $this->pdo->query('SELECT * FROM ' . $this->tableName($collection) . ' ORDER BY id ASC');
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn (array $row): array => $this->recordFromRow($collection, $row), $rows);
    }

    private function find(string $collection, int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM ' . $this->tableName($collection) . ' WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $this->recordFromRow($collection, $row);
    }

    private function create(string $collection, array $payload): array
    {
        $startedTransaction = !$this->pdo->inTransaction();
        if ($startedTransaction) {
            $this->pdo->beginTransaction();
        }

        try {
            $record = $this->normalizeRecord($collection, $payload);
            $id = $this->insertRow($collection, $this->rowFromRecord($collection, $record));
            if ($startedTransaction) {
                $this->pdo->commit();
            }

            return $this->find($collection, $id) ?? array_merge($record, ['id' => $id]);
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

        $current = $this->recordFromRow($collection, $currentRow);
        $record = $this->normalizeRecord($collection, $payload, $current);
        $row = $this->rowFromRecord($collection, array_merge($record, ['id' => $id]), (string) ($currentRow['created_at'] ?? date('c')), date('c'));

        $assignments = [];
        $params = [':id' => $id];
        foreach ($row as $column => $value) {
            if ($column === 'id' || $column === 'created_at') {
                continue;
            }
            $assignments[] = $column . ' = :' . $column;
            $params[':' . $column] = $value;
        }

        $statement = $this->pdo->prepare('UPDATE ' . $this->tableName($collection) . ' SET ' . implode(', ', $assignments) . ' WHERE id = :id');
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
                $this->insertRow($collection, $this->rowFromRecord($collection, $this->normalizeRecord($collection, $item)));
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

        $statement = $this->pdo->prepare('INSERT INTO ' . $this->tableName($collection) . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')');
        $statement->execute($params);

        return isset($row['id']) && (int) $row['id'] > 0 ? (int) $row['id'] : (int) $this->pdo->lastInsertId();
    }

    private function rawRow(string $collection, int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM ' . $this->tableName($collection) . ' WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function recordFromRow(string $collection, array $row): array
    {
        $payload = $this->decodePayload((string) ($row['payload_json'] ?? '{}'), (int) ($row['id'] ?? 0));

        $record = match ($collection) {
            self::WORKLOG_COLLECTION => [
                ...$payload,
                'execution_id' => (int) ($row['execution_id'] ?? ($payload['execution_id'] ?? 0)),
                'owner_name' => (string) ($row['owner_name'] ?? ($payload['owner_name'] ?? '')),
                'work_date' => (string) ($row['work_date'] ?? ($payload['work_date'] ?? '')),
            ],
            self::DAILY_TASK_COLLECTION => [
                ...$payload,
                'owner_name' => (string) ($row['owner_name'] ?? ($payload['owner_name'] ?? '')),
                'status' => (string) ($row['status'] ?? ($payload['status'] ?? '')),
                'due_at' => (string) ($row['due_at'] ?? ($payload['due_at'] ?? '')),
                'exclude_from_report' => (bool) ($row['exclude_from_report'] ?? ($payload['exclude_from_report'] ?? false)),
            ],
            self::BUG_COLLECTION => [
                ...$payload,
                'status' => (string) ($row['status'] ?? ($payload['status'] ?? '')),
                'link_type' => (string) ($row['link_type'] ?? ($payload['link_type'] ?? '')),
                'link_id' => (int) ($row['link_id'] ?? ($payload['link_id'] ?? 0)),
                'owner_name' => (string) ($row['owner_name'] ?? ($payload['owner_name'] ?? '')),
                'reporter_name' => (string) ($row['reporter_name'] ?? ($payload['reporter_name'] ?? '')),
                'submitted_at' => $this->nullableString($row['submitted_at'] ?? ($payload['submitted_at'] ?? null)),
            ],
            self::REQUIREMENT_REVIEW_COLLECTION => [
                ...$payload,
                'requirement_id' => (int) ($row['requirement_id'] ?? ($payload['requirement_id'] ?? 0)),
                'reviewed_at' => (string) ($row['reviewed_at'] ?? ($payload['reviewed_at'] ?? '')),
            ],
            self::REQUIREMENT_ATTACHMENT_COLLECTION => [
                ...$payload,
                'requirement_id' => (int) ($row['requirement_id'] ?? ($payload['requirement_id'] ?? 0)),
                'file_type' => (string) ($row['file_type'] ?? ($payload['file_type'] ?? '')),
                'uploaded_at' => (string) ($row['uploaded_at'] ?? ($payload['uploaded_at'] ?? '')),
            ],
            default => $payload,
        };

        $record['id'] = (int) ($row['id'] ?? ($record['id'] ?? 0));

        return $record;
    }

    private function rowFromRecord(string $collection, array $record, ?string $createdAt = null, ?string $updatedAt = null): array
    {
        $timestamp = date('c');
        $createdAt = $createdAt ?? (string) ($record['created_at'] ?? $timestamp);
        $updatedAt = $updatedAt ?? (string) ($record['updated_at'] ?? $timestamp);
        $payload = $record;
        unset($payload['created_at'], $payload['updated_at']);

        return match ($collection) {
            self::WORKLOG_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'execution_id' => (int) ($record['execution_id'] ?? 0),
                'owner_name' => (string) ($record['owner_name'] ?? 'Unassigned'),
                'work_date' => (string) ($record['work_date'] ?? date('Y-m-d')),
                'payload_json' => $this->encodePayload($payload),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::DAILY_TASK_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'owner_name' => (string) ($record['owner_name'] ?? 'Unassigned'),
                'status' => (string) ($record['status'] ?? 'NotStarted'),
                'due_at' => (string) ($record['due_at'] ?? date('Y-m-d')),
                'exclude_from_report' => (int) ((bool) ($record['exclude_from_report'] ?? false)),
                'payload_json' => $this->encodePayload($payload),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::BUG_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'status' => (string) ($record['status'] ?? 'Draft'),
                'link_type' => (string) ($record['link_type'] ?? 'execution'),
                'link_id' => (int) ($record['link_id'] ?? 0),
                'owner_name' => (string) ($record['owner_name'] ?? 'Unassigned'),
                'reporter_name' => (string) ($record['reporter_name'] ?? 'Unknown reporter'),
                'submitted_at' => $this->nullableString($record['submitted_at'] ?? null),
                'payload_json' => $this->encodePayload($payload),
                'created_at' => (string) ($record['created_at'] ?? $createdAt),
                'updated_at' => (string) ($record['updated_at'] ?? $updatedAt),
            ],
            self::REQUIREMENT_REVIEW_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'requirement_id' => (int) ($record['requirement_id'] ?? 0),
                'reviewed_at' => (string) ($record['reviewed_at'] ?? date('c')),
                'payload_json' => $this->encodePayload($payload),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            self::REQUIREMENT_ATTACHMENT_COLLECTION => [
                'id' => (int) ($record['id'] ?? 0) > 0 ? (int) $record['id'] : null,
                'requirement_id' => (int) ($record['requirement_id'] ?? 0),
                'file_type' => (string) ($record['file_type'] ?? 'other'),
                'uploaded_at' => (string) ($record['uploaded_at'] ?? date('c')),
                'payload_json' => $this->encodePayload($payload),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
            default => throw new \InvalidArgumentException('unsupported_collaboration_collection'),
        };
    }

    private function normalizeRecord(string $collection, array $payload, ?array $current = null): array
    {
        return match ($collection) {
            self::WORKLOG_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'execution_id' => (int) ($payload['execution_id'] ?? ($current['execution_id'] ?? 0)),
                'execution_name' => trim((string) ($payload['execution_name'] ?? ($current['execution_name'] ?? 'Unknown execution'))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'work_date' => trim((string) ($payload['work_date'] ?? ($current['work_date'] ?? date('Y-m-d')))),
                'hours' => (float) ($payload['hours'] ?? ($current['hours'] ?? 0)),
                'summary' => (string) ($payload['summary'] ?? ($current['summary'] ?? '')),
            ],
            self::DAILY_TASK_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'title' => trim((string) ($payload['title'] ?? ($current['title'] ?? 'Untitled daily item'))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'status' => trim((string) ($payload['status'] ?? ($current['status'] ?? 'NotStarted'))),
                'due_at' => trim((string) ($payload['due_at'] ?? ($current['due_at'] ?? date('Y-m-d')))),
                'exclude_from_report' => (bool) ($payload['exclude_from_report'] ?? ($current['exclude_from_report'] ?? false)),
            ],
            self::BUG_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'title' => trim((string) ($payload['title'] ?? ($current['title'] ?? 'Untitled bug'))),
                'severity' => trim((string) ($payload['severity'] ?? ($current['severity'] ?? 'Medium'))),
                'priority' => trim((string) ($payload['priority'] ?? ($current['priority'] ?? 'P1'))),
                'status' => trim((string) ($payload['status'] ?? ($current['status'] ?? 'Draft'))),
                'link_type' => trim((string) ($payload['link_type'] ?? ($current['link_type'] ?? 'execution'))),
                'link_id' => (int) ($payload['link_id'] ?? ($current['link_id'] ?? 0)),
                'link_name' => trim((string) ($payload['link_name'] ?? ($current['link_name'] ?? 'Unlinked'))),
                'owner_name' => trim((string) ($payload['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
                'reporter_name' => trim((string) ($payload['reporter_name'] ?? ($current['reporter_name'] ?? 'Unknown reporter'))),
                'reproduction_steps' => $this->normalizeStringList($payload['reproduction_steps'] ?? ($current['reproduction_steps'] ?? [])),
                'expected_result' => (string) ($payload['expected_result'] ?? ($current['expected_result'] ?? '')),
                'actual_result' => (string) ($payload['actual_result'] ?? ($current['actual_result'] ?? '')),
                'created_at' => (string) ($payload['created_at'] ?? ($current['created_at'] ?? date('c'))),
                'updated_at' => (string) ($payload['updated_at'] ?? ($current['updated_at'] ?? date('c'))),
                'submitted_at' => $this->nullableString($payload['submitted_at'] ?? ($current['submitted_at'] ?? null)),
            ],
            self::REQUIREMENT_REVIEW_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'requirement_id' => (int) ($payload['requirement_id'] ?? ($current['requirement_id'] ?? 0)),
                'result' => trim((string) ($payload['result'] ?? ($current['result'] ?? 'supplement_required'))),
                'reviewer_name' => trim((string) ($payload['reviewer_name'] ?? ($current['reviewer_name'] ?? 'Anonymous reviewer'))),
                'comment' => (string) ($payload['comment'] ?? ($current['comment'] ?? '')),
                'reviewed_at' => trim((string) ($payload['reviewed_at'] ?? ($current['reviewed_at'] ?? date('c')))),
            ],
            self::REQUIREMENT_ATTACHMENT_COLLECTION => [
                'id' => (int) ($payload['id'] ?? ($current['id'] ?? 0)),
                'requirement_id' => (int) ($payload['requirement_id'] ?? ($current['requirement_id'] ?? 0)),
                'file_name' => trim((string) ($payload['file_name'] ?? ($current['file_name'] ?? 'attachment.bin'))),
                'file_type' => trim((string) ($payload['file_type'] ?? ($current['file_type'] ?? 'other'))),
                'mime_type' => trim((string) ($payload['mime_type'] ?? ($current['mime_type'] ?? 'application/octet-stream'))),
                'size' => (int) ($payload['size'] ?? ($current['size'] ?? 0)),
                'url' => trim((string) ($payload['url'] ?? ($current['url'] ?? ''))),
                'uploaded_at' => trim((string) ($payload['uploaded_at'] ?? ($current['uploaded_at'] ?? date('c')))),
            ],
            default => throw new \InvalidArgumentException('unsupported_collaboration_collection'),
        };
    }

    private function collections(): array
    {
        return [
            self::WORKLOG_COLLECTION,
            self::DAILY_TASK_COLLECTION,
            self::BUG_COLLECTION,
            self::REQUIREMENT_REVIEW_COLLECTION,
            self::REQUIREMENT_ATTACHMENT_COLLECTION,
        ];
    }

    private function tableName(string $collection): string
    {
        return match ($collection) {
            self::WORKLOG_COLLECTION => 'collaboration_worklogs',
            self::DAILY_TASK_COLLECTION => 'collaboration_daily_tasks',
            self::BUG_COLLECTION => 'collaboration_bugs',
            self::REQUIREMENT_REVIEW_COLLECTION => 'collaboration_requirement_reviews',
            self::REQUIREMENT_ATTACHMENT_COLLECTION => 'collaboration_requirement_attachments',
            default => throw new \InvalidArgumentException('unsupported_collaboration_collection'),
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

    private function decodePayload(string $payload, int $fallbackId): array
    {
        $decoded = json_decode($payload, true);
        if (!is_array($decoded)) {
            $decoded = [];
        }
        $decoded['id'] = (int) ($decoded['id'] ?? $fallbackId);
        return $decoded;
    }

    private function encodePayload(array $payload): string
    {
        return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }

    private function ensureMysqlSchema(): void
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS `collaboration_worklogs` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `execution_id` INT NOT NULL DEFAULT 0, `owner_name` VARCHAR(128) NOT NULL, `work_date` VARCHAR(32) NOT NULL, `payload_json` LONGTEXT NOT NULL, `created_at` VARCHAR(32) NOT NULL DEFAULT \'\', `updated_at` VARCHAR(32) NOT NULL DEFAULT \'\', PRIMARY KEY (`id`), KEY `idx_collaboration_worklogs_execution` (`execution_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS `collaboration_daily_tasks` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `owner_name` VARCHAR(128) NOT NULL, `status` VARCHAR(32) NOT NULL, `due_at` VARCHAR(32) NOT NULL, `exclude_from_report` TINYINT(1) NOT NULL DEFAULT 0, `payload_json` LONGTEXT NOT NULL, `created_at` VARCHAR(32) NOT NULL DEFAULT \'\', `updated_at` VARCHAR(32) NOT NULL DEFAULT \'\', PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS `collaboration_bugs` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `status` VARCHAR(32) NOT NULL, `link_type` VARCHAR(32) NOT NULL, `link_id` INT NOT NULL DEFAULT 0, `owner_name` VARCHAR(128) NOT NULL, `reporter_name` VARCHAR(128) NOT NULL, `submitted_at` VARCHAR(32) DEFAULT NULL, `payload_json` LONGTEXT NOT NULL, `created_at` VARCHAR(32) NOT NULL DEFAULT \'\', `updated_at` VARCHAR(32) NOT NULL DEFAULT \'\', PRIMARY KEY (`id`), KEY `idx_collaboration_bugs_link` (`link_type`, `link_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS `collaboration_requirement_reviews` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `requirement_id` INT NOT NULL DEFAULT 0, `reviewed_at` VARCHAR(32) NOT NULL, `payload_json` LONGTEXT NOT NULL, `created_at` VARCHAR(32) NOT NULL DEFAULT \'\', `updated_at` VARCHAR(32) NOT NULL DEFAULT \'\', PRIMARY KEY (`id`), KEY `idx_collaboration_requirement_reviews_requirement` (`requirement_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS `collaboration_requirement_attachments` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `requirement_id` INT NOT NULL DEFAULT 0, `file_type` VARCHAR(32) NOT NULL, `uploaded_at` VARCHAR(32) NOT NULL, `payload_json` LONGTEXT NOT NULL, `created_at` VARCHAR(32) NOT NULL DEFAULT \'\', `updated_at` VARCHAR(32) NOT NULL DEFAULT \'\', PRIMARY KEY (`id`), KEY `idx_collaboration_requirement_attachments_requirement` (`requirement_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }

    private function ensureSqliteSchema(): void
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS collaboration_worklogs (id INTEGER PRIMARY KEY AUTOINCREMENT, execution_id INTEGER NOT NULL DEFAULT 0, owner_name VARCHAR(128) NOT NULL, work_date VARCHAR(32) NOT NULL, payload_json TEXT NOT NULL, created_at VARCHAR(32) NOT NULL DEFAULT \'\', updated_at VARCHAR(32) NOT NULL DEFAULT \'\')');
        $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_collaboration_worklogs_execution ON collaboration_worklogs(execution_id)');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS collaboration_daily_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_name VARCHAR(128) NOT NULL, status VARCHAR(32) NOT NULL, due_at VARCHAR(32) NOT NULL, exclude_from_report INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL, created_at VARCHAR(32) NOT NULL DEFAULT \'\', updated_at VARCHAR(32) NOT NULL DEFAULT \'\')');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS collaboration_bugs (id INTEGER PRIMARY KEY AUTOINCREMENT, status VARCHAR(32) NOT NULL, link_type VARCHAR(32) NOT NULL, link_id INTEGER NOT NULL DEFAULT 0, owner_name VARCHAR(128) NOT NULL, reporter_name VARCHAR(128) NOT NULL, submitted_at VARCHAR(32) DEFAULT NULL, payload_json TEXT NOT NULL, created_at VARCHAR(32) NOT NULL DEFAULT \'\', updated_at VARCHAR(32) NOT NULL DEFAULT \'\')');
        $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_collaboration_bugs_link ON collaboration_bugs(link_type, link_id)');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS collaboration_requirement_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, requirement_id INTEGER NOT NULL DEFAULT 0, reviewed_at VARCHAR(32) NOT NULL, payload_json TEXT NOT NULL, created_at VARCHAR(32) NOT NULL DEFAULT \'\', updated_at VARCHAR(32) NOT NULL DEFAULT \'\')');
        $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_collaboration_requirement_reviews_requirement ON collaboration_requirement_reviews(requirement_id)');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS collaboration_requirement_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, requirement_id INTEGER NOT NULL DEFAULT 0, file_type VARCHAR(32) NOT NULL, uploaded_at VARCHAR(32) NOT NULL, payload_json TEXT NOT NULL, created_at VARCHAR(32) NOT NULL DEFAULT \'\', updated_at VARCHAR(32) NOT NULL DEFAULT \'\')');
        $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_collaboration_requirement_attachments_requirement ON collaboration_requirement_attachments(requirement_id)');
    }

    private function normalizeStringList(mixed $items): array
    {
        if (is_string($items)) {
            $items = preg_split('/\r?\n/', $items) ?: [];
        }
        if (!is_array($items)) {
            return [];
        }
        return array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $items), static fn (string $item): bool => $item !== ''));
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }
}