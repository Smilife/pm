<?php

declare(strict_types=1);

namespace App\Support;

final class Auth
{
    private const TOKEN_PREFIX = 'demo-token-';

    public static function tokenForUser(array $user): string
    {
        return self::TOKEN_PREFIX . (int) ($user['id'] ?? 0);
    }

    public static function isAuthorized(Request $request): bool
    {
        return self::currentUser($request) !== null;
    }

    public static function currentUser(Request $request): ?array
    {
        $userId = self::userIdFromRequest($request);
        if ($userId === null) {
            return null;
        }

        $store = new JsonStore();
        $user = $store->find('users', $userId);

        return is_array($user) ? $user : null;
    }

    public static function userIdFromRequest(Request $request): ?int
    {
        $token = self::bearerToken($request);
        if ($token === '' || !str_starts_with($token, self::TOKEN_PREFIX)) {
            return null;
        }

        $userId = (int) substr($token, strlen(self::TOKEN_PREFIX));

        return $userId > 0 ? $userId : null;
    }

    private static function bearerToken(Request $request): string
    {
        $header = (string) ($request->headers['Authorization'] ?? $request->headers['authorization'] ?? '');
        if (!str_starts_with($header, 'Bearer ')) {
            return '';
        }

        return trim(substr($header, 7));
    }
}
