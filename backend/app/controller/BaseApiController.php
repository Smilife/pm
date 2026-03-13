<?php

declare(strict_types=1);

namespace app\controller;

use App\Support\ApiContext;
use App\Support\ApiResponder;
use Throwable;
use think\Request as ThinkRequest;
use think\Response as ThinkResponse;

abstract class BaseApiController
{
    protected function run(ThinkRequest $request, callable $callback, bool $allowGuest = false): ThinkResponse
    {
        $apiRequest = $request->middleware('api_context');
        if (!$apiRequest instanceof ApiContext) {
            $apiRequest = ApiContext::fromThinkRequest($request);
        }

        try {
            $response = $callback($apiRequest);

            if ($response instanceof ThinkResponse) {
                return $response;
            }

            if (is_array($response)) {
                return ApiResponder::success($response, $apiRequest->requestId);
            }

            return ApiResponder::success(['value' => $response], $apiRequest->requestId);
        } catch (Throwable $exception) {
            return ApiResponder::error(
                500,
                'internal_error',
                [
                    'error' => $exception->getMessage(),
                ],
                $apiRequest->requestId
            );
        }
    }
}