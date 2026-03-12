<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use Throwable;

final class JsonStore
{
    private const IDENTITY_COLLECTIONS = ['users', 'roles'];

    private const DELIVERY_COLLECTIONS = ['projects', 'requirements', 'executions', 'tasks'];

    private const COLLABORATION_COLLECTIONS = ['worklogs', 'daily_tasks', 'bugs', 'requirement_reviews', 'requirement_attachments'];

    private const SETTINGS_COLLECTIONS = ['policies', 'dictionaries', 'workflows'];

    private static ?bool $databaseAvailable = null;

    private static ?PDO $pdo = null;

    private static ?string $databaseError = null;

    private string $storagePath;

    private ?IdentityStore $identityStore = null;

    private ?DeliveryStore $deliveryStore = null;

    private ?CollaborationStore $collaborationStore = null;

    private ?SettingsStore $settingsStore = null;

    public function __construct(?string $storagePath = null)
    {
        $this->storagePath = $storagePath ?? dirname(__DIR__, 2) . '/storage/data';
    }

    public function all(string $name): array
    {
        if ($this->usesDatabase() && $this->usesDedicatedCollection($name)) {
            return $this->allFromDedicatedCollection($name);
        }

        return $this->readFromFile($name);
    }

    public function find(string $name, int $id): ?array
    {
        if ($this->usesDatabase() && $this->usesDedicatedCollection($name)) {
            return $this->findFromDedicatedCollection($name, $id);
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
        if ($this->usesDatabase() && $this->usesDedicatedCollection($name)) {
            return $this->createInDedicatedCollection($name, $payload);
        }

        $items = $this->readFromFile($name);
        $payload['id'] = $this->nextIdFromItems($items);
        $items[] = $payload;
        $this->writeToFile($name, $items);

        return $payload;
    }

    public function update(string $name, int $id, array $payload): ?array
    {
        if ($this->usesDatabase() && $this->usesDedicatedCollection($name)) {
            return $this->updateInDedicatedCollection($name, $id, $payload);
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
        if ($this->usesDatabase() && $this->usesDedicatedCollection($name)) {
            $this->replaceAllInDedicatedCollection($name, $items);
            return;
        }

        $this->writeToFile($name, $items);
    }

    public function delete(string $name, int $id): ?array
    {
        if ($this->usesDatabase() && $this->usesDedicatedCollection($name)) {
            return $this->deleteFromDedicatedCollection($name, $id);
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
            $diagnostics['identity_tables'] = $this->identityStore()->diagnostics();
            $diagnostics['delivery_tables'] = $this->deliveryStore()->diagnostics();
            $diagnostics['collaboration_tables'] = $this->collaborationStore()->diagnostics();
            $diagnostics['settings_tables'] = $this->settingsStore()->diagnostics();
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
            $this->identityStore($driver)->ensureSchema();
            $this->identityStore($driver)->importIfNeeded();
            $this->deliveryStore($driver)->ensureSchema();
            $this->deliveryStore($driver)->importIfNeeded();
            $this->collaborationStore($driver)->ensureSchema();
            $this->collaborationStore($driver)->importIfNeeded();
            $this->settingsStore($driver)->ensureSchema();
            $this->settingsStore($driver)->importIfNeeded();

            return true;
        } catch (Throwable $exception) {
            self::$pdo = null;
            $this->identityStore = null;
            $this->deliveryStore = null;
            $this->collaborationStore = null;
            $this->settingsStore = null;
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

    private function allFromDedicatedCollection(string $name): array
    {
        return match ($name) {
            'users' => $this->identityStore()->allUsers(),
            'roles' => $this->identityStore()->allRoles(),
            'projects' => $this->deliveryStore()->allProjects(),
            'requirements' => $this->deliveryStore()->allRequirements(),
            'executions' => $this->deliveryStore()->allExecutions(),
            'tasks' => $this->deliveryStore()->allTasks(),
            'worklogs' => $this->collaborationStore()->allWorklogs(),
            'daily_tasks' => $this->collaborationStore()->allDailyTasks(),
            'bugs' => $this->collaborationStore()->allBugs(),
            'requirement_reviews' => $this->collaborationStore()->allRequirementReviews(),
            'requirement_attachments' => $this->collaborationStore()->allRequirementAttachments(),
            'policies' => $this->settingsStore()->allPolicies(),
            'dictionaries' => $this->settingsStore()->allDictionaries(),
            'workflows' => $this->settingsStore()->allWorkflows(),
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
            'worklogs' => $this->collaborationStore()->findWorklog($id),
            'daily_tasks' => $this->collaborationStore()->findDailyTask($id),
            'bugs' => $this->collaborationStore()->findBug($id),
            'requirement_reviews' => $this->collaborationStore()->findRequirementReview($id),
            'requirement_attachments' => $this->collaborationStore()->findRequirementAttachment($id),
            'policies' => $this->settingsStore()->findPolicy($id),
            'dictionaries' => $this->settingsStore()->findDictionary($id),
            'workflows' => $this->settingsStore()->findWorkflow($id),
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
            'worklogs' => $this->collaborationStore()->createWorklog($payload),
            'daily_tasks' => $this->collaborationStore()->createDailyTask($payload),
            'bugs' => $this->collaborationStore()->createBug($payload),
            'requirement_reviews' => $this->collaborationStore()->createRequirementReview($payload),
            'requirement_attachments' => $this->collaborationStore()->createRequirementAttachment($payload),
            'policies' => $this->settingsStore()->createPolicy($payload),
            'dictionaries' => $this->settingsStore()->createDictionary($payload),
            'workflows' => $this->settingsStore()->createWorkflow($payload),
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
            'worklogs' => $this->collaborationStore()->updateWorklog($id, $payload),
            'daily_tasks' => $this->collaborationStore()->updateDailyTask($id, $payload),
            'bugs' => $this->collaborationStore()->updateBug($id, $payload),
            'requirement_reviews' => $this->collaborationStore()->updateRequirementReview($id, $payload),
            'requirement_attachments' => $this->collaborationStore()->updateRequirementAttachment($id, $payload),
            'policies' => $this->settingsStore()->updatePolicy($id, $payload),
            'dictionaries' => $this->settingsStore()->updateDictionary($id, $payload),
            'workflows' => $this->settingsStore()->updateWorkflow($id, $payload),
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
            'worklogs' => $this->collaborationStore()->replaceAllWorklogs($items),
            'daily_tasks' => $this->collaborationStore()->replaceAllDailyTasks($items),
            'bugs' => $this->collaborationStore()->replaceAllBugs($items),
            'requirement_reviews' => $this->collaborationStore()->replaceAllRequirementReviews($items),
            'requirement_attachments' => $this->collaborationStore()->replaceAllRequirementAttachments($items),
            'policies' => $this->settingsStore()->replaceAllPolicies($items),
            'dictionaries' => $this->settingsStore()->replaceAllDictionaries($items),
            'workflows' => $this->settingsStore()->replaceAllWorkflows($items),
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
            'worklogs' => $this->collaborationStore()->deleteWorklog($id),
            'daily_tasks' => $this->collaborationStore()->deleteDailyTask($id),
            'bugs' => $this->collaborationStore()->deleteBug($id),
            'requirement_reviews' => $this->collaborationStore()->deleteRequirementReview($id),
            'requirement_attachments' => $this->collaborationStore()->deleteRequirementAttachment($id),
            'policies' => $this->settingsStore()->deletePolicy($id),
            'dictionaries' => $this->settingsStore()->deleteDictionary($id),
            'workflows' => $this->settingsStore()->deleteWorkflow($id),
            default => null,
        };
    }

    private function usesDedicatedCollection(string $name): bool
    {
        return in_array($name, self::IDENTITY_COLLECTIONS, true)
            || in_array($name, self::DELIVERY_COLLECTIONS, true)
            || in_array($name, self::COLLABORATION_COLLECTIONS, true)
            || in_array($name, self::SETTINGS_COLLECTIONS, true);
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

    private function collaborationStore(?string $driver = null): CollaborationStore
    {
        if ($this->collaborationStore instanceof CollaborationStore) {
            return $this->collaborationStore;
        }

        $this->collaborationStore = new CollaborationStore(
            $this->pdo(),
            $driver ?? (string) ($this->currentConnection()['type'] ?? 'sqlite'),
            $this->storagePath,
        );

        return $this->collaborationStore;
    }

    private function settingsStore(?string $driver = null): SettingsStore
    {
        if ($this->settingsStore instanceof SettingsStore) {
            return $this->settingsStore;
        }

        $this->settingsStore = new SettingsStore(
            $this->pdo(),
            $driver ?? (string) ($this->currentConnection()['type'] ?? 'sqlite'),
            $this->storagePath,
        );

        return $this->settingsStore;
    }

    private function identityStore(?string $driver = null): IdentityStore
    {
        if ($this->identityStore instanceof IdentityStore) {
            return $this->identityStore;
        }

        $this->identityStore = new IdentityStore(
            $driver ?? (string) ($this->currentConnection()['type'] ?? 'sqlite'),
            $this->storagePath,
        );

        return $this->identityStore;
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

    private function defaultCollections(): array
    {
        $files = glob($this->storagePath . '/*.json') ?: [];
        $collections = array_merge(
            self::IDENTITY_COLLECTIONS,
            self::DELIVERY_COLLECTIONS,
            self::COLLABORATION_COLLECTIONS,
            self::SETTINGS_COLLECTIONS,
            array_map(
                static fn (string $file): string => pathinfo($file, PATHINFO_FILENAME),
                $files
            )
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
