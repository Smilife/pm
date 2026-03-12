<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

App\Support\EnvLoader::load(dirname(__DIR__));

if (PHP_SAPI === 'cli-server') {
    $staticPath = __DIR__ . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if (is_file($staticPath)) {
        return false;
    }
}

$app = new think\App(dirname(__DIR__) . DIRECTORY_SEPARATOR);
$http = $app->http;
$response = $http->run();
$response->send();
$http->end($response);