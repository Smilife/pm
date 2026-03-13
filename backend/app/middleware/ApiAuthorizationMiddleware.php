<?php

declare(strict_types=1);

namespace app\middleware;

use App\Support\ApiContext;
use App\Support\Authorization;
use Closure;
use think\Request;
use think\Response;

final class ApiAuthorizationMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$this->shouldHandle($request) || $this->isGuestRoute($request) || strtoupper($request->method()) === 'OPTIONS') {
            return $next($request);
        }

        $apiRequest = $this->apiContext($request);
        $error = Authorization::authorizeRequest($apiRequest);
        if ($error !== null) {
            return $error;
        }

        return $next($request);
    }

    private function shouldHandle(Request $request): bool
    {
        $path = '/' . ltrim($request->pathinfo(), '/');

        return str_starts_with($path, '/api/v1/');
    }

    private function isGuestRoute(Request $request): bool
    {
        $path = '/' . ltrim($request->pathinfo(), '/');

        return $path === '/api/v1/auth/login';
    }

    private function apiContext(Request $request): ApiContext
    {
        $context = $request->middleware('api_context');

        return $context instanceof ApiContext ? $context : ApiContext::fromThinkRequest($request);
    }
}