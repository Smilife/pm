<?php

declare(strict_types=1);

namespace App\Support;

final class EnvLoader
{
    public static function load(string $rootPath): void
    {
        foreach ([rtrim($rootPath, '/\\') . '/.env', rtrim($rootPath, '/\\') . '/.env.local'] as $file) {
            if (!is_file($file)) {
                continue;
            }

            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $trimmed = trim($line);
                if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                    continue;
                }

                $separator = strpos($trimmed, '=');
                if ($separator === false) {
                    continue;
                }

                $key = trim(substr($trimmed, 0, $separator));
                $value = trim(substr($trimmed, $separator + 1));
                if ($key === '' || getenv($key) !== false) {
                    continue;
                }

                if ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                    $value = substr($value, 1, -1);
                }

                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}