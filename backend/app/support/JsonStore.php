<?php

declare(strict_types=1);

namespace App\Support;

final class JsonStore
{
    private string $storagePath;

    public function __construct(?string $storagePath = null)
    {
        $this->storagePath = $storagePath ?? dirname(__DIR__, 2) . '/storage/data';
    }

    public function all(string $name): array
    {
        return $this->read($name);
    }

    public function find(string $name, int $id): ?array
    {
        foreach ($this->read($name) as $item) {
            if ((int) ($item['id'] ?? 0) === $id) {
                return $item;
            }
        }

        return null;
    }

    public function filter(string $name, callable $callback): array
    {
        return array_values(array_filter($this->read($name), $callback));
    }

    public function create(string $name, array $payload): array
    {
        $items = $this->read($name);
        $payload['id'] = $this->nextId($items);
        $items[] = $payload;
        $this->write($name, $items);

        return $payload;
    }

    public function update(string $name, int $id, array $payload): ?array
    {
        $items = $this->read($name);

        foreach ($items as $index => $item) {
            if ((int) ($item['id'] ?? 0) !== $id) {
                continue;
            }

            $items[$index] = array_merge($item, $payload, ['id' => $id]);
            $this->write($name, $items);

            return $items[$index];
        }

        return null;
    }

    public function replaceAll(string $name, array $items): void
    {
        $this->write($name, $items);
    }

    private function read(string $name): array
    {
        $file = $this->filePath($name);

        if (!file_exists($file)) {
            return [];
        }

        $content = file_get_contents($file) ?: '[]';
        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function write(string $name, array $items): void
    {
        file_put_contents($this->filePath($name), json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private function filePath(string $name): string
    {
        return $this->storagePath . '/' . $name . '.json';
    }

    private function nextId(array $items): int
    {
        $ids = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items);

        return $ids ? max($ids) + 1 : 1;
    }
}
