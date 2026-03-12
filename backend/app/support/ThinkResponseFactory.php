<?php

declare(strict_types=1);

namespace App\Support;

use think\Response as ThinkResponse;

final class ThinkResponseFactory
{
    public static function fromResponse(Response $response): ThinkResponse
    {
        return ThinkResponse::create($response->payload(), 'json', $response->statusCode())
            ->header([
                'Content-Type' => 'application/json; charset=utf-8',
            ]);
    }
}