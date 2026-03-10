<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\JsonStore;
use App\Support\RecordScope;
use App\Support\Request;
use App\Support\Response;

final class RequirementController
{
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
        $ownerName = trim((string) ($request->body['owner_name'] ?? '')) ?: $scope->currentUserName();
        $payload = [
            'title' => $request->body['title'] ?? 'Untitled requirement',
            'status' => $request->body['status'] ?? 'Draft',
            'priority' => $request->body['priority'] ?? 'P1',
            'owner_name' => $ownerName !== '' ? $ownerName : 'Unassigned',
            'expected_release_at' => $request->body['expected_release_at'] ?? date('Y-m-d'),
            'description' => $request->body['description'] ?? '',
            'current_stage' => $request->body['current_stage'] ?? 'Drafting',
            'solution_summary' => $request->body['solution_summary'] ?? '',
            'acceptance_criteria' => $request->body['acceptance_criteria'] ?? [],
            'impact_scope' => $request->body['impact_scope'] ?? [],
            'risks' => $request->body['risks'] ?? [],
            'maturity_checks' => $request->body['maturity_checks'] ?? [
                ['key' => 'acceptance', 'label' => 'Acceptance criteria added', 'passed' => false],
                ['key' => 'solution', 'label' => 'Solution summary added', 'passed' => false],
                ['key' => 'impact', 'label' => 'Impact scope defined', 'passed' => false],
                ['key' => 'risk', 'label' => 'Risks captured', 'passed' => false],
                ['key' => 'owner', 'label' => 'Owner assigned', 'passed' => false],
            ],
            'linked_execution_ids' => [],
        ];

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

        $updated = $this->store->update('requirements', $requirementId, $request->body);

        if ($updated === null) {
            return Response::error(404, 'requirement_not_found', [], $request->requestId);
        }

        return Response::success($this->mapDetail($updated, $scope), $request->requestId);
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

        $failedChecks = array_values(array_filter(
            $requirement['maturity_checks'] ?? [],
            static fn (array $item): bool => !($item['passed'] ?? false)
        ));

        if ($failedChecks !== []) {
            return Response::error(422, 'maturity_check_failed', ['failed_checks' => $failedChecks], $request->requestId);
        }

        $updated = $this->store->update('requirements', $requirementId, [
            'status' => 'ToReview',
            'current_stage' => 'Pending review',
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
                'name' => 'Execution - ' . (string) ($requirement['title'] ?? 'Untitled requirement'),
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
            'title' => (string) ($item['title'] ?? ''),
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

        return [
            ...$this->mapSummary($item),
            'description' => $item['description'] ?? '',
            'current_stage' => $item['current_stage'] ?? '',
            'solution_summary' => $item['solution_summary'] ?? '',
            'acceptance_criteria' => $item['acceptance_criteria'] ?? [],
            'impact_scope' => $item['impact_scope'] ?? [],
            'risks' => $item['risks'] ?? [],
            'maturity_checks' => $item['maturity_checks'] ?? [],
            'linked_execution_ids' => $item['linked_execution_ids'] ?? [],
            'linked_execution_names' => array_values(array_map(
                static fn (array $execution): string => (string) ($execution['name'] ?? ''),
                $executions
            )),
            'linked_executions' => $executions,
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

    private function nextId(array $items): int
    {
        $ids = array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items);

        return $ids ? max($ids) + 1 : 1;
    }
}
