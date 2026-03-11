<?php

declare(strict_types=1);

namespace App\Support;

use think\Request as ThinkRequest;
use think\file\UploadedFile;

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
        $headers = self::normalizeHeaders(function_exists('getallheaders') ? getallheaders() : []);
        $requestId = $headers['X-Request-Id'] ?? $headers['x-request-id'] ?? uniqid('req_', true);

        return new self($method, $path, $_GET, $body, $files, $headers, $requestId);
    }

    public static function fromThinkRequest(ThinkRequest $request): self
    {
        $method = strtoupper($request->method());
        $rawPath = '/' . ltrim($request->pathinfo(), '/');
        $path = preg_replace('#^/api/v1#', '', $rawPath) ?: '/';
        $query = self::normalizeInputArray($request->get());
        $body = self::resolveBody($request, $method);
        $files = self::normalizeFiles($request->file());
        $headers = self::normalizeHeaders($request->header());
        $requestId = $headers['X-Request-Id'] ?? $headers['x-request-id'] ?? uniqid('req_', true);

        return new self($method, $path, $query, $body, $files, $headers, $requestId);
    }

    private static function resolveBody(ThinkRequest $request, string $method): array
    {
        $rawBody = trim($request->getInput());
        if ($rawBody !== '') {
            $decodedBody = json_decode($rawBody, true);
            if (is_array($decodedBody)) {
                return $decodedBody;
            }
        }

        return match ($method) {
            'POST' => self::normalizeInputArray($request->post()),
            'PUT', 'PATCH', 'DELETE' => self::normalizeInputArray($request->put()),
            default => [],
        };
    }

    private static function normalizeFiles(mixed $files): array
    {
        if (!is_array($files)) {
            return [];
        }

        $normalized = [];
        foreach ($files as $key => $value) {
            $normalized[(string) $key] = self::normalizeFileValue($value);
        }

        return $normalized;
    }

    private static function normalizeFileValue(mixed $value): mixed
    {
        if ($value instanceof UploadedFile) {
            return [
                'name' => $value->getOriginalName(),
                'type' => $value->getOriginalMime(),
                'tmp_name' => $value->getPathname(),
                'error' => UPLOAD_ERR_OK,
                'size' => (int) $value->getSize(),
            ];
        }

        if (!is_array($value)) {
            return $value;
        }

        $normalized = [];
        foreach ($value as $key => $item) {
            $normalized[(string) $key] = self::normalizeFileValue($item);
        }

        return $normalized;
    }

    private static function normalizeHeaders(array $headers): array
    {
        $normalized = [];
        foreach ($headers as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }

            $stringValue = is_array($value)
                ? implode(',', array_map(static fn (mixed $item): string => (string) $item, $value))
                : (string) $value;

            $canonicalKey = str_replace(' ', '-', ucwords(str_replace('-', ' ', strtolower($key))));
            $normalized[$key] = $stringValue;
            $normalized[strtolower($key)] = $stringValue;
            $normalized[$canonicalKey] = $stringValue;
        }

        return $normalized;
    }

    private static function normalizeInputArray(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }
}
