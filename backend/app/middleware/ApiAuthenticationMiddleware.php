<?php

declare(strict_types=1);

namespace app\middleware;

use App\Support\ApiContext;
use App\Support\ApiResponder;
use App\Support\Auth;
use Closure;
use think\Request;
use think\Response;

final class ApiAuthenticationMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$this->shouldHandle($request) || $this->isGuestRoute($request) || strtoupper($request->method()) === 'OPTIONS') {
            return $next($request);
        }

        $apiRequest = $this->apiContext($request);
        if (!Auth::isAuthorized($apiRequest)) {
            return ApiResponder::error(401, 'unauthorized', [], $apiRequest->requestId);
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