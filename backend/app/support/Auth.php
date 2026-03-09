<?php

declare(strict_types=1);

namespace App\Support;

final class Auth
{
    public const DEMO_TOKEN = 'demo-token';

    public static function isAuthorized(Request $request): bool
    {
        $header = (string) ($request->headers['Authorization'] ?? $request->headers['authorization'] ?? '');

        return trim($header) === 'Bearer ' . self::DEMO_TOKEN;
    }
}
