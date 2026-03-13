<?php

declare(strict_types=1);

namespace App\Support;

use Throwable;

final class StoreRegistry
{
    private static ?bool $databaseAvailable = null;

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

    public function allUsers(): array { $this->ensureReady(); return $this->identityStore()->allUsers(); }
    public function findUser(int $id): ?array { $this->ensureReady(); return $this->identityStore()->findUser($id); }
    public function createUser(array $payload): array { $this->ensureReady(); return $this->identityStore()->createUser($payload); }
    public function updateUser(int $id, array $payload): ?array { $this->ensureReady(); return $this->identityStore()->updateUser($id, $payload); }
    public function replaceAllUsers(array $items): void { $this->ensureReady(); $this->identityStore()->replaceAllUsers($items); }

    public function allRoles(): array { $this->ensureReady(); return $this->identityStore()->allRoles(); }
    public function findRole(int $id): ?array { $this->ensureReady(); return $this->identityStore()->findRole($id); }
    public function createRole(array $payload): array { $this->ensureReady(); return $this->identityStore()->createRole($payload); }
    public function updateRole(int $id, array $payload): ?array { $this->ensureReady(); return $this->identityStore()->updateRole($id, $payload); }
    public function deleteRole(int $id): ?array { $this->ensureReady(); return $this->identityStore()->deleteRole($id); }
    public function roleUserCount(string $roleKey): int { $this->ensureReady(); return $this->identityStore()->roleUserCount($roleKey); }
    public function emailExists(string $email, ?int $excludeId = null): bool { $this->ensureReady(); return $this->identityStore()->emailExists($email, $excludeId); }
    public function roleKeyExists(string $roleKey, ?int $excludeId = null): bool { $this->ensureReady(); return $this->identityStore()->roleKeyExists($roleKey, $excludeId); }
    public function roleKeys(): array { $this->ensureReady(); return $this->identityStore()->roleKeys(); }
    public function permissionsForRoles(array $roleKeys): array { $this->ensureReady(); return $this->identityStore()->permissionsForRoles($roleKeys); }

    public function allProjects(): array { $this->ensureReady(); return $this->deliveryStore()->allProjects(); }
    public function findProject(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->findProject($id); }
    public function createProject(array $payload): array { $this->ensureReady(); return $this->deliveryStore()->createProject($payload); }
    public function updateProject(int $id, array $payload): ?array { $this->ensureReady(); return $this->deliveryStore()->updateProject($id, $payload); }
    public function replaceAllProjects(array $items): void { $this->ensureReady(); $this->deliveryStore()->replaceAllProjects($items); }
    public function deleteProject(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->deleteProject($id); }

    public function allRequirements(): array { $this->ensureReady(); return $this->deliveryStore()->allRequirements(); }
    public function findRequirement(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->findRequirement($id); }
    public function createRequirement(array $payload): array { $this->ensureReady(); return $this->deliveryStore()->createRequirement($payload); }
    public function updateRequirement(int $id, array $payload): ?array { $this->ensureReady(); return $this->deliveryStore()->updateRequirement($id, $payload); }
    public function replaceAllRequirements(array $items): void { $this->ensureReady(); $this->deliveryStore()->replaceAllRequirements($items); }
    public function deleteRequirement(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->deleteRequirement($id); }

    public function allExecutions(): array { $this->ensureReady(); return $this->deliveryStore()->allExecutions(); }
    public function findExecution(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->findExecution($id); }
    public function createExecution(array $payload): array { $this->ensureReady(); return $this->deliveryStore()->createExecution($payload); }
    public function updateExecution(int $id, array $payload): ?array { $this->ensureReady(); return $this->deliveryStore()->updateExecution($id, $payload); }
    public function replaceAllExecutions(array $items): void { $this->ensureReady(); $this->deliveryStore()->replaceAllExecutions($items); }
    public function deleteExecution(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->deleteExecution($id); }

    public function allTasks(): array { $this->ensureReady(); return $this->deliveryStore()->allTasks(); }
    public function findTask(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->findTask($id); }
    public function createTask(array $payload): array { $this->ensureReady(); return $this->deliveryStore()->createTask($payload); }
    public function updateTask(int $id, array $payload): ?array { $this->ensureReady(); return $this->deliveryStore()->updateTask($id, $payload); }
    public function replaceAllTasks(array $items): void { $this->ensureReady(); $this->deliveryStore()->replaceAllTasks($items); }
    public function deleteTask(int $id): ?array { $this->ensureReady(); return $this->deliveryStore()->deleteTask($id); }

    public function allWorklogs(): array { $this->ensureReady(); return $this->collaborationStore()->allWorklogs(); }
    public function findWorklog(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->findWorklog($id); }
    public function createWorklog(array $payload): array { $this->ensureReady(); return $this->collaborationStore()->createWorklog($payload); }
    public function updateWorklog(int $id, array $payload): ?array { $this->ensureReady(); return $this->collaborationStore()->updateWorklog($id, $payload); }
    public function replaceAllWorklogs(array $items): void { $this->ensureReady(); $this->collaborationStore()->replaceAllWorklogs($items); }
    public function deleteWorklog(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->deleteWorklog($id); }

    public function allDailyTasks(): array { $this->ensureReady(); return $this->collaborationStore()->allDailyTasks(); }
    public function findDailyTask(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->findDailyTask($id); }
    public function createDailyTask(array $payload): array { $this->ensureReady(); return $this->collaborationStore()->createDailyTask($payload); }
    public function updateDailyTask(int $id, array $payload): ?array { $this->ensureReady(); return $this->collaborationStore()->updateDailyTask($id, $payload); }
    public function replaceAllDailyTasks(array $items): void { $this->ensureReady(); $this->collaborationStore()->replaceAllDailyTasks($items); }
    public function deleteDailyTask(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->deleteDailyTask($id); }

    public function allBugs(): array { $this->ensureReady(); return $this->collaborationStore()->allBugs(); }
    public function findBug(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->findBug($id); }
    public function createBug(array $payload): array { $this->ensureReady(); return $this->collaborationStore()->createBug($payload); }
    public function updateBug(int $id, array $payload): ?array { $this->ensureReady(); return $this->collaborationStore()->updateBug($id, $payload); }
    public function replaceAllBugs(array $items): void { $this->ensureReady(); $this->collaborationStore()->replaceAllBugs($items); }
    public function deleteBug(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->deleteBug($id); }

    public function allRequirementReviews(): array { $this->ensureReady(); return $this->collaborationStore()->allRequirementReviews(); }
    public function findRequirementReview(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->findRequirementReview($id); }
    public function createRequirementReview(array $payload): array { $this->ensureReady(); return $this->collaborationStore()->createRequirementReview($payload); }
    public function updateRequirementReview(int $id, array $payload): ?array { $this->ensureReady(); return $this->collaborationStore()->updateRequirementReview($id, $payload); }
    public function replaceAllRequirementReviews(array $items): void { $this->ensureReady(); $this->collaborationStore()->replaceAllRequirementReviews($items); }
    public function deleteRequirementReview(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->deleteRequirementReview($id); }

    public function allRequirementAttachments(): array { $this->ensureReady(); return $this->collaborationStore()->allRequirementAttachments(); }
    public function findRequirementAttachment(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->findRequirementAttachment($id); }
    public function createRequirementAttachment(array $payload): array { $this->ensureReady(); return $this->collaborationStore()->createRequirementAttachment($payload); }
    public function updateRequirementAttachment(int $id, array $payload): ?array { $this->ensureReady(); return $this->collaborationStore()->updateRequirementAttachment($id, $payload); }
    public function replaceAllRequirementAttachments(array $items): void { $this->ensureReady(); $this->collaborationStore()->replaceAllRequirementAttachments($items); }
    public function deleteRequirementAttachment(int $id): ?array { $this->ensureReady(); return $this->collaborationStore()->deleteRequirementAttachment($id); }

    public function allPolicies(): array { $this->ensureReady(); return $this->settingsStore()->allPolicies(); }
    public function findPolicy(int $id): ?array { $this->ensureReady(); return $this->settingsStore()->findPolicy($id); }
    public function createPolicy(array $payload): array { $this->ensureReady(); return $this->settingsStore()->createPolicy($payload); }
    public function updatePolicy(int $id, array $payload): ?array { $this->ensureReady(); return $this->settingsStore()->updatePolicy($id, $payload); }
    public function deletePolicy(int $id): ?array { $this->ensureReady(); return $this->settingsStore()->deletePolicy($id); }

    public function allDictionaries(): array { $this->ensureReady(); return $this->settingsStore()->allDictionaries(); }
    public function findDictionary(int $id): ?array { $this->ensureReady(); return $this->settingsStore()->findDictionary($id); }
    public function createDictionary(array $payload): array { $this->ensureReady(); return $this->settingsStore()->createDictionary($payload); }
    public function updateDictionary(int $id, array $payload): ?array { $this->ensureReady(); return $this->settingsStore()->updateDictionary($id, $payload); }
    public function deleteDictionary(int $id): ?array { $this->ensureReady(); return $this->settingsStore()->deleteDictionary($id); }

    public function allWorkflows(): array { $this->ensureReady(); return $this->settingsStore()->allWorkflows(); }
    public function findWorkflow(int $id): ?array { $this->ensureReady(); return $this->settingsStore()->findWorkflow($id); }
    public function createWorkflow(array $payload): array { $this->ensureReady(); return $this->settingsStore()->createWorkflow($payload); }
    public function updateWorkflow(int $id, array $payload): ?array { $this->ensureReady(); return $this->settingsStore()->updateWorkflow($id, $payload); }
    public function deleteWorkflow(int $id): ?array { $this->ensureReady(); return $this->settingsStore()->deleteWorkflow($id); }

    public function diagnostics(): array
    {
        $this->ensureReady();
        $connection = $this->currentConnection();
        $driver = (string) ($connection['type'] ?? 'sqlite');

        $diagnostics = [
            'mode' => 'database',
            'preferred_driver' => $driver,
            'database_available' => true,
            'database_error' => self::$databaseError,
            'storage_path' => $this->storagePath,
            'collection_counts' => [
                'users' => count($this->allUsers()),
                'roles' => count($this->allRoles()),
                'policies' => count($this->allPolicies()),
                'dictionaries' => count($this->allDictionaries()),
                'workflows' => count($this->allWorkflows()),
                'projects' => count($this->allProjects()),
                'requirements' => count($this->allRequirements()),
                'executions' => count($this->allExecutions()),
                'tasks' => count($this->allTasks()),
                'worklogs' => count($this->allWorklogs()),
                'daily_tasks' => count($this->allDailyTasks()),
                'bugs' => count($this->allBugs()),
                'requirement_reviews' => count($this->allRequirementReviews()),
                'requirement_attachments' => count($this->allRequirementAttachments()),
            ],
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

        $diagnostics['identity_tables'] = $this->identityStore()->diagnostics();
        $diagnostics['delivery_tables'] = $this->deliveryStore()->diagnostics();
        $diagnostics['collaboration_tables'] = $this->collaborationStore()->diagnostics();
        $diagnostics['settings_tables'] = $this->settingsStore()->diagnostics();

        return $diagnostics;
    }

    public function connectionInfo(): array
    {
        return $this->currentConnection();
    }

    private function ensureReady(): void
    {
        if (self::$databaseAvailable === true) {
            return;
        }

        if (self::$databaseAvailable === false) {
            throw new \RuntimeException((string) (self::$databaseError ?? 'database_not_initialized'));
        }

        self::$databaseAvailable = $this->bootstrapDatabase();
        if (!self::$databaseAvailable) {
            throw new \RuntimeException((string) (self::$databaseError ?? 'database_not_initialized'));
        }
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
            $this->prepareStorageDirectory($connection);
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

    private function prepareStorageDirectory(array $connection): void
    {
        $driver = (string) ($connection['type'] ?? 'sqlite');
        if ($driver !== 'sqlite') {
            return;
        }

        $databaseFile = (string) ($connection['database'] ?? (dirname(__DIR__, 2) . '/storage/framework/thinkphp.sqlite'));
        $directory = dirname($databaseFile);
        if (!is_dir($directory)) {
            mkdir($directory, 0777, true);
        }
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

    private function deliveryStore(?string $driver = null): DeliveryStore
    {
        if ($this->deliveryStore instanceof DeliveryStore) {
            return $this->deliveryStore;
        }

        $this->deliveryStore = new DeliveryStore(
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
            $driver ?? (string) ($this->currentConnection()['type'] ?? 'sqlite'),
            $this->storagePath,
        );

        return $this->settingsStore;
    }
}