<?php

declare(strict_types=1);

namespace App\Support;

use Closure;

final class Router
{
    /** @var array<int, array{method: string, pattern: string, handler: callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable|array $handler): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => is_array($handler) ? $this->resolveHandler($handler) : $handler,
        ];
    }

    public function dispatch(Request $request): Response
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method) {
                continue;
            }

            $matches = [];
            $regex = '#^' . preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $route['pattern']) . '$#';

            if (!preg_match($regex, $request->path, $matches)) {
                continue;
            }

            $params = array_filter($matches, static fn ($key) => !is_int($key), ARRAY_FILTER_USE_KEY);

            return ($route['handler'])($request, $params);
        }

        return Response::error(404, 'not_found', ['path' => $request->path], $request->requestId);
    }

    private function resolveHandler(array $handler): Closure
    {
        [$className, $method] = $handler;

        return static function (Request $request, array $params) use ($className, $method): Response {
            $controller = new $className();

            return $controller->$method($request, $params);
        };
    }
}
