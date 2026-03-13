<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\StoreRegistry;
use App\Support\RecordScope;
use App\Support\ApiContext;
use App\Support\ApiResponder;
use think\Response as ThinkResponse;

final class BugService
{
    private StoreRegistry $store;

    public function __construct(StoreRegistry $store)
    {
        $this->store = $store;
    }

    public function index(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $items = $scope->filterBugs($this->store->allBugs());

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($right['updated_at'] ?? ''), (string) ($left['updated_at'] ?? ''));
        });

        return ApiResponder::success(['items' => $items, 'total' => count($items)], $request->requestId);
    }

    public function store(ApiContext $request, array $params): ThinkResponse
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

        return ApiResponder::success($this->store->createBug($payload), $request->requestId);
    }

    public function show(ApiContext $request, array $params): ThinkResponse
    {
        $bugId = (int) ($params['id'] ?? 0);
        $bug = $this->store->findBug($bugId);

        if ($bug === null) {
            return ApiResponder::error(404, 'bug_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessBug($bug)) {
            return $scope->scopeDenied('bug', $request->requestId, $bugId);
        }

        return ApiResponder::success($bug, $request->requestId);
    }

    public function update(ApiContext $request, array $params): ThinkResponse
    {
        $bugId = (int) ($params['id'] ?? 0);
        $current = $this->store->findBug($bugId);

        if ($current === null) {
            return ApiResponder::error(404, 'bug_not_found', [], $request->requestId);
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

        $updated = $this->store->updateBug($bugId, [
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
            return ApiResponder::error(404, 'bug_not_found', [], $request->requestId);
        }

        return ApiResponder::success($updated, $request->requestId);
    }

    public function batchSubmit(ApiContext $request, array $params): ThinkResponse
    {
        $scope = new RecordScope($request, $this->store);
        $bugIds = array_values(array_filter(array_map('intval', (array) ($request->body['bug_ids'] ?? [])), static fn (int $item): bool => $item > 0));

        if ($bugIds === []) {
            return ApiResponder::error(422, 'missing_bug_ids', [], $request->requestId);
        }

        $now = date('c');
        $items = $this->store->allBugs();
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

        $this->store->replaceAllBugs($items);

        return ApiResponder::success([
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

        $record = $linkType === 'project'
            ? $this->store->findProject($linkId)
            : $this->store->findExecution($linkId);

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
