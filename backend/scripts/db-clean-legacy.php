<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

App\Support\EnvLoader::load(dirname(__DIR__));

$app = new think\App(dirname(__DIR__) . DIRECTORY_SEPARATOR);
$app->initialize();
$app->boot();

$maintenance = new App\Support\DatabaseMaintenance();
echo json_encode($maintenance->cleanupLegacy(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;