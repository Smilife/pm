<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

App\Support\EnvLoader::load(dirname(__DIR__));

$app = new think\App(dirname(__DIR__) . DIRECTORY_SEPARATOR);
$app->initialize();
$app->boot();

$collections = [
    'users',
    'roles',
    'policies',
    'dictionaries',
    'workflows',
    'projects',
    'requirements',
    'executions',
    'tasks',
    'worklogs',
    'daily_tasks',
    'bugs',
    'requirement_reviews',
    'requirement_attachments',
];

$store = new App\Support\JsonStore();

echo json_encode($store->diagnostics($collections), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;