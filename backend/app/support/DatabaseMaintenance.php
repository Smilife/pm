<?php

declare(strict_types=1);

namespace App\Support;

use think\facade\Db;

final class DatabaseMaintenance
{
    private string $storagePath;

    private ?IdentityStore $identityStore = null;

    private ?DeliveryStore $deliveryStore = null;

    private ?CollaborationStore $collaborationStore = null;

    private ?SettingsStore $settingsStore = null;

    public function __construct(?string $storagePath = null)
    {
        $this->storagePath = $storagePath ?? dirname(__DIR__, 2) . '/storage/data';
    }

    public function migrate(): array
    {
        $connection = $this->currentConnection();
        $driver = (string) ($connection['type'] ?? 'sqlite');
        $this->prepareStorageDirectory($connection);

        $this->identityStore($driver)->ensureSchema();
        $this->deliveryStore($driver)->ensureSchema();
        $this->collaborationStore($driver)->ensureSchema();
        $this->settingsStore($driver)->ensureSchema();

        return $this->summary('migrated');
    }

    public function seed(): array
    {
        $connection = $this->currentConnection();
        $driver = (string) ($connection['type'] ?? 'sqlite');
        $this->prepareStorageDirectory($connection);

        $this->identityStore($driver)->importIfNeeded();
        $this->deliveryStore($driver)->importIfNeeded();
        $this->collaborationStore($driver)->importIfNeeded();
        $this->settingsStore($driver)->importIfNeeded();

        return $this->summary('seeded');
    }

    public function cleanupLegacy(): array
    {
        $dropped = [];
        if ($this->tableExists('data_records')) {
            Db::execute('DROP TABLE IF EXISTS data_records');
            $dropped[] = 'data_records';
        }

        return [
            'stage' => 'legacy_cleaned',
            'dropped_tables' => $dropped,
            'remaining_legacy_tables' => $this->legacyTables(),
        ];
    }

    public function initialize(): array
    {
        $this->migrate();
        $this->seed();
        $cleanup = $this->cleanupLegacy();

        return array_merge($this->summary('initialized'), [
            'legacy_cleanup' => $cleanup,
        ]);
    }

    public function legacyTables(): array
    {
        $tables = [];
        foreach (['data_records'] as $table) {
            if ($this->tableExists($table)) {
                $tables[] = $table;
            }
        }

        return $tables;
    }

    private function summary(string $stage): array
    {
        $store = new StoreRegistry($this->storagePath);

        return [
            'stage' => $stage,
            'connection' => $store->connectionInfo(),
            'diagnostics' => $store->diagnostics(),
        ];
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

    private function tableExists(string $tableName): bool
    {
        $driver = (string) (($this->currentConnection())['type'] ?? 'sqlite');
        if ($driver === 'mysql') {
            $database = (string) (($this->currentConnection())['database'] ?? 'pm');
            $rows = Db::query('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [$database, $tableName]);

            return $rows !== [];
        }

        $rows = Db::query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$tableName]);

        return $rows !== [];
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