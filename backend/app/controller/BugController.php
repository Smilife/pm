<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\Request;
use App\Support\Response;

final class BugController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function index(Request $request, array $params): Response
    {
        $items = $this->store->all('bugs');

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($right['updated_at'] ?? ''), (string) ($left['updated_at'] ?? ''));
        });

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $linkType = $this->normalizeLinkType((string) ($request->body['link_type'] ?? 'execution'));
        $linkId = (int) ($request->body['link_id'] ?? 0);
        $status = (string) ($request->body['status'] ?? 'Draft');
        $now = date('c');

        $payload = [
            'title' => trim((string) ($request->body['title'] ?? 'Untitled bug')),
            'severity' => (string) ($request->body['severity'] ?? 'Medium'),
            'priority' => (string) ($request->body['priority'] ?? 'P1'),
            'status' => $status,
            'link_type' => $linkType,
            'link_id' => $linkId,
            'link_name' => $this->resolveLinkName($linkType, $linkId, (string) ($request->body['link_name'] ?? 'Unlinked')),
            'owner_name' => trim((string) ($request->body['owner_name'] ?? 'Unassigned')),
            'reporter_name' => trim((string) ($request->body['reporter_name'] ?? 'Unknown reporter')),
            'reproduction_steps' => $this->normalizeLines($request->body['reproduction_steps'] ?? []),
            'expected_result' => trim((string) ($request->body['expected_result'] ?? '')),
            'actual_result' => trim((string) ($request->body['actual_result'] ?? '')),
            'created_at' => $now,
            'updated_at' => $now,
            'submitted_at' => $status === 'Draft' ? null : $now,
        ];

        return Response::success($this->store->create('bugs', $payload), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $bug = $this->store->find('bugs', (int) $params['id']);

        if ($bug === null) {
            return Response::error(404, 'bug_not_found', [], $request->requestId);
        }

        return Response::success($bug, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $bugId = (int) $params['id'];
        $current = $this->store->find('bugs', $bugId);

        if ($current === null) {
            return Response::error(404, 'bug_not_found', [], $request->requestId);
        }

        $linkType = $this->normalizeLinkType((string) ($request->body['link_type'] ?? ($current['link_type'] ?? 'execution')));
        $linkId = (int) ($request->body['link_id'] ?? ($current['link_id'] ?? 0));

        $payload = [
            'title' => trim((string) ($request->body['title'] ?? ($current['title'] ?? 'Untitled bug'))),
            'severity' => (string) ($request->body['severity'] ?? ($current['severity'] ?? 'Medium')),
            'priority' => (string) ($request->body['priority'] ?? ($current['priority'] ?? 'P1')),
            'status' => (string) ($request->body['status'] ?? ($current['status'] ?? 'Draft')),
            'link_type' => $linkType,
            'link_id' => $linkId,
            'link_name' => $this->resolveLinkName($linkType, $linkId, (string) ($request->body['link_name'] ?? ($current['link_name'] ?? 'Unlinked'))),
            'owner_name' => trim((string) ($request->body['owner_name'] ?? ($current['owner_name'] ?? 'Unassigned'))),
            'reporter_name' => trim((string) ($request->body['reporter_name'] ?? ($current['reporter_name'] ?? 'Unknown reporter'))),
            'reproduction_steps' => $this->normalizeLines($request->body['reproduction_steps'] ?? ($current['reproduction_steps'] ?? [])),
            'expected_result' => trim((string) ($request->body['expected_result'] ?? ($current['expected_result'] ?? ''))),
            'actual_result' => trim((string) ($request->body['actual_result'] ?? ($current['actual_result'] ?? ''))),
            'updated_at' => date('c'),
        ];

        $updated = $this->store->update('bugs', $bugId, $payload);

        if ($updated === null) {
            return Response::error(404, 'bug_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
    }

    public function batchSubmit(Request $request, array $params): Response
    {
        $bugIds = array_values(array_filter(array_map('intval', (array) ($request->body['bug_ids'] ?? [])), static fn (int $item): bool => $item > 0));

        if ($bugIds === []) {
            return Response::error(422, 'missing_bug_ids', [], $request->requestId);
        }

        $now = date('c');
        $items = $this->store->all('bugs');
        $submitted = [];
        $skippedBugIds = [];

        foreach ($items as $index => $item) {
            $bugId = (int) ($item['id'] ?? 0);
            if (!in_array($bugId, $bugIds, true)) {
                continue;
            }

            $status = (string) ($item['status'] ?? 'Draft');
            if (in_array($status, ['Resolved', 'Closed'], true)) {
                $skippedBugIds[] = $bugId;
                continue;
            }

            $items[$index]['status'] = 'Open';
            $items[$index]['submitted_at'] = (string) ($item['submitted_at'] ?? $now) ?: $now;
            $items[$index]['updated_at'] = $now;
            $submitted[] = $items[$index];
        }

        foreach ($bugIds as $bugId) {
            $exists = false;
            foreach ($items as $item) {
                if ((int) ($item['id'] ?? 0) === $bugId) {
                    $exists = true;
                    break;
                }
            }

            if (!$exists) {
                $skippedBugIds[] = $bugId;
            }
        }

        $this->store->replaceAll('bugs', $items);

        return Response::success([
            'items' => array_values($submitted),
            'skipped_bug_ids' => array_values(array_unique($skippedBugIds)),
        ], $request->requestId);
    }

    private function normalizeLinkType(string $linkType): string
    {
        return in_array($linkType, ['project', 'execution'], true) ? $linkType : 'execution';
    }

    private function resolveLinkName(string $linkType, int $linkId, string $fallback): string
    {
        if ($linkId <= 0) {
            return $fallback;
        }

        $collection = $linkType === 'project' ? 'projects' : 'executions';
        $record = $this->store->find($collection, $linkId);

        if ($record === null) {
            return $fallback;
        }

        return (string) ($record['name'] ?? $record['title'] ?? $fallback);
    }

    private function normalizeLines(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/\r?\n/', $value) ?: [];
        }

        if (!is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $value), static fn (string $item): bool => $item !== ''));
    }
}