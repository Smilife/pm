<?php

declare(strict_types=1);

$defaultConnection = getenv('PM_DB_CONNECTION') ?: 'sqlite';
$sqliteDatabase = getenv('PM_SQLITE_DATABASE') ?: dirname(__DIR__) . '/storage/framework/thinkphp.sqlite';

return [
    'default' => $defaultConnection,
    'cache_store' => 'file',
    'connections' => [
        'sqlite' => [
            'type' => 'sqlite',
            'database' => $sqliteDatabase,
            'prefix' => '',
        ],
        'mysql' => [
            'type' => 'mysql',
            'hostname' => getenv('PM_DB_HOST') ?: '127.0.0.1',
            'hostport' => (int) (getenv('PM_DB_PORT') ?: 3306),
            'database' => getenv('PM_DB_NAME') ?: 'pm',
            'username' => getenv('PM_DB_USER') ?: 'root',
            'password' => getenv('PM_DB_PASSWORD') ?: '',
            'charset' => getenv('PM_DB_CHARSET') ?: 'utf8mb4',
            'prefix' => getenv('PM_DB_PREFIX') ?: '',
        ],
    ],
];