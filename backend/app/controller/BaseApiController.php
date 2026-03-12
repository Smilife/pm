<?php

declare(strict_types=1);

namespace app\controller;

use App\Support\Auth;
use App\Support\Authorization;
use App\Support\Request as ApiRequest;
use App\Support\Response as ApiResponse;
use App\Support\ThinkResponseFactory;
use Throwable;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

abstract class BaseApiController
{
    protected function run(ThinkRequest $request, callable $callback, bool $allowGuest = false): ThinkResponse
    {
        $apiRequest = ApiRequest::fromThinkRequest($request);

        if (!$allowGuest && $apiRequest->method !== 'OPTIONS' && !Auth::isAuthorized($apiRequest)) {
            return ThinkResponseFactory::fromResponse(ApiResponse::error(401, 'unauthorized', [], $apiRequest->requestId));
        }

        if (!$allowGuest) {
            $authorizationError = Authorization::authorizeRequest($apiRequest);
            if ($authorizationError !== null) {
                return ThinkResponseFactory::fromResponse($authorizationError);
            }
        }

        try {
            $response = $callback($apiRequest);
        } catch (Throwable $exception) {
            $response = ApiResponse::error(
                500,
                'internal_error',
                [
                    'error' => $exception->getMessage(),
                ],
                $apiRequest->requestId
            );
        }

        return ThinkResponseFactory::fromResponse($response);
    }
}