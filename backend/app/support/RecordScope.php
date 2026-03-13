<?php

declare(strict_types=1);

namespace App\Support;

final class RecordScope
{
    private StoreRegistry $store;
    private ?array $currentUser;
    private array $roleMap;

    /** @var array<string, array<int, bool>>|null */
    private ?array $accessMap = null;

    public function __construct(
        private readonly ApiContext $request,
        ?StoreRegistry $store = null,
    ) {
        $this->store = $store ?? app(StoreRegistry::class);
        $this->currentUser = Auth::currentUser($request);
        $this->roleMap = [];

        foreach ($this->store->allRoles() as $role) {
            $key = trim((string) ($role['key'] ?? ''));
            if ($key !== '') {
                $this->roleMap[$key] = $role;
            }
        }
    }

    public function currentUserName(): string
    {
        return (string) ($this->currentUser['name'] ?? '');
    }

    public function isOrgScope(): bool
    {
        foreach ($this->currentRoles() as $roleKey) {
            if ((string) ($this->roleMap[$roleKey]['scope'] ?? '') === 'org') {
                return true;
            }
        }

        return false;
    }

    public function hasProjectScope(): bool
    {
        foreach ($this->currentRoles() as $roleKey) {
            if ((string) ($this->roleMap[$roleKey]['scope'] ?? '') === 'project') {
                return true;
            }
        }

        return false;
    }

    public function filterProjects(array $items): array
    {
        return $this->filterByAccess($items, 'projects');
    }

    public function filterRequirements(array $items): array
    {
        return $this->filterByAccess($items, 'requirements');
    }

    public function filterExecutions(array $items): array
    {
        return $this->filterByAccess($items, 'executions');
    }

    public function filterTasks(array $items): array
    {
        return $this->filterByAccess($items, 'tasks');
    }

    public function filterWorklogs(array $items): array
    {
        return $this->filterByAccess($items, 'worklogs');
    }

    public function filterDailyTasks(array $items): array
    {
        return $this->filterByAccess($items, 'daily_tasks');
    }

    public function filterBugs(array $items): array
    {
        return $this->filterByAccess($items, 'bugs');
    }

    public function canAccessProject(array $item): bool
    {
        return $this->allows('projects', (int) ($item['id'] ?? 0));
    }

    public function canAccessProjectId(int $projectId): bool
    {
        return $this->allows('projects', $projectId);
    }

    public function canAccessRequirement(array $item): bool
    {
        return $this->allows('requirements', (int) ($item['id'] ?? 0));
    }

    public function canAccessRequirementId(int $requirementId): bool
    {
        return $this->allows('requirements', $requirementId);
    }

    public function canAccessExecution(array $item): bool
    {
        return $this->allows('executions', (int) ($item['id'] ?? 0));
    }

    public function canAccessExecutionId(int $executionId): bool
    {
        return $this->allows('executions', $executionId);
    }

    public function canAccessTask(array $item): bool
    {
        return $this->allows('tasks', (int) ($item['id'] ?? 0));
    }

    public function canAccessTaskId(int $taskId): bool
    {
        return $this->allows('tasks', $taskId);
    }

    public function canAccessWorklog(array $item): bool
    {
        return $this->allows('worklogs', (int) ($item['id'] ?? 0));
    }

    public function canAccessWorklogId(int $worklogId): bool
    {
        return $this->allows('worklogs', $worklogId);
    }

    public function canAccessDailyTask(array $item): bool
    {
        return $this->allows('daily_tasks', (int) ($item['id'] ?? 0));
    }

    public function canAccessDailyTaskId(int $dailyTaskId): bool
    {
        return $this->allows('daily_tasks', $dailyTaskId);
    }

    public function canAccessBug(array $item): bool
    {
        return $this->allows('bugs', (int) ($item['id'] ?? 0));
    }

    public function canAccessBugId(int $bugId): bool
    {
        return $this->allows('bugs', $bugId);
    }

    public function ensureCurrentUserField(string $value, string $field, string $resource, string $requestId, int $resourceId = 0): ?\think\Response
    {
        if ($this->isOrgScope() || $this->matchesCurrentUser($value)) {
            return null;
        }

        $data = [
            'resource' => $resource,
            'field' => $field,
        ];

        if ($resourceId > 0) {
            $data['resource_id'] = $resourceId;
        }

        return ApiResponder::error(403, 'scope_forbidden', $data, $requestId);
    }

    public function scopeDenied(string $resource, string $requestId, int $resourceId = 0): \think\Response
    {
        $data = ['resource' => $resource];

        if ($resourceId > 0) {
            $data['resource_id'] = $resourceId;
        }

        return ApiResponder::error(403, 'scope_forbidden', $data, $requestId);
    }

    /**
     * @return array<string, array<int, bool>>
     */
    private function accessMap(): array
    {
        if ($this->accessMap !== null) {
            return $this->accessMap;
        }

        $collections = [
            'projects' => $this->store->allProjects(),
            'requirements' => $this->store->allRequirements(),
            'executions' => $this->store->allExecutions(),
            'tasks' => $this->store->allTasks(),
            'worklogs' => $this->store->allWorklogs(),
            'daily_tasks' => $this->store->allDailyTasks(),
            'bugs' => $this->store->allBugs(),
        ];

        if ($this->isOrgScope()) {
            $this->accessMap = [];

            foreach ($collections as $key => $items) {
                $this->accessMap[$key] = [];
                foreach ($items as $item) {
                    $id = (int) ($item['id'] ?? 0);
                    if ($id > 0) {
                        $this->accessMap[$key][$id] = true;
                    }
                }
            }

            return $this->accessMap;
        }

        $map = [
            'projects' => [],
            'requirements' => [],
            'executions' => [],
            'tasks' => [],
            'worklogs' => [],
            'daily_tasks' => [],
            'bugs' => [],
        ];

        if ($this->canUseProjects()) {
            foreach ($collections['projects'] as $project) {
                if ($this->matchesCurrentUser((string) ($project['owner_name'] ?? ''))) {
                    $map['projects'][(int) ($project['id'] ?? 0)] = true;
                }
            }
        }

        if ($this->canUseRequirements()) {
            foreach ($collections['requirements'] as $requirement) {
                if ($this->matchesCurrentUser((string) ($requirement['owner_name'] ?? ''))) {
                    $map['requirements'][(int) ($requirement['id'] ?? 0)] = true;
                }
            }
        }

        if ($this->canUseExecutions()) {
            foreach ($collections['executions'] as $execution) {
                if ($this->matchesCurrentUser((string) ($execution['owner_name'] ?? ''))) {
                    $map['executions'][(int) ($execution['id'] ?? 0)] = true;
                }
            }
        }

        if ($this->canUseTasks()) {
            foreach ($collections['tasks'] as $task) {
                if ($this->matchesCurrentUser((string) ($task['owner_name'] ?? ''))) {
                    $map['tasks'][(int) ($task['id'] ?? 0)] = true;
                }
            }
        }

        if ($this->canUseWorklogs()) {
            foreach ($collections['worklogs'] as $worklog) {
                if ($this->matchesCurrentUser((string) ($worklog['owner_name'] ?? ''))) {
                    $map['worklogs'][(int) ($worklog['id'] ?? 0)] = true;
                }
            }
        }

        if ($this->canUseDailyTasks()) {
            foreach ($collections['daily_tasks'] as $dailyTask) {
                if ($this->matchesCurrentUser((string) ($dailyTask['owner_name'] ?? ''))) {
                    $map['daily_tasks'][(int) ($dailyTask['id'] ?? 0)] = true;
                }
            }
        }

        if ($this->canUseBugs()) {
            foreach ($collections['bugs'] as $bug) {
                if (
                    $this->matchesCurrentUser((string) ($bug['owner_name'] ?? ''))
                    || $this->matchesCurrentUser((string) ($bug['reporter_name'] ?? ''))
                ) {
                    $map['bugs'][(int) ($bug['id'] ?? 0)] = true;
                }
            }
        }

        do {
            $changed = false;

            if ($this->canUseExecutions()) {
                foreach ($collections['executions'] as $execution) {
                    $executionId = (int) ($execution['id'] ?? 0);
                    if ($executionId <= 0 || isset($map['executions'][$executionId])) {
                        continue;
                    }

                    $requirementIds = array_map('intval', is_array($execution['requirement_ids'] ?? null) ? $execution['requirement_ids'] : []);
                    $projectId = (int) ($execution['project_id'] ?? 0);

                    if (
                        ($this->hasProjectScope() && $this->canUseProjects() && isset($map['projects'][$projectId]))
                        || ($this->canUseRequirements() && $this->intersects($requirementIds, $map['requirements']))
                        || $this->executionHasAccessibleArtifacts($executionId, $collections, $map)
                    ) {
                        $map['executions'][$executionId] = true;
                        $changed = true;
                    }
                }
            }

            if ($this->canUseProjects()) {
                foreach ($collections['projects'] as $project) {
                    $projectId = (int) ($project['id'] ?? 0);
                    if ($projectId <= 0 || isset($map['projects'][$projectId])) {
                        continue;
                    }

                    if (
                        $this->projectHasAccessibleExecutions($projectId, $collections['executions'], $map)
                        || ($this->canUseBugs() && $this->projectHasAccessibleBugs($projectId, $collections['bugs'], $collections['executions'], $map))
                    ) {
                        $map['projects'][$projectId] = true;
                        $changed = true;
                    }
                }
            }

            if ($this->canUseRequirements()) {
                foreach ($collections['requirements'] as $requirement) {
                    $requirementId = (int) ($requirement['id'] ?? 0);
                    if ($requirementId <= 0 || isset($map['requirements'][$requirementId])) {
                        continue;
                    }

                    $linkedExecutionIds = array_map('intval', is_array($requirement['linked_execution_ids'] ?? null) ? $requirement['linked_execution_ids'] : []);
                    if ($this->intersects($linkedExecutionIds, $map['executions'])) {
                        $map['requirements'][$requirementId] = true;
                        $changed = true;
                    }
                }
            }

            if ($this->canUseTasks()) {
                foreach ($collections['tasks'] as $task) {
                    $taskId = (int) ($task['id'] ?? 0);
                    if ($taskId <= 0 || isset($map['tasks'][$taskId])) {
                        continue;
                    }

                    if (isset($map['executions'][(int) ($task['execution_id'] ?? 0)])) {
                        $map['tasks'][$taskId] = true;
                        $changed = true;
                    }
                }
            }

            if ($this->canUseWorklogs()) {
                foreach ($collections['worklogs'] as $worklog) {
                    $worklogId = (int) ($worklog['id'] ?? 0);
                    if ($worklogId <= 0 || isset($map['worklogs'][$worklogId])) {
                        continue;
                    }

                    if (isset($map['executions'][(int) ($worklog['execution_id'] ?? 0)])) {
                        $map['worklogs'][$worklogId] = true;
                        $changed = true;
                    }
                }
            }

            if ($this->canUseBugs()) {
                foreach ($collections['bugs'] as $bug) {
                    $bugId = (int) ($bug['id'] ?? 0);
                    if ($bugId <= 0 || isset($map['bugs'][$bugId])) {
                        continue;
                    }

                    $linkType = (string) ($bug['link_type'] ?? 'execution');
                    $linkId = (int) ($bug['link_id'] ?? 0);

                    if (
                        ($linkType === 'project' && isset($map['projects'][$linkId]))
                        || ($linkType === 'execution' && isset($map['executions'][$linkId]))
                    ) {
                        $map['bugs'][$bugId] = true;
                        $changed = true;
                    }
                }
            }
        } while ($changed);

        $this->accessMap = $map;

        return $this->accessMap;
    }

    private function filterByAccess(array $items, string $resource): array
    {
        if ($this->isOrgScope()) {
            return array_values($items);
        }

        return array_values(array_filter($items, function (array $item) use ($resource): bool {
            return $this->allows($resource, (int) ($item['id'] ?? 0));
        }));
    }

    private function allows(string $resource, int $id): bool
    {
        if ($id <= 0) {
            return false;
        }

        if ($this->isOrgScope()) {
            return true;
        }

        return isset($this->accessMap()[$resource][$id]);
    }

    private function executionHasAccessibleArtifacts(int $executionId, array $collections, array $map): bool
    {
        if ($this->canUseTasks()) {
            foreach ($collections['tasks'] as $task) {
                if (
                    (int) ($task['execution_id'] ?? 0) === $executionId
                    && isset($map['tasks'][(int) ($task['id'] ?? 0)])
                ) {
                    return true;
                }
            }
        }

        if ($this->canUseWorklogs()) {
            foreach ($collections['worklogs'] as $worklog) {
                if (
                    (int) ($worklog['execution_id'] ?? 0) === $executionId
                    && isset($map['worklogs'][(int) ($worklog['id'] ?? 0)])
                ) {
                    return true;
                }
            }
        }

        if ($this->canUseBugs()) {
            foreach ($collections['bugs'] as $bug) {
                if (
                    (string) ($bug['link_type'] ?? '') === 'execution'
                    && (int) ($bug['link_id'] ?? 0) === $executionId
                    && isset($map['bugs'][(int) ($bug['id'] ?? 0)])
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private function projectHasAccessibleExecutions(int $projectId, array $executions, array $map): bool
    {
        foreach ($executions as $execution) {
            if (
                (int) ($execution['project_id'] ?? 0) === $projectId
                && isset($map['executions'][(int) ($execution['id'] ?? 0)])
            ) {
                return true;
            }
        }

        return false;
    }

    private function projectHasAccessibleBugs(int $projectId, array $bugs, array $executions, array $map): bool
    {
        foreach ($bugs as $bug) {
            $bugId = (int) ($bug['id'] ?? 0);
            if (!isset($map['bugs'][$bugId])) {
                continue;
            }

            $linkType = (string) ($bug['link_type'] ?? '');
            $linkId = (int) ($bug['link_id'] ?? 0);

            if ($linkType === 'project' && $linkId === $projectId) {
                return true;
            }

            if ($linkType !== 'execution') {
                continue;
            }

            foreach ($executions as $execution) {
                if ((int) ($execution['id'] ?? 0) !== $linkId) {
                    continue;
                }

                if ((int) ($execution['project_id'] ?? 0) === $projectId) {
                    return true;
                }

                break;
            }
        }

        return false;
    }

    /**
     * @param array<int, bool> $access
     */
    private function intersects(array $ids, array $access): bool
    {
        foreach ($ids as $id) {
            if (isset($access[(int) $id])) {
                return true;
            }
        }

        return false;
    }

    private function matchesCurrentUser(string $value): bool
    {
        $currentUserName = $this->normalizeName($this->currentUserName());

        return $currentUserName !== '' && $currentUserName === $this->normalizeName($value);
    }

    private function normalizeName(string $value): string
    {
        return strtolower(preg_replace('/\s+/', '', trim($value)) ?? '');
    }

    private function canUseProjects(): bool
    {
        return $this->hasAnyPermission(['project.view.related', 'project.create.org']);
    }

    private function canUseRequirements(): bool
    {
        return $this->hasAnyPermission([
            'requirement.view.related',
            'requirement.create.project',
            'requirement.review.create.project',
            'requirement.execution.generate.project',
        ]);
    }

    private function canUseExecutions(): bool
    {
        return $this->hasAnyPermission(['execution.view.related', 'execution.create.project', 'execution.task.update.related']);
    }

    private function canUseTasks(): bool
    {
        return $this->hasAnyPermission(['execution.task.update.related', 'execution.view.related']);
    }

    private function canUseWorklogs(): bool
    {
        return $this->hasAnyPermission(['worklog.view.related', 'worklog.create.self', 'worklog.update.self']);
    }

    private function canUseDailyTasks(): bool
    {
        return $this->hasAnyPermission(['daily_task.view.self', 'daily_task.create.self', 'daily_task.update.self']);
    }

    private function canUseBugs(): bool
    {
        return $this->hasAnyPermission(['bug.view.related', 'bug.create.related', 'bug.update.related', 'bug.submit.related']);
    }

    private function hasAnyPermission(array $expected): bool
    {
        $permissions = $this->currentPermissions();
        foreach ($expected as $permission) {
            if (in_array($permission, $permissions, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return string[]
     */
    private function currentRoles(): array
    {
        return array_values(array_map(
            static fn ($item): string => (string) $item,
            is_array($this->currentUser['roles'] ?? null) ? $this->currentUser['roles'] : []
        ));
    }

    /**
     * @return string[]
     */
    private function currentPermissions(): array
    {
        return array_values(array_map(
            static fn ($item): string => (string) $item,
            is_array($this->currentUser['permissions'] ?? null) ? $this->currentUser['permissions'] : []
        ));
    }
}