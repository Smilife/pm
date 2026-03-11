<?php

declare(strict_types=1);

if (PHP_SAPI === 'cli-server') {
    $staticPath = __DIR__ . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if (is_file($staticPath)) {
        return false;
    }
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../app/';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

use App\Support\Auth;
use App\Support\Authorization;
use App\Support\Request;
use App\Support\Response;
use App\Support\Router;

$request = Request::fromGlobals();

if ($request->method !== 'OPTIONS' && $request->path !== '/auth/login' && !Auth::isAuthorized($request)) {
    Response::error(401, 'unauthorized', [], $request->requestId)->send();
    return;
}

$authorizationError = Authorization::authorizeRequest($request);
if ($authorizationError !== null) {
    $authorizationError->send();
    return;
}

$router = new Router();
$routes = require __DIR__ . '/../route/api.php';

foreach ($routes as [$method, $pattern, $handler]) {
    $router->add($method, $pattern, $handler);
}

try {
    $response = $router->dispatch($request);
} catch (Throwable $exception) {
    $response = Response::error(
        500,
        'internal_error',
        [
            'error' => $exception->getMessage(),
        ],
        $request->requestId
    );
}

$response->send();