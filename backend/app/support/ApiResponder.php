<?php

declare(strict_types=1);

namespace App\Support;

use think\Response;

final class ApiResponder
{
    public static function success(array $data, string $requestId, string $message = 'ok', int $statusCode = 200): Response
    {
        return self::json([
            'code' => 0,
            'message' => $message,
            'data' => $data,
            'request_id' => $requestId,
        ], $statusCode);
    }

    public static function error(int $statusCode, string $message, array $data, string $requestId): Response
    {
        return self::json([
            'code' => $statusCode,
            'message' => $message,
            'data' => $data,
            'request_id' => $requestId,
        ], $statusCode);
    }

    private static function json(array $payload, int $statusCode): Response
    {
        return Response::create($payload, 'json', $statusCode)
            ->header(['Content-Type' => 'application/json; charset=utf-8']);
    }
}