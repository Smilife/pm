<?php

declare(strict_types=1);

namespace app\middleware;

use App\Support\ApiContext;
use Closure;
use think\Request;
use think\Response;

final class ApiRequestContextMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->isApiRequest($request)) {
            $request->withMiddleware([
                'api_context' => ApiContext::fromThinkRequest($request),
            ]);
        }

        return $next($request);
    }

    private function isApiRequest(Request $request): bool
    {
        $path = '/' . ltrim($request->pathinfo(), '/');

        return str_starts_with($path, '/api/v1/');
    }
}