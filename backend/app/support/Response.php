<?php

declare(strict_types=1);

namespace App\Support;

final class Response
{
    public function __construct(
        private readonly int $statusCode,
        private readonly array $payload,
    ) {
    }

    public static function success(array $data, string $requestId, string $message = 'ok'): self
    {
        return new self(200, [
            'code' => 0,
            'message' => $message,
            'data' => $data,
            'request_id' => $requestId,
        ]);
    }

    public static function error(int $statusCode, string $message, array $data, string $requestId): self
    {
        return new self($statusCode, [
            'code' => $statusCode,
            'message' => $message,
            'data' => $data,
            'request_id' => $requestId,
        ]);
    }

    public function send(): void
    {
        http_response_code($this->statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($this->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }
}
