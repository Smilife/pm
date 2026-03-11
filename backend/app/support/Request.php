<?php

declare(strict_types=1);

namespace App\Support;

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        public readonly array $files,
        public readonly array $headers,
        public readonly string $requestId,
    ) {
    }

    public static function fromGlobals(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = preg_replace('#^/api/v1#', '', $uriPath) ?: '/';
        $rawBody = file_get_contents('php://input') ?: '';
        $decodedBody = json_decode($rawBody, true);
        $body = is_array($decodedBody) ? $decodedBody : $_POST;
        $files = $_FILES;
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $requestId = $headers['X-Request-Id'] ?? uniqid('req_', true);

        return new self($method, $path, $_GET, $body, $files, $headers, $requestId);
    }
}