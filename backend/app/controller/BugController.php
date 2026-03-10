<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\RecordScope;
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
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterBugs($this->store->all('bugs'));

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($right['updated_at'] ?? ''), (string) ($left['updated_at'] ?? ''));
        });

        return Response::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $linkType = $this->normalizeLinkType((string) ($request->body['link_type'] ?? 'execution'));
        $linkId = (int) ($request->body['link_id'] ?? 0);
        if ($linkType === 'project' && $linkId > 0 && !$scope->canAccessProjectId($linkId)) {
            return $scope->scopeDenied('project', $request->requestId, $linkId);
        }
        if ($linkType === 'execution' && $linkId > 0 && !$scope->canAccessExecutionId($linkId)) {
            return $scope->scopeDenied('execution', $request->requestId, $linkId);
        }

        $status = (string) ($request->body['status'] ?? 'Draft');
        $now = date('c');
        $reporterName = trim((string) ($request->body['reporter_name'] ?? '')) ?: $scope->currentUserName();
        $reporterError = $scope->ensureCurrentUserField($reporterName, 'reporter_name', 'bug', $request->requestId);
        if ($reporterError !== null) {
            return $reporterError;
        }

        $payload = [
            'title' => trim((string) ($request->body['title'] ?? 'Untitled bug')),
            'severity' => (string) ($request->body['severity'] ?? 'Medium'),
            'priority' => (string) ($request->body['priority'] ?? 'P1'),
            'status' => $status,
            'link_type' => $linkType,
            'link_id' => $linkId,
            'link_name' => $this->resolveLinkName($linkType, $linkId, (string) ($request->body['link_name'] ?? 'Unlinked')),
            'owner_name' => trim((string) ($request->body['owner_name'] ?? 'Unassigned')),
            'reporter_name' => $reporterName !== '' ? $reporterName : 'Unknown reporter',
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
        $bugId = (int) ($params['id'] ?? 0);
        $bug = $this->store->find('bugs', $bugId);

        if ($bug === null) {
            return Response::error(404, 'bug_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessBug($bug)) {
            return $scope->scopeDenied('bug', $request->requestId, $bugId);
        }

        return Response::success($bug, $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $bugId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('bugs', $bugId);

        if ($current === null) {
            return Response::error(404, 'bug_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessBug($current)) {
            return $scope->scopeDenied('bug', $request->requestId, $bugId);
        }

        $linkType = $this->normalizeLinkType((string) ($request->body['link_type'] ?? ($current['link_type'] ?? 'execution')));
        $linkId = (int) ($request->body['link_id'] ?? ($current['link_id'] ?? 0));
        if ($linkType === 'project' && $linkId > 0 && !$scope->canAccessProjectId($linkId)) {
            return $scope->scopeDenied('project', $request->requestId, $linkId);
        }
        if ($linkType === 'execution' && $linkId > 0 && !$scope->canAccessExecutionId($linkId)) {
            return $scope->scopeDenied('execution', $request->requestId, $linkId);
        }

        $updated = $this->store->update('bugs', $bugId, [
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
        ]);

        if ($updated === null) {
            return Response::error(404, 'bug_not_found', [], $request->requestId);
        }

        return Response::success($updated, $request->requestId);
    }

    public function batchSubmit(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
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

            if (!$scope->canAccessBug($item)) {
                $skippedBugIds[] = $bugId;
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
