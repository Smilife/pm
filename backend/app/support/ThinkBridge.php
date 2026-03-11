<?php

declare(strict_types=1);

namespace App\Support;

use Throwable;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

final class ThinkBridge
{
    public static function dispatch(ThinkRequest $thinkRequest): ThinkResponse
    {
        $request = Request::fromThinkRequest($thinkRequest);

        if ($request->method !== 'OPTIONS' && $request->path !== '/auth/login' && !Auth::isAuthorized($request)) {
            return self::toThinkResponse(Response::error(401, 'unauthorized', [], $request->requestId));
        }

        $authorizationError = Authorization::authorizeRequest($request);
        if ($authorizationError !== null) {
            return self::toThinkResponse($authorizationError);
        }

        $router = new Router();
        $routes = require dirname(__DIR__, 2) . '/route/api.php';

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

        return self::toThinkResponse($response);
    }

    private static function toThinkResponse(Response $response): ThinkResponse
    {
        return ThinkResponse::create($response->payload(), 'json', $response->statusCode())
            ->header([
                'Content-Type' => 'application/json; charset=utf-8',
            ]);
    }
}
