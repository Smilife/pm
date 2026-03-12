<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use Throwable;

final class JsonStore
{
    private const IDENTITY_COLLECTIONS = ['users', 'roles'];

    private const DELIVERY_COLLECTIONS = ['projects', 'requirements', 'executions', 'tasks'];

    private static ?bool $databaseAvailable = null;

    private static ?PDO $pdo = null;

    private static ?string $databaseError = null;

    private string $storagePath;

    private ?IdentityStore $identityStore = null;

    private ?DeliveryStore $deliveryStore = null;

    public function __construct(?string $storagePath = null)
    {
        $this->storagePath = $storagePath ?? dirname(__DIR__, 2) . '/storage/data';
    }

    public function all(string $name): array
    {
        if ($this->usesDatabase()) {
            if ($this->usesDedicatedCollection($name)) {
                return $this->allFromDedicatedCollection($name);
            }

            return $this->readFromDatabase($name);
        }

        return $this->readFromFile($name);
    }

    public function find(string $name, int $id): ?array
    {
        if ($this->usesDatabase()) {
            if ($this->usesDedicatedCollection($name)) {
                return $this->findFromDedicatedCollection($name, $id);
            }

            return $this->findFromDatabase($name, $id);
        }

        foreach ($this->readFromFile($name) as $item) {
            if ((int) ($item['id'] ?? 0) === $id) {
                return $item;
            }
        }

        return null;
    }

    public function filter(string $name, callable $callback): array
    {
        return array_values(array_filter($this->all($name), $callback));
    }

    public function create(string $name, array $payload): array
    {
        if ($this->usesDatabase()) {
            if ($this->usesDedicatedCollection($name)) {
                return $this->createInDedicatedCollection($name, $payload);
            }

            return $this->createInDatabase($name, $payload);
        }

        $items = $this->readFromFile($name);
        $payload['id'] = $this->nextIdFromItems($items);
        $items[] = $payload;
        $this->writeToFile($name, $items);

        return $payload;
    }

    public function update(string $name, int $id, array $payload): ?array
    {
        if ($this->usesDatabase()) {
            if ($this->usesDedicatedCollection($name)) {
                return $this->updateInDedicatedCollection($name, $id, $payload);
            }

            return $this->updateInDatabase($name, $id, $payload);
        }

        $items = $this->readFromFile($name);

        foreach ($items as $index => $item) {
            if ((int) ($item['id'] ?? 0) !== $id) {
                continue;
            }

            $items[$index] = array_merge($item, $payload, ['id' => $id]);
            $this->writeToFile($name, $items);

            return $items[$index];
        }

        return null;
    }

    public function replaceAll(string $name, array $items): void
    {
        if ($this->usesDatabase()) {
            if ($this->usesDedicatedCollection($name)) {
                $this->replaceAllInDedicatedCollection($name, $items);
                return;
            }

            $this->replaceAllInDatabase($name, $items);
            return;
        }

        $this->writeToFile($name, $items);
    }

    public function delete(string $name, int $id): ?array
    {
        if ($this->usesDatabase()) {
            if ($this->usesDedicatedCollection($name)) {
                return $this->deleteFromDedicatedCollection($name, $id);
            }

            return $this->deleteFromDatabase($name, $id);
        }

        $items = $this->readFromFile($name);

        foreach ($items as $index => $item) {
            if ((int) ($item['id'] ?? 0) !== $id) {
                continue;
            }

            $deleted = $item;
            array_splice($items, $index, 1);
            $this->writeToFile($name, array_values($items));

            return $deleted;
        }

        return null;
    }

    public function diagnostics(array $collections = []): array
    {
        $connection = $this->currentConnection();
        $driver = (string) ($connection['type'] ?? 'sqlite');
        $usesDatabase = $this->usesDatabase();

        if ($collections === []) {
            $collections = $this->defaultCollections();
        }

        $collectionCounts = [];
        foreach ($collections as $collection) {
            $collectionCounts[$collection] = count($this->all($collection));
        }

        $diagnostics = [
            'mode' => $usesDatabase ? 'database' : 'file',
            'preferred_driver' => $driver,
            'database_available' => $usesDatabase,
            'database_error' => self::$databaseError,
            'storage_path' => $this->storagePath,
            'collection_counts' => $collectionCounts,
        ];

        if ($driver === 'mysql') {
            $diagnostics['database'] = [
                'driver' => 'mysql',
                'host' => (string) ($connection['hostname'] ?? '127.0.0.1'),
                'port' => (int) ($connection['hostport'] ?? 3306),
                'name' => (string) ($connection['database'] ?? 'pm'),
            ];
        } else {
            $sqlitePath = (string) ($connection['database'] ?? (dirname(__DIR__, 2) . '/storage/framework/thinkphp.sqlite'));
            $diagnostics['database'] = [
                'driver' => 'sqlite',
                'path' => $sqlitePath,
                'exists' => file_exists($sqlitePath),
            ];
        }

        if ($usesDatabase) {
            $diagnostics['database_record_count'] = $this->databaseRecordCount();
            $diagnostics['identity_tables'] = $this->identityStore()->diagnostics();
            $diagnostics['delivery_tables'] = $this->deliveryStore()->diagnostics();
        }

        return $diagnostics;
    }

    private function usesDatabase(): bool
    {
        if (self::$databaseAvailable !== null) {
            return self::$databaseAvailable;
        }

        self::$databaseAvailable = $this->bootstrapDatabase();

        return self::$databaseAvailable;
    }

    private function bootstrapDatabase(): bool
    {
        $connection = $this->currentConnection();
        $driver = (string) ($connection['type'] ?? 'sqlite');
        self::$databaseError = null;

        if ($driver === 'sqlite' && !extension_loaded('pdo_sqlite')) {
            self::$databaseError = 'missing_pdo_sqlite_extension';
            return false;
        }

        if ($driver === 'mysql' && !extension_loaded('pdo_mysql')) {
            self::$databaseError = 'missing_pdo_mysql_extension';
            return false;
        }

        try {
            self::$pdo = $this->createPdo($connection);
            $this->ensureSchema(self::$pdo, $driver);
            $this->importJsonFilesIfNeeded(self::$pdo);
            $this->identityStore($driver)->ensureSchema();
            $this->identityStore($driver)->importIfNeeded();
            $this->deliveryStore($driver)->ensureSchema();
            $this->deliveryStore($driver)->importIfNeeded();

            return true;
        } catch (Throwable $exception) {
            self::$pdo = null;
            $this->identityStore = null;
            $this->deliveryStore = null;
            self::$databaseError = $exception->getMessage();
            return false;
        }
    }

    private function currentConnection(): array
    {
        $config = require dirname(__DIR__, 2) . '/config/database.php';
        $defaultConnection = (string) ($config['default'] ?? 'sqlite');
        $connections = is_array($config['connections'] ?? null) ? $config['connections'] : [];

        $connection = $connections[$defaultConnection] ?? $connections['sqlite'] ?? [];

        return is_array($connection) ? $connection : [];
    }

    private function createPdo(array $connection): PDO
    {
        $driver = (string) ($connection['type'] ?? 'sqlite');
        if ($driver === 'mysql') {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                (string) ($connection['hostname'] ?? '127.0.0.1'),
                (int) ($connection['hostport'] ?? 3306),
                (string) ($connection['database'] ?? 'pm'),
                (string) ($connection['charset'] ?? 'utf8mb4')
            );

            return new PDO(
                $dsn,
                (string) ($connection['username'] ?? 'root'),
                (string) ($connection['password'] ?? ''),
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        }

        $databaseFile = (string) ($connection['database'] ?? (dirname(__DIR__, 2) . '/storage/framework/thinkphp.sqlite'));
        $directory = dirname($databaseFile);
        if (!is_dir($directory)) {
            mkdir($directory, 0777, true);
        }

        return new PDO(
            'sqlite:' . $databaseFile,
            null,
            null,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }

    private function ensureSchema(PDO $pdo, string $driver): void
    {
        if ($driver === 'mysql') {
            $pdo->exec(
                'CREATE TABLE IF NOT EXISTS `data_records` (' .
                '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,' .
                '`collection` VARCHAR(64) NOT NULL,' .
                '`record_id` INT UNSIGNED NOT NULL,' .
                '`payload` LONGTEXT NOT NULL,' .
                '`created_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                '`updated_at` VARCHAR(32) NOT NULL DEFAULT \'\',' .
                'PRIMARY KEY (`id`),' .
                'UNIQUE KEY `uniq_collection_record` (`collection`, `record_id`),' .
                'KEY `idx_collection` (`collection`)' .
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );

            return;
        }

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS data_records (' .
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' .
            'collection VARCHAR(64) NOT NULL,' .
            'record_id INTEGER NOT NULL,' .
            'payload TEXT NOT NULL,' .
            'created_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'updated_at VARCHAR(32) NOT NULL DEFAULT \'\',' .
            'UNIQUE(collection, record_id)' .
            ')'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_data_records_collection ON data_records(collection)');
    }

    private function importJsonFilesIfNeeded(PDO $pdo): void
    {
        $count = (int) $pdo->query('SELECT COUNT(*) FROM data_records')->fetchColumn();
        if ($count > 0) {
            return;
        }

        $files = glob($this->storagePath . '/*.json') ?: [];
        if ($files === []) {
            return;
        }

        $insert = $pdo->prepare(
            'INSERT INTO data_records (collection, record_id, payload, created_at, updated_at) VALUES (:collection, :record_id, :payload, :created_at, :updated_at)'
        );

        $pdo->beginTransaction();
        try {
            foreach ($files as $file) {
                $collection = pathinfo($file, PATHINFO_FILENAME);
                foreach ($this->readFromFile($collection) as $item) {
                    $recordId = (int) ($item['id'] ?? 0);
                    if ($recordId <= 0) {
                        continue;
                    }

                    $timestamp = date('c');
                    $insert->execute([
                        ':collection' => $collection,
                        ':record_id' => $recordId,
                        ':payload' => $this->encodePayload($item),
                        ':created_at' => $timestamp,
                        ':updated_at' => $timestamp,
                    ]);
                }
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    private function readFromDatabase(string $name): array
    {
        $statement = $this->pdo()->prepare('SELECT record_id, payload FROM data_records WHERE collection = :collection ORDER BY record_id ASC');
        $statement->execute([':collection' => $name]);

        $items = [];
        foreach ($statement->fetchAll() as $row) {
            $items[] = $this->decodePayload((string) ($row['payload'] ?? '{}'), (int) ($row['record_id'] ?? 0));
        }

        return $items;
    }

    private function findFromDatabase(string $name, int $id): ?array
    {
        $statement = $this->pdo()->prepare('SELECT record_id, payload FROM data_records WHERE collection = :collection AND record_id = :record_id LIMIT 1');
        $statement->execute([
            ':collection' => $name,
            ':record_id' => $id,
        ]);

        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        return $this->decodePayload((string) ($row['payload'] ?? '{}'), (int) ($row['record_id'] ?? 0));
    }

    private function createInDatabase(string $name, array $payload): array
    {
        $pdo = $this->pdo();
        $pdo->beginTransaction();

        try {
            $payload['id'] = $this->nextIdFromDatabase($name, $pdo);
            $timestamp = date('c');
            $statement = $pdo->prepare(
                'INSERT INTO data_records (collection, record_id, payload, created_at, updated_at) VALUES (:collection, :record_id, :payload, :created_at, :updated_at)'
            );
            $statement->execute([
                ':collection' => $name,
                ':record_id' => (int) $payload['id'],
                ':payload' => $this->encodePayload($payload),
                ':created_at' => $timestamp,
                ':updated_at' => $timestamp,
            ]);
            $pdo->commit();

            return $payload;
        } catch (Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    private function updateInDatabase(string $name, int $id, array $payload): ?array
    {
        $current = $this->findFromDatabase($name, $id);
        if ($current === null) {
            return null;
        }

        $updated = array_merge($current, $payload, ['id' => $id]);
        $statement = $this->pdo()->prepare(
            'UPDATE data_records SET payload = :payload, updated_at = :updated_at WHERE collection = :collection AND record_id = :record_id'
        );
        $statement->execute([
            ':payload' => $this->encodePayload($updated),
            ':updated_at' => date('c'),
            ':collection' => $name,
            ':record_id' => $id,
        ]);

        return $updated;
    }

    private function replaceAllInDatabase(string $name, array $items): void
    {
        $pdo = $this->pdo();
        $pdo->beginTransaction();

        try {
            $delete = $pdo->prepare('DELETE FROM data_records WHERE collection = :collection');
            $delete->execute([':collection' => $name]);

            $insert = $pdo->prepare(
                'INSERT INTO data_records (collection, record_id, payload, created_at, updated_at) VALUES (:collection, :record_id, :payload, :created_at, :updated_at)'
            );

            $nextId = 1;
            foreach ($items as $item) {
                $recordId = (int) ($item['id'] ?? 0);
                if ($recordId <= 0) {
                    $recordId = $nextId;
                    $item['id'] = $recordId;
                }
                $nextId = max($nextId, $recordId + 1);

                $timestamp = date('c');
                $insert->execute([
                    ':collection' => $name,
                    ':record_id' => $recordId,
                    ':payload' => $this->encodePayload($item),
                    ':created_at' => $timestamp,
                    ':updated_at' => $timestamp,
                ]);
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    private function deleteFromDatabase(string $name, int $id): ?array
    {
        $current = $this->findFromDatabase($name, $id);
        if ($current === null) {
            return null;
        }

        $statement = $this->pdo()->prepare('DELETE FROM data_records WHERE collection = :collection AND record_id = :record_id');
        $statement->execute([
            ':collection' => $name,
            ':record_id' => $id,
        ]);

        return $current;
    }

    private function allFromDedicatedCollection(string $name): array
    {
        return match ($name) {
            'users' => $this->identityStore()->allUsers(),
            'roles' => $this->identityStore()->allRoles(),
            'projects' => $this->deliveryStore()->allProjects(),
            'requirements' => $this->deliveryStore()->allRequirements(),
            'executions' => $this->deliveryStore()->allExecutions(),
            'tasks' => $this->deliveryStore()->allTasks(),
            default => [],
        };
    }

    private function findFromDedicatedCollection(string $name, int $id): ?array
    {
        return match ($name) {
            'users' => $this->identityStore()->findUser($id),
            'roles' => $this->identityStore()->findRole($id),
            'projects' => $this->deliveryStore()->findProject($id),
            'requirements' => $this->deliveryStore()->findRequirement($id),
            'executions' => $this->deliveryStore()->findExecution($id),
            'tasks' => $this->deliveryStore()->findTask($id),
            default => null,
        };
    }

    private function createInDedicatedCollection(string $name, array $payload): array
    {
        return match ($name) {
            'users' => $this->identityStore()->createUser($payload),
            'roles' => $this->identityStore()->createRole($payload),
            'projects' => $this->deliveryStore()->createProject($payload),
            'requirements' => $this->deliveryStore()->createRequirement($payload),
            'executions' => $this->deliveryStore()->createExecution($payload),
            'tasks' => $this->deliveryStore()->createTask($payload),
            default => $payload,
        };
    }

    private function updateInDedicatedCollection(string $name, int $id, array $payload): ?array
    {
        return match ($name) {
            'users' => $this->identityStore()->updateUser($id, $payload),
            'roles' => $this->identityStore()->updateRole($id, $payload),
            'projects' => $this->deliveryStore()->updateProject($id, $payload),
            'requirements' => $this->deliveryStore()->updateRequirement($id, $payload),
            'executions' => $this->deliveryStore()->updateExecution($id, $payload),
            'tasks' => $this->deliveryStore()->updateTask($id, $payload),
            default => null,
        };
    }

    private function replaceAllInDedicatedCollection(string $name, array $items): void
    {
        match ($name) {
            'users' => $this->identityStore()->replaceAllUsers($items),
            'projects' => $this->deliveryStore()->replaceAllProjects($items),
            'requirements' => $this->deliveryStore()->replaceAllRequirements($items),
            'executions' => $this->deliveryStore()->replaceAllExecutions($items),
            'tasks' => $this->deliveryStore()->replaceAllTasks($items),
            default => null,
        };
    }

    private function deleteFromDedicatedCollection(string $name, int $id): ?array
    {
        return match ($name) {
            'roles' => $this->identityStore()->deleteRole($id),
            'projects' => $this->deliveryStore()->deleteProject($id),
            'requirements' => $this->deliveryStore()->deleteRequirement($id),
            'executions' => $this->deliveryStore()->deleteExecution($id),
            'tasks' => $this->deliveryStore()->deleteTask($id),
            default => null,
        };
    }

    private function usesDedicatedCollection(string $name): bool
    {
        return in_array($name, self::IDENTITY_COLLECTIONS, true) || in_array($name, self::DELIVERY_COLLECTIONS, true);
    }

    private function deliveryStore(?string $driver = null): DeliveryStore
    {
        if ($this->deliveryStore instanceof DeliveryStore) {
            return $this->deliveryStore;
        }

        $this->deliveryStore = new DeliveryStore(
            $this->pdo(),
            $driver ?? (string) ($this->currentConnection()['type'] ?? 'sqlite'),
            $this->storagePath,
        );

        return $this->deliveryStore;
    }

    private function identityStore(?string $driver = null): IdentityStore
    {
        if ($this->identityStore instanceof IdentityStore) {
            return $this->identityStore;
        }

        $this->identityStore = new IdentityStore(
            $this->pdo(),
            $driver ?? (string) ($this->currentConnection()['type'] ?? 'sqlite'),
            $this->storagePath,
        );

        return $this->identityStore;
    }

    private function nextIdFromDatabase(string $name, PDO $pdo): int
    {
        $statement = $pdo->prepare('SELECT MAX(record_id) FROM data_records WHERE collection = :collection');
        $statement->execute([':collection' => $name]);
        $currentMax = (int) $statement->fetchColumn();

        return $currentMax > 0 ? $currentMax + 1 : 1;
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

    private function readFromFile(string $name): array
    {
        $file = $this->filePath($name);

        if (!file_exists($file)) {
            return [];
        }

        $content = file_get_contents($file) ?: '[]';
        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function writeToFile(string $name, array $items): void
    {
        file_put_contents($this->filePath($name), json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private function filePath(string $name): string
    {
        return $this->storagePath . '/' . $name . '.json';
    }

    private function nextIdFromItems(array $items): int
    {
        $ids = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items);

        return $ids ? max($ids) + 1 : 1;
    }

    private function databaseRecordCount(): int
    {
        return (int) $this->pdo()->query('SELECT COUNT(*) FROM data_records')->fetchColumn();
    }

    private function defaultCollections(): array
    {
        $files = glob($this->storagePath . '/*.json') ?: [];
        $collections = array_map(
            static fn (string $file): string => pathinfo($file, PATHINFO_FILENAME),
            $files
        );

        sort($collections);

        return array_values(array_unique($collections));
    }

    private function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        throw new \RuntimeException('database_not_initialized');
    }
}