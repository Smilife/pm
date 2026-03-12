<?php

declare(strict_types=1);

namespace app\controller;

use App\Support\Auth;
use App\Support\Authorization;
use App\Support\Request as LegacyRequest;
use App\Support\Response as LegacyResponse;
use App\Support\ThinkResponseFactory;
use Throwable;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

abstract class BaseApiController
{
    protected function run(ThinkRequest $request, callable $callback, bool $allowGuest = false): ThinkResponse
    {
        $legacyRequest = LegacyRequest::fromThinkRequest($request);

        if (!$allowGuest && $legacyRequest->method !== 'OPTIONS' && !Auth::isAuthorized($legacyRequest)) {
            return ThinkResponseFactory::fromLegacy(LegacyResponse::error(401, 'unauthorized', [], $legacyRequest->requestId));
        }

        if (!$allowGuest) {
            $authorizationError = Authorization::authorizeRequest($legacyRequest);
            if ($authorizationError !== null) {
                return ThinkResponseFactory::fromLegacy($authorizationError);
            }
        }

        try {
            $response = $callback($legacyRequest);
        } catch (Throwable $exception) {
            $response = LegacyResponse::error(
                500,
                'internal_error',
                [
                    'error' => $exception->getMessage(),
                ],
                $legacyRequest->requestId
            );
        }

        return ThinkResponseFactory::fromLegacy($response);
    }
}