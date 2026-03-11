<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\RecordScope;
use App\Support\Request;
use App\Support\Response;

final class RequirementController
{
    private const DEFAULT_DRAFT_TITLE = 'Untitled draft';
    private const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function index(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $items = array_map(
            fn (array $item): array => $this->mapSummary($item),
            $scope->filterRequirements($this->store->all('requirements'))
        );

        return Response::success([
            'items' => $items,
            'page_no' => 1,
            'page_size' => 20,
            'total' => count($items),
        ], $request->requestId);
    }

    public function store(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $payload = $this->normalizeRequirementPayload($request->body, null, $scope);
        $created = $this->store->create('requirements', $payload);

        return Response::success($this->mapDetail($created, $scope), $request->requestId);
    }

    public function show(Request $request, array $params): Response
    {
        $requirementId = (int) ($params['id'] ?? 0);
        $requirement = $this->store->find('requirements', $requirementId);

        if ($requirement === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessRequirement($requirement)) {
            return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
        }

        return Response::success($this->mapDetail($requirement, $scope), $request->requestId);
    }

    public function update(Request $request, array $params): Response
    {
        $requirementId = (int) ($params['id'] ?? 0);
        $current = $this->store->find('requirements', $requirementId);

        if ($current === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessRequirement($current)) {
            return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
        }

        $payload = $this->normalizeRequirementPayload($request->body, $current, $scope);
        $updated = $this->store->update('requirements', $requirementId, $payload);

        if ($updated === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        return Response::success($this->mapDetail($updated, $scope), $request->requestId);
    }

    public function storeAttachment(Request $request, array $params): Response
    {
        $requirementId = (int) ($params['id'] ?? 0);
        $requirement = $this->store->find('requirements', $requirementId);

        if ($requirement === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessRequirement($requirement)) {
            return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
        }

        $file = is_array($request->files['file'] ?? null) ? $request->files['file'] : null;
        if ($file === null || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return Response::error(422, 'attachment_missing', [], $request->requestId);
        }

        if ((int) ($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            return Response::error(422, 'attachment_upload_failed', ['upload_error' => (int) ($file['error'] ?? 0)], $request->requestId);
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            return Response::error(422, 'attachment_empty', [], $request->requestId);
        }

        if ($size > self::MAX_ATTACHMENT_SIZE) {
            return Response::error(422, 'attachment_too_large', ['max_size' => self::MAX_ATTACHMENT_SIZE], $request->requestId);
        }

        $originalName = trim((string) ($file['name'] ?? ''));
        $tmpName = (string) ($file['tmp_name'] ?? '');
        $mimeType = $this->detectMimeType($tmpName, (string) ($file['type'] ?? ''));
        $attachmentType = $this->resolveAttachmentType($mimeType, $originalName);

        if ($attachmentType === 'other') {
            return Response::error(422, 'attachment_type_not_supported', [], $request->requestId);
        }

        $targetDirectory = dirname(__DIR__, 2) . '/public/uploads/requirements/' . $requirementId;
        if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0777, true) && !is_dir($targetDirectory)) {
            return Response::error(500, 'attachment_storage_failed', [], $request->requestId);
        }

        $safeName = $this->sanitizeFileName($originalName);
        $storedName = date('YmdHis') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
        $targetPath = $targetDirectory . '/' . $storedName;

        $stored = move_uploaded_file($tmpName, $targetPath);
        if (!$stored) {
            $stored = @rename($tmpName, $targetPath);
        }
        if (!$stored) {
            $stored = @copy($tmpName, $targetPath);
        }
        if (!$stored) {
            return Response::error(500, 'attachment_storage_failed', [], $request->requestId);
        }

        $attachment = $this->store->create('requirement_attachments', [
            'requirement_id' => $requirementId,
            'file_name' => $originalName !== '' ? $originalName : $safeName,
            'file_type' => $attachmentType,
            'mime_type' => $mimeType,
            'size' => filesize($targetPath) ?: $size,
            'url' => '/uploads/requirements/' . $requirementId . '/' . $storedName,
            'uploaded_at' => date(DATE_ATOM),
        ]);

        return Response::success($this->mapAttachment($attachment), $request->requestId);
    }

    public function submitForReview(Request $request, array $params): Response
    {
        $requirementId = (int) ($params['id'] ?? 0);
        $requirement = $this->store->find('requirements', $requirementId);

        if ($requirement === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessRequirement($requirement)) {
            return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
        }

        $normalized = $this->normalizeRequirementPayload([], $requirement, $scope);
        $this->store->update('requirements', $requirementId, ['maturity_checks' => $normalized['maturity_checks']]);

        $failedChecks = array_values(array_filter(
            $normalized['maturity_checks'],
            static fn (array $item): bool => !($item['passed'] ?? false)
        ));

        if ($failedChecks !== []) {
            return Response::error(422, 'maturity_check_failed', ['failed_checks' => $failedChecks], $request->requestId);
        }

        $updated = $this->store->update('requirements', $requirementId, [
            'status' => 'ToReview',
            'current_stage' => 'Pending review',
            'maturity_checks' => $normalized['maturity_checks'],
        ]);

        return Response::success($this->mapDetail($updated ?? $requirement, $scope), $request->requestId);
    }

    public function storeReview(Request $request, array $params): Response
    {
        $requirementId = (int) ($params['id'] ?? 0);
        $requirement = $this->store->find('requirements', $requirementId);

        if ($requirement === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessRequirement($requirement)) {
            return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
        }

        $reviewerName = trim((string) ($request->body['reviewer_name'] ?? '')) ?: $scope->currentUserName();
        $reviewerError = $scope->ensureCurrentUserField($reviewerName, 'reviewer_name', 'requirement_review', $request->requestId, $requirementId);
        if ($reviewerError !== null) {
            return $reviewerError;
        }

        $result = (string) ($request->body['result'] ?? 'supplement_required');
        $review = $this->store->create('requirement_reviews', [
            'requirement_id' => $requirementId,
            'result' => $result,
            'reviewer_name' => $reviewerName !== '' ? $reviewerName : 'Anonymous reviewer',
            'comment' => $request->body['comment'] ?? '',
            'reviewed_at' => date(DATE_ATOM),
        ]);

        $status = match ($result) {
            'approved' => 'Reviewed',
            'delayed', 'rejected', 'supplement_required' => 'Confirmed',
            default => 'Confirmed',
        };

        $currentStage = $result === 'approved' ? 'Reviewed' : 'Confirmed';
        $this->store->update('requirements', $requirementId, [
            'status' => $status,
            'current_stage' => $currentStage,
        ]);

        return Response::success($this->mapReview($review), $request->requestId);
    }

    public function listReviews(Request $request, array $params): Response
    {
        $requirementId = (int) ($params['id'] ?? 0);
        $requirement = $this->store->find('requirements', $requirementId);

        if ($requirement === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        $scope = new RecordScope($request, $this->store);
        if (!$scope->canAccessRequirement($requirement)) {
            return $scope->scopeDenied('requirement', $request->requestId, $requirementId);
        }

        $reviews = $this->store->filter(
            'requirement_reviews',
            static fn (array $item): bool => (int) ($item['requirement_id'] ?? 0) === $requirementId
        );

        usort($reviews, static fn (array $left, array $right): int => strcmp((string) ($right['reviewed_at'] ?? ''), (string) ($left['reviewed_at'] ?? '')));

        return Response::success([
            'items' => array_map(fn (array $item): array => $this->mapReview($item), $reviews),
        ], $request->requestId);
    }

    public function batchGenerateExecutions(Request $request, array $params): Response
    {
        $scope = new RecordScope($request, $this->store);
        $requirementIds = array_values(array_unique(array_map('intval', $request->body['requirement_ids'] ?? [])));
        $projectId = (int) ($request->body['project_id'] ?? 0);
        if ($projectId > 0 && !$scope->canAccessProjectId($projectId)) {
            return $scope->scopeDenied('project', $request->requestId, $projectId);
        }

        $requirements = $this->store->all('requirements');
        $executions = $this->store->all('executions');
        $projects = $this->store->all('projects');
        $created = [];
        $skipped = [];
        $projectName = (string) ($request->body['project_name'] ?? 'Unassigned project');

        foreach ($projects as $project) {
            if ((int) ($project['id'] ?? 0) === $projectId) {
                $projectName = (string) ($project['name'] ?? $projectName);
                break;
            }
        }

        foreach ($requirementIds as $requirementId) {
            if (!$scope->canAccessRequirementId($requirementId)) {
                $skipped[] = $requirementId;
                continue;
            }

            $requirementIndex = null;

            foreach ($requirements as $index => $requirement) {
                if ((int) ($requirement['id'] ?? 0) === $requirementId) {
                    $requirementIndex = $index;
                    break;
                }
            }

            if ($requirementIndex === null) {
                $skipped[] = $requirementId;
                continue;
            }

            $requirement = $requirements[$requirementIndex];

            if (!in_array((string) ($requirement['status'] ?? ''), ['Reviewed', 'Scheduled', 'InDevelopment'], true)) {
                $skipped[] = $requirementId;
                continue;
            }

            $execution = [
                'id' => $this->nextId($executions),
                'name' => 'Execution - ' . (string) ($requirement['title'] ?? self::DEFAULT_DRAFT_TITLE),
                'project_id' => $projectId,
                'project_name' => $projectName,
                'owner_name' => (string) ($requirement['owner_name'] ?? 'Unassigned'),
                'status' => 'NotStarted',
                'plan_start' => $request->body['plan_start'] ?? date('Y-m-d'),
                'plan_end' => $request->body['plan_end'] ?? date('Y-m-d', strtotime('+7 days')),
                'plan_progress' => 0,
                'actual_progress' => 0,
                'requirement_ids' => [$requirementId],
            ];

            $executions[] = $execution;
            $created[] = $execution;
            $requirements[$requirementIndex]['status'] = 'Scheduled';
            $requirements[$requirementIndex]['current_stage'] = 'Scheduled';
            $requirements[$requirementIndex]['linked_execution_ids'] = array_values(array_unique([
                ...(is_array($requirements[$requirementIndex]['linked_execution_ids'] ?? null) ? $requirements[$requirementIndex]['linked_execution_ids'] : []),
                $execution['id'],
            ]));
        }

        foreach ($projects as $index => $project) {
            if ((int) ($project['id'] ?? 0) !== $projectId) {
                continue;
            }

            $projects[$index]['execution_count'] = (int) ($project['execution_count'] ?? 0) + count($created);
        }

        $this->store->replaceAll('requirements', $requirements);
        $this->store->replaceAll('executions', $executions);
        $this->store->replaceAll('projects', $projects);

        return Response::success([
            'items' => $created,
            'skipped_requirement_ids' => $skipped,
        ], $request->requestId);
    }

    private function mapSummary(array $item): array
    {
        return [
            'id' => (int) ($item['id'] ?? 0),
            'title' => (string) ($item['title'] ?? self::DEFAULT_DRAFT_TITLE),
            'status' => (string) ($item['status'] ?? 'Draft'),
            'priority' => (string) ($item['priority'] ?? 'P1'),
            'owner_name' => (string) ($item['owner_name'] ?? ''),
            'expected_release_at' => (string) ($item['expected_release_at'] ?? ''),
            'linked_execution_count' => count(is_array($item['linked_execution_ids'] ?? null) ? $item['linked_execution_ids'] : []),
        ];
    }

    private function mapDetail(array $item, ?RecordScope $scope = null): array
    {
        $reviews = $this->store->filter(
            'requirement_reviews',
            static fn (array $review): bool => (int) ($review['requirement_id'] ?? 0) === (int) ($item['id'] ?? 0)
        );
        usort($reviews, static fn (array $left, array $right): int => strcmp((string) ($right['reviewed_at'] ?? ''), (string) ($left['reviewed_at'] ?? '')));

        $executions = array_values(array_filter(array_map(
            fn (int $executionId): ?array => $this->store->find('executions', $executionId),
            array_map('intval', is_array($item['linked_execution_ids'] ?? null) ? $item['linked_execution_ids'] : [])
        )));
        if ($scope !== null) {
            $executions = $scope->filterExecutions($executions);
        }

        $attachments = $this->store->filter(
            'requirement_attachments',
            static fn (array $attachment): bool => (int) ($attachment['requirement_id'] ?? 0) === (int) ($item['id'] ?? 0)
        );
        usort($attachments, static fn (array $left, array $right): int => strcmp((string) ($right['uploaded_at'] ?? ''), (string) ($left['uploaded_at'] ?? '')));

        return [
            ...$this->mapSummary($item),
            'description' => $item['description'] ?? '',
            'current_stage' => $item['current_stage'] ?? '',
            'solution_summary' => $item['solution_summary'] ?? '',
            'acceptance_criteria' => $item['acceptance_criteria'] ?? [],
            'impact_scope' => $item['impact_scope'] ?? [],
            'risks' => $item['risks'] ?? [],
            'maturity_checks' => $this->buildMaturityChecks($item),
            'linked_execution_ids' => $item['linked_execution_ids'] ?? [],
            'linked_execution_names' => array_values(array_map(
                static fn (array $execution): string => (string) ($execution['name'] ?? ''),
                $executions
            )),
            'linked_executions' => $executions,
            'attachments' => array_values(array_map(fn (array $attachment): array => $this->mapAttachment($attachment), $attachments)),
            'reviews' => array_values(array_map(fn (array $review): array => $this->mapReview($review), $reviews)),
        ];
    }

    private function mapReview(array $item): array
    {
        return [
            'id' => (int) ($item['id'] ?? 0),
            'requirement_id' => (int) ($item['requirement_id'] ?? 0),
            'reviewer_name' => (string) ($item['reviewer_name'] ?? ''),
            'result' => (string) ($item['result'] ?? 'supplement_required'),
            'comment' => (string) ($item['comment'] ?? ''),
            'reviewed_at' => (string) ($item['reviewed_at'] ?? ''),
        ];
    }

    private function mapAttachment(array $item): array
    {
        return [
            'id' => (int) ($item['id'] ?? 0),
            'requirement_id' => (int) ($item['requirement_id'] ?? 0),
            'file_name' => (string) ($item['file_name'] ?? ''),
            'file_type' => (string) ($item['file_type'] ?? 'other'),
            'mime_type' => (string) ($item['mime_type'] ?? ''),
            'size' => (int) ($item['size'] ?? 0),
            'url' => (string) ($item['url'] ?? ''),
            'uploaded_at' => (string) ($item['uploaded_at'] ?? ''),
        ];
    }

    private function normalizeRequirementPayload(array $source, ?array $current, RecordScope $scope): array
    {
        $status = $this->normalizeStatus((string) ($source['status'] ?? ($current['status'] ?? 'Draft')));
        $title = $this->normalizeTitle($this->stringValue($source, 'title', (string) ($current['title'] ?? '')));
        $ownerName = $this->normalizeOwnerName($source, $current, $scope);
        $expectedReleaseAt = $this->normalizeDate($this->stringValue($source, 'expected_release_at', (string) ($current['expected_release_at'] ?? '')));
        $description = $this->stringValue($source, 'description', (string) ($current['description'] ?? ''));
        $solutionSummary = $this->stringValue($source, 'solution_summary', (string) ($current['solution_summary'] ?? ''));
        $acceptanceCriteria = $this->normalizeList($source['acceptance_criteria'] ?? ($current['acceptance_criteria'] ?? []));
        $impactScope = $this->normalizeList($source['impact_scope'] ?? ($current['impact_scope'] ?? []));
        $risks = $this->normalizeList($source['risks'] ?? ($current['risks'] ?? []));
        $priority = $this->normalizePriority((string) ($source['priority'] ?? ($current['priority'] ?? 'P1')));
        $linkedExecutionIds = array_values(array_map('intval', is_array($current['linked_execution_ids'] ?? null) ? $current['linked_execution_ids'] : []));

        return [
            'title' => $title,
            'status' => $status,
            'priority' => $priority,
            'owner_name' => $ownerName,
            'expected_release_at' => $expectedReleaseAt,
            'description' => $description,
            'current_stage' => $this->mapCurrentStage($status),
            'solution_summary' => $solutionSummary,
            'acceptance_criteria' => $acceptanceCriteria,
            'impact_scope' => $impactScope,
            'risks' => $risks,
            'maturity_checks' => $this->buildMaturityChecks([
                'title' => $title,
                'description' => $description,
                'owner_name' => $ownerName,
                'expected_release_at' => $expectedReleaseAt,
                'solution_summary' => $solutionSummary,
                'acceptance_criteria' => $acceptanceCriteria,
                'impact_scope' => $impactScope,
                'risks' => $risks,
            ]),
            'linked_execution_ids' => $linkedExecutionIds,
        ];
    }

    private function buildMaturityChecks(array $payload): array
    {
        $title = trim((string) ($payload['title'] ?? ''));
        $description = trim((string) ($payload['description'] ?? ''));
        $ownerName = trim((string) ($payload['owner_name'] ?? ''));
        $expectedReleaseAt = trim((string) ($payload['expected_release_at'] ?? ''));
        $solutionSummary = trim((string) ($payload['solution_summary'] ?? ''));
        $acceptanceCriteria = $this->normalizeList($payload['acceptance_criteria'] ?? []);
        $impactScope = $this->normalizeList($payload['impact_scope'] ?? []);
        $risks = $this->normalizeList($payload['risks'] ?? []);

        return [
            ['key' => 'title', 'label' => 'Title added', 'passed' => $title !== '' && $title !== self::DEFAULT_DRAFT_TITLE],
            ['key' => 'description', 'label' => 'Background added', 'passed' => $description !== ''],
            ['key' => 'owner', 'label' => 'Owner assigned', 'passed' => $ownerName !== ''],
            ['key' => 'release', 'label' => 'Target date confirmed', 'passed' => $expectedReleaseAt !== ''],
            ['key' => 'solution', 'label' => 'Solution summary added', 'passed' => $solutionSummary !== ''],
            ['key' => 'acceptance', 'label' => 'Acceptance criteria added', 'passed' => $acceptanceCriteria !== []],
            ['key' => 'impact', 'label' => 'Impact scope defined', 'passed' => $impactScope !== []],
            ['key' => 'risk', 'label' => 'Risks captured', 'passed' => $risks !== []],
        ];
    }

    private function mapCurrentStage(string $status): string
    {
        return match ($status) {
            'Draft' => 'Drafting',
            'Understanding' => 'Understanding',
            'Confirmed' => 'Confirmed',
            'ToReview' => 'Pending review',
            'Reviewed' => 'Reviewed',
            'Scheduled' => 'Scheduled',
            'InDevelopment' => 'In development',
            default => 'Drafting',
        };
    }

    private function normalizeStatus(string $status): string
    {
        return in_array($status, ['Draft', 'Understanding', 'Confirmed', 'ToReview', 'Reviewed', 'Scheduled', 'InDevelopment'], true)
            ? $status
            : 'Draft';
    }

    private function normalizePriority(string $priority): string
    {
        return in_array($priority, ['P0', 'P1', 'P2'], true) ? $priority : 'P1';
    }

    private function normalizeTitle(string $value): string
    {
        $value = trim($value);

        return $value !== '' ? $value : self::DEFAULT_DRAFT_TITLE;
    }

    private function normalizeOwnerName(array $source, ?array $current, RecordScope $scope): string
    {
        if (array_key_exists('owner_name', $source)) {
            $ownerName = trim((string) $source['owner_name']);
            return $ownerName !== '' ? $ownerName : $scope->currentUserName();
        }

        if ($current !== null) {
            $ownerName = trim((string) ($current['owner_name'] ?? ''));
            return $ownerName !== '' ? $ownerName : $scope->currentUserName();
        }

        return $scope->currentUserName();
    }

    private function stringValue(array $source, string $key, string $fallback = ''): string
    {
        if (!array_key_exists($key, $source)) {
            return trim($fallback);
        }

        return trim((string) $source[$key]);
    }

    private function normalizeDate(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
    }

    private function normalizeList(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/\r?\n/', $value) ?: [];
        }

        if (!is_array($value)) {
            return [];
        }

        $items = array_map(
            static fn (mixed $item): string => trim((string) $item),
            $value
        );

        return array_values(array_filter($items, static fn (string $item): bool => $item !== ''));
    }

    private function detectMimeType(string $tmpName, string $fallback): string
    {
        if ($tmpName !== '' && is_file($tmpName) && function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $detected = finfo_file($finfo, $tmpName);
                finfo_close($finfo);
                if (is_string($detected) && $detected !== '') {
                    return $detected;
                }
            }
        }

        return $fallback;
    }

    private function resolveAttachmentType(string $mimeType, string $fileName): string
    {
        if (str_starts_with($mimeType, 'image/')) {
            return 'image';
        }

        if (str_starts_with($mimeType, 'audio/')) {
            return 'audio';
        }

        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (in_array($extension, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'], true)) {
            return 'image';
        }

        if (in_array($extension, ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'], true)) {
            return 'audio';
        }

        return 'other';
    }

    private function sanitizeFileName(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            return 'attachment';
        }

        $extension = pathinfo($name, PATHINFO_EXTENSION);
        $baseName = pathinfo($name, PATHINFO_FILENAME);
        $baseName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $baseName) ?: 'attachment';
        $extension = preg_replace('/[^A-Za-z0-9]+/', '', $extension) ?: '';

        return $extension !== '' ? $baseName . '.' . strtolower($extension) : $baseName;
    }

    private function nextId(array $items): int
    {
        $ids = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items);

        return $ids ? max($ids) + 1 : 1;
    }
}