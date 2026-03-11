import type {
  BatchSubmitBugsPayload,
  BatchSubmitBugsResult,
  Bug,
  CreateBugPayload,
  CreateDailyTaskPayload,
  CreateExecutionPayload,
  CreateExecutionTaskPayload,
  CreateProjectPayload,
  CreateRequirementPayload,
  CreateSettingsDictionaryPayload,
  CreateSettingsMemberPayload,
  CreateSettingsPolicyPayload,
  CreateSettingsRolePayload,
  CreateSettingsWorkflowPayload,
  CreateWorklogPayload,
  DailyReportDraft,
  DailyTask,
  Execution,
  ExecutionDetail,
  ExecutionScheduleItem,
  ExecutionTask,
  PerformanceDashboard,
  PerformanceMemberRecord,
  PerformanceRange,
  PerformanceSummary,
  Project,
  Requirement,
  RequirementAttachment,
  RequirementDetail,
  RequirementGenerateExecutionPayload,
  RequirementGenerateExecutionResult,
  RequirementReview,
  RequirementReviewPayload,
  SettingsDictionary,
  SettingsMember,
  SettingsPolicy,
  SettingsRole,
  SettingsWorkflow,
  TeamScheduleItem,
  UpdateBugPayload,
  UpdateDailyTaskPayload,
  UpdateExecutionPayload,
  UpdateExecutionTaskPayload,
  UpdateRequirementPayload,
  UpdateSettingsDictionaryPayload,
  UpdateSettingsMemberPayload,
  UpdateSettingsPolicyPayload,
  UpdateSettingsRolePayload,
  UpdateSettingsWorkflowPayload,
  UpdateWorklogPayload,
  WeeklyReportDraft,
  Worklog,
  WorkspaceMemberOverview,
  WorkspaceOverviewMetrics,
  WorkspaceProjectOverview,
  WorkspaceSummary,
} from './types';
import { getAuthToken } from './authToken';

const API_BASE = '/api/v1';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
  request_id: string;
};

export class ApiError extends Error {
  data: unknown;
  status: number;

  constructor(message: string, data: unknown, status: number) {
    super(message);
    this.name = 'ApiError';
    this.data = data;
    this.status = status;
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const normalized = value.replace('T', ' ').replace(/\+\d{2}:\d{2}$/, '');
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer ' + token);
  }

  if (options.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.code !== 0) {
    throw new ApiError(payload.message, payload.data, response.status);
  }

  return payload.data;
}

function mapWorkspaceOverviewMetrics(item: any): WorkspaceOverviewMetrics {
  return {
    projectCount: Number(item?.project_count ?? 0),
    atRiskProjectCount: Number(item?.at_risk_project_count ?? 0),
    memberCount: Number(item?.member_count ?? 0),
    activeMemberCount: Number(item?.active_member_count ?? 0),
    attentionMemberCount: Number(item?.attention_member_count ?? 0),
    openBugCount: Number(item?.open_bug_count ?? 0),
  };
}

function mapWorkspaceProjectOverview(item: any): WorkspaceProjectOverview {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    code: String(item?.code ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    status: item?.status ?? 'Active',
    health: item?.health ?? 'healthy',
    executionCount: Number(item?.execution_count ?? 0),
    activeExecutionCount: Number(item?.active_execution_count ?? 0),
    blockedExecutionCount: Number(item?.blocked_execution_count ?? 0),
    openBugCount: Number(item?.open_bug_count ?? 0),
    riskCount: Number(item?.risk_count ?? 0),
    averageProgress: Number(item?.average_progress ?? 0),
    dueSoonCount: Number(item?.due_soon_count ?? 0),
    overdueCount: Number(item?.overdue_count ?? 0),
    lastActivityAt: formatDateTime(item?.last_activity_at),
  };
}

function mapWorkspaceMemberOverview(item: any): WorkspaceMemberOverview {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    email: String(item?.email ?? ''),
    department: String(item?.department ?? ''),
    title: String(item?.title ?? ''),
    status: item?.status ?? 'Active',
    dingtalkBound: Boolean(item?.dingtalk_bound),
    activeExecutionCount: Number(item?.active_execution_count ?? 0),
    blockedExecutionCount: Number(item?.blocked_execution_count ?? 0),
    pendingDailyTaskCount: Number(item?.pending_daily_task_count ?? 0),
    openBugCount: Number(item?.open_bug_count ?? 0),
    hoursThisWeek: Number(item?.hours_this_week ?? 0),
    lastActivityAt: formatDateTime(item?.last_activity_at),
    focusStatus: item?.focus_status ?? 'idle',
    focusLabel: String(item?.focus_label ?? ''),
  };
}

function mapWorkspaceSummary(item: any): WorkspaceSummary {
  return {
    dashboardMode: item?.dashboard_mode === 'personal' ? 'personal' : 'team',
    myExecutions: Number(item?.my_executions ?? 0),
    dueToday: Number(item?.due_today ?? 0),
    blocked: Number(item?.blocked ?? 0),
    reportsReady: Number(item?.reports_ready ?? 0),
    overview: mapWorkspaceOverviewMetrics(item?.overview),
    projectOverview: Array.isArray(item?.project_overview) ? item.project_overview.map(mapWorkspaceProjectOverview) : [],
    memberOverview: Array.isArray(item?.member_overview) ? item.member_overview.map(mapWorkspaceMemberOverview) : [],
  };
}


function mapPerformanceRange(item: any): PerformanceRange {
  return {
    start: String(item?.start ?? ''),
    end: String(item?.end ?? ''),
    days: Number(item?.days ?? 0),
  };
}

function mapPerformanceSummary(item: any): PerformanceSummary {
  return {
    memberCount: Number(item?.member_count ?? 0),
    completedItemCount: Number(item?.completed_item_count ?? 0),
    overdueItemCount: Number(item?.overdue_item_count ?? 0),
    totalHours: Number(item?.total_hours ?? 0),
    averageScore: Number(item?.average_score ?? 0),
    averageOnTimeRate: Number(item?.average_on_time_rate ?? 0),
    averageUpdateRate: Number(item?.average_update_rate ?? 0),
  };
}

function mapPerformanceMemberRecord(item: any): PerformanceMemberRecord {
  return {
    id: Number(item?.id ?? 0),
    rank: Number(item?.rank ?? 0),
    name: String(item?.name ?? ''),
    email: String(item?.email ?? ''),
    department: String(item?.department ?? ''),
    title: String(item?.title ?? ''),
    status: item?.status ?? 'Active',
    score: Number(item?.score ?? 0),
    level: item?.level ?? 'risk',
    activeProjectCount: Number(item?.active_project_count ?? 0),
    activeExecutionCount: Number(item?.active_execution_count ?? 0),
    dueItemCount: Number(item?.due_item_count ?? 0),
    completedItemCount: Number(item?.completed_item_count ?? 0),
    onTimeCompletedCount: Number(item?.on_time_completed_count ?? 0),
    onTimeRate: Number(item?.on_time_rate ?? 0),
    overdueItemCount: Number(item?.overdue_item_count ?? 0),
    updateDays: Number(item?.update_days ?? 0),
    updateRate: Number(item?.update_rate ?? 0),
    totalHours: Number(item?.total_hours ?? 0),
    averageDailyHours: Number(item?.average_daily_hours ?? 0),
    projectNames: toStringArray(item?.project_names),
  };
}

function mapPerformanceDashboard(item: any): PerformanceDashboard {
  return {
    dashboardMode: item?.dashboard_mode === 'personal' ? 'personal' : 'team',
    range: mapPerformanceRange(item?.range),
    summary: mapPerformanceSummary(item?.summary),
    compareDefaultIds: toNumberArray(item?.compare_default_ids),
    ranking: Array.isArray(item?.ranking) ? item.ranking.map(mapPerformanceMemberRecord) : [],
  };
}
function mapRequirement(item: any): Requirement {
  return {
    id: Number(item?.id ?? 0),
    title: String(item?.title ?? ''),
    status: item?.status ?? 'Draft',
    priority: item?.priority ?? 'P1',
    ownerName: String(item?.owner_name ?? ''),
    expectedReleaseAt: String(item?.expected_release_at ?? ''),
    linkedExecutionCount: Number(item?.linked_execution_count ?? 0),
  };
}

function mapReview(item: any): RequirementReview {
  return {
    id: Number(item?.id ?? 0),
    requirementId: Number(item?.requirement_id ?? 0),
    reviewerName: String(item?.reviewer_name ?? ''),
    result: item?.result ?? 'supplement_required',
    comment: String(item?.comment ?? ''),
    reviewedAt: formatDateTime(item?.reviewed_at),
  };
}

function mapRequirementAttachment(item: any): RequirementAttachment {
  return {
    id: Number(item?.id ?? 0),
    requirementId: Number(item?.requirement_id ?? 0),
    fileName: String(item?.file_name ?? ''),
    fileType: item?.file_type ?? 'other',
    mimeType: String(item?.mime_type ?? ''),
    size: Number(item?.size ?? 0),
    url: String(item?.url ?? ''),
    uploadedAt: formatDateTime(item?.uploaded_at),
  };
}

function mapRequirementDetail(item: any): RequirementDetail {
  const linkedExecutionNames = Array.isArray(item?.linked_execution_names)
    ? item.linked_execution_names.map((entry: unknown) => String(entry))
    : Array.isArray(item?.linked_executions)
      ? item.linked_executions.map((entry: any) => String(entry?.name ?? ''))
      : [];

  return {
    ...mapRequirement(item),
    description: String(item?.description ?? ''),
    currentStage: String(item?.current_stage ?? ''),
    solutionSummary: String(item?.solution_summary ?? ''),
    acceptanceCriteria: toStringArray(item?.acceptance_criteria),
    impactScope: toStringArray(item?.impact_scope),
    risks: toStringArray(item?.risks),
    maturityChecks: Array.isArray(item?.maturity_checks)
      ? item.maturity_checks.map((check: any) => ({
          key: String(check?.key ?? ''),
          label: String(check?.label ?? ''),
          passed: Boolean(check?.passed),
        }))
      : [],
    linkedExecutionIds: toNumberArray(item?.linked_execution_ids),
    linkedExecutionNames,
    attachments: Array.isArray(item?.attachments) ? item.attachments.map(mapRequirementAttachment) : [],
    reviews: Array.isArray(item?.reviews) ? item.reviews.map(mapReview) : [],
  };
}

function mapProject(item: any): Project {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    code: String(item?.code ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    status: item?.status ?? 'Active',
    executionCount: Number(item?.execution_count ?? 0),
    riskCount: Number(item?.risk_count ?? 0),
  };
}

function mapExecution(item: any): Execution {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    projectName: String(item?.project_name ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    status: item?.status ?? 'NotStarted',
    planStart: String(item?.plan_start ?? ''),
    planEnd: String(item?.plan_end ?? ''),
    actualProgress: Number(item?.actual_progress ?? 0),
    planProgress: Number(item?.plan_progress ?? 0),
  };
}

function mapExecutionDetail(item: any): ExecutionDetail {
  return {
    ...mapExecution(item),
    projectId: Number(item?.project_id ?? 0),
    requirementIds: toNumberArray(item?.requirement_ids),
  };
}

function mapTask(item: any): ExecutionTask {
  return {
    id: Number(item?.id ?? 0),
    executionId: Number(item?.execution_id ?? 0),
    name: String(item?.name ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    status: item?.status ?? 'NotStarted',
    actualProgress: Number(item?.actual_progress ?? 0),
  };
}

function mapWorklog(item: any): Worklog {
  return {
    id: Number(item?.id ?? 0),
    executionId: Number(item?.execution_id ?? 0),
    executionName: String(item?.execution_name ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    workDate: String(item?.work_date ?? ''),
    hours: Number(item?.hours ?? 0),
    summary: String(item?.summary ?? ''),
  };
}

function mapTeamScheduleItem(item: any): TeamScheduleItem {
  return {
    ...mapExecution(item),
    projectId: Number(item?.project_id ?? 0),
    requirementIds: toNumberArray(item?.requirement_ids),
  };
}

function mapExecutionScheduleItem(item: any): ExecutionScheduleItem {
  return {
    ...mapTask(item),
    executionName: String(item?.execution_name ?? ''),
    projectName: String(item?.project_name ?? ''),
    planStart: String(item?.plan_start ?? ''),
    planEnd: String(item?.plan_end ?? ''),
  };
}

function mapDailyTask(item: any): DailyTask {
  return {
    id: Number(item?.id ?? 0),
    title: String(item?.title ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    status: item?.status ?? 'NotStarted',
    dueAt: String(item?.due_at ?? ''),
    excludeFromReport: Boolean(item?.exclude_from_report),
  };
}

function mapBug(item: any): Bug {
  return {
    id: Number(item?.id ?? 0),
    title: String(item?.title ?? ''),
    severity: item?.severity ?? 'Medium',
    priority: item?.priority ?? 'P1',
    status: item?.status ?? 'Draft',
    linkType: item?.link_type ?? 'execution',
    linkId: Number(item?.link_id ?? 0),
    linkName: String(item?.link_name ?? ''),
    ownerName: String(item?.owner_name ?? ''),
    reporterName: String(item?.reporter_name ?? ''),
    reproductionSteps: toStringArray(item?.reproduction_steps),
    expectedResult: String(item?.expected_result ?? ''),
    actualResult: String(item?.actual_result ?? ''),
    createdAt: formatDateTime(item?.created_at),
    updatedAt: formatDateTime(item?.updated_at),
    submittedAt: formatDateTime(item?.submitted_at),
  };
}

function mapSettingsMember(item: any): SettingsMember {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    email: String(item?.email ?? ''),
    department: String(item?.department ?? ''),
    title: String(item?.title ?? ''),
    status: item?.status ?? 'Active',
    roles: toStringArray(item?.roles),
    permissionCount: Number(item?.permission_count ?? 0),
    dingtalkBound: Boolean(item?.dingtalk_bound),
    lastLoginAt: formatDateTime(item?.last_login_at),
  };
}

function mapSettingsRole(item: any): SettingsRole {
  return {
    id: Number(item?.id ?? 0),
    key: String(item?.key ?? ''),
    name: String(item?.name ?? ''),
    scope: item?.scope ?? 'org',
    description: String(item?.description ?? ''),
    userCount: Number(item?.user_count ?? 0),
    permissions: toStringArray(item?.permissions),
  };
}

function mapSettingsPolicy(item: any): SettingsPolicy {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    scope: item?.scope ?? 'org',
    description: String(item?.description ?? ''),
    permissions: toStringArray(item?.permissions),
  };
}

function mapSettingsDictionary(item: any): SettingsDictionary {
  return {
    id: Number(item?.id ?? 0),
    key: String(item?.key ?? ''),
    name: String(item?.name ?? ''),
    values: toStringArray(item?.values),
    updatedAt: formatDateTime(item?.updated_at),
  };
}

function mapSettingsWorkflow(item: any): SettingsWorkflow {
  return {
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ''),
    scope: item?.scope ?? 'org',
    stages: toStringArray(item?.stages),
    enabled: Boolean(item?.enabled),
    updatedAt: formatDateTime(item?.updated_at),
  };
}

function mapDailyReport(item: any): DailyReportDraft {
  return {
    generatedAt: formatDateTime(item?.generated_at),
    completed: toStringArray(item?.completed),
    inProgress: toStringArray(item?.in_progress),
    risks: toStringArray(item?.risks),
    nextSteps: toStringArray(item?.next_steps),
  };
}

function mapWeeklyReport(item: any): WeeklyReportDraft {
  return {
    generatedAt: formatDateTime(item?.generated_at),
    summary: String(item?.summary ?? ''),
    completed: toStringArray(item?.completed),
    inProgress: toStringArray(item?.in_progress),
    risks: toStringArray(item?.risks),
    nextWeek: toStringArray(item?.next_week),
    worklogHighlights: toStringArray(item?.worklog_highlights),
    totalHours: Number(item?.total_hours ?? 0),
  };
}

function buildMaturityChecks(payload: CreateRequirementPayload | UpdateRequirementPayload) {
  return [
    { key: 'acceptance', label: '\u5df2\u8865\u5145\u9a8c\u6536\u6807\u51c6', passed: payload.acceptanceCriteria.length > 0 },
    { key: 'solution', label: '\u5df2\u8865\u5145\u65b9\u6848\u6458\u8981', passed: Boolean(payload.solutionSummary.trim()) },
    { key: 'impact', label: '\u5df2\u660e\u786e\u5f71\u54cd\u8303\u56f4', passed: payload.impactScope.length > 0 },
    { key: 'risk', label: '\u5df2\u8bb0\u5f55\u98ce\u9669\u4e0e\u4f9d\u8d56', passed: payload.risks.length > 0 },
    { key: 'owner', label: '\u5df2\u6307\u6d3e\u8d1f\u8d23\u4eba', passed: Boolean(payload.ownerName.trim()) },
  ];
}

function formatRequirementCheckLabel(check: any): string {
  const key = String(check?.key ?? '');
  const label = String(check?.label ?? '');
  const labelMap: Record<string, string> = {
    title: '\u9700\u6c42\u6807\u9898',
    description: '\u9700\u6c42\u80cc\u666f',
    owner: '\u8d1f\u8d23\u4eba',
    release: '\u76ee\u6807\u65e5\u671f',
    solution: '\u65b9\u6848\u6458\u8981',
    acceptance: '\u9a8c\u6536\u6807\u51c6',
    impact: '\u5f71\u54cd\u8303\u56f4',
    risk: '\u98ce\u9669\u4e0e\u4f9d\u8d56',
  };

  return labelMap[key] ?? label;
}
function mapRequirementStage(status: UpdateRequirementPayload['status']): string {
  switch (status) {
    case 'Draft':
      return '\u8349\u7a3f\u6574\u7406';
    case 'Understanding':
      return '\u9700\u6c42\u6f84\u6e05';
    case 'Confirmed':
      return '\u5df2\u786e\u8ba4';
    case 'ToReview':
      return '\u5f85\u8bc4\u5ba1';
    case 'Reviewed':
      return '\u5df2\u8bc4\u5ba1';
    case 'Scheduled':
      return '\u5df2\u6392\u671f';
    case 'InDevelopment':
      return '\u5f00\u53d1\u4e2d';
    default:
      return '\u8349\u7a3f\u6574\u7406';
  }
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === 'maturity_check_failed') {
      const failedChecks = Array.isArray((error.data as any)?.failed_checks)
        ? (error.data as any).failed_checks.map((item: any) => formatRequirementCheckLabel(item)).filter(Boolean)
        : [];

      if (failedChecks.length > 0) {
        return '\u6210\u719f\u5ea6\u68c0\u67e5\u672a\u901a\u8fc7\uff1a' + failedChecks.join('\u3001');
      }

      return '\u6210\u719f\u5ea6\u68c0\u67e5\u672a\u901a\u8fc7\uff0c\u8bf7\u8865\u5145\u5fc5\u8981\u4fe1\u606f\u540e\u91cd\u8bd5\u3002';
    }

    if (error.message === 'forbidden') {
      const requiredPermission = String((error.data as any)?.required_permission ?? '').trim();
      return requiredPermission ? '\u7f3a\u5c11\u6743\u9650\uff1a' + requiredPermission : '\u6ca1\u6709\u8bbf\u95ee\u6743\u9650\u3002';
    }

    if (error.message === 'unauthorized') {
      return '\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002';
    }

    const friendlyMessages: Record<string, string> = {
      role_not_found: '\u89d2\u8272\u6a21\u677f\u4e0d\u5b58\u5728\u3002',
      role_in_use: '\u8be5\u89d2\u8272\u6a21\u677f\u4ecd\u88ab\u6210\u5458\u4f7f\u7528\uff0c\u6682\u65f6\u4e0d\u80fd\u5220\u9664\u3002',
      policy_not_found: '\u7b56\u7565\u5305\u4e0d\u5b58\u5728\u3002',
      dictionary_not_found: '\u5171\u4eab\u5b57\u5178\u4e0d\u5b58\u5728\u3002',
      dictionary_locked: '\u7cfb\u7edf\u5185\u7f6e\u5b57\u5178\u4e0d\u652f\u6301\u5220\u9664\u3002',
      workflow_not_found: '\u6d41\u7a0b\u6a21\u677f\u4e0d\u5b58\u5728\u3002',
      attachment_missing: '\u8bf7\u5148\u9009\u62e9\u8981\u4e0a\u4f20\u7684\u6587\u4ef6\u3002',
      attachment_upload_failed: '\u6587\u4ef6\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002',
      attachment_empty: '\u4e0a\u4f20\u7684\u6587\u4ef6\u5185\u5bb9\u4e3a\u7a7a\u3002',
      attachment_too_large: '\u9644\u4ef6\u4e0d\u80fd\u8d85\u8fc7 20MB\u3002',
      attachment_type_not_supported: '\u53ea\u652f\u6301\u4e0a\u4f20\u56fe\u7247\u6216\u97f3\u9891\u6587\u4ef6\u3002',
      attachment_storage_failed: '\u9644\u4ef6\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
    };
    const friendlyMessage = friendlyMessages[error.message];
    if (friendlyMessage) {
      return friendlyMessage;
    }

    return error.message.replace(/_/g, ' ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '\u8bf7\u6c42\u5931\u8d25\u3002';
}

export const pmApi = {
  async getWorkspaceSummary(): Promise<WorkspaceSummary> {
    const data = await request<any>('/system/summary');
    return mapWorkspaceSummary(data);
  },
  async getPerformanceDashboard(range: { start: string; end: string }): Promise<PerformanceDashboard> {
    const search = new URLSearchParams({ start: range.start, end: range.end });
    const data = await request<any>(`/performance/members?${search.toString()}`);
    return mapPerformanceDashboard(data);
  },
  async getRequirements(): Promise<Requirement[]> {
    const data = await request<any>('/requirements');
    return Array.isArray(data?.items) ? data.items.map(mapRequirement) : [];
  },
  async getRequirementDetail(id: number): Promise<RequirementDetail | null> {
    const data = await request<any>(`/requirements/${id}`);
    return data ? mapRequirementDetail(data) : null;
  },
  async createRequirement(payload: CreateRequirementPayload): Promise<RequirementDetail> {
    const data = await request<any>('/requirements', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        priority: payload.priority,
        owner_name: payload.ownerName,
        expected_release_at: payload.expectedReleaseAt,
        description: payload.description,
        current_stage: 'Drafting',
        solution_summary: payload.solutionSummary,
        acceptance_criteria: payload.acceptanceCriteria,
        impact_scope: payload.impactScope,
        risks: payload.risks,
        maturity_checks: buildMaturityChecks(payload),
      }),
    });

    return mapRequirementDetail(data);
  },
  async updateRequirement(id: number, payload: UpdateRequirementPayload): Promise<RequirementDetail> {
    const data = await request<any>(`/requirements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: payload.title,
        status: payload.status,
        priority: payload.priority,
        owner_name: payload.ownerName,
        expected_release_at: payload.expectedReleaseAt,
        description: payload.description,
        current_stage: mapRequirementStage(payload.status),
        solution_summary: payload.solutionSummary,
        acceptance_criteria: payload.acceptanceCriteria,
        impact_scope: payload.impactScope,
        risks: payload.risks,
        maturity_checks: buildMaturityChecks(payload),
      }),
    });

    return mapRequirementDetail(data);
  },
  async submitRequirementForReview(id: number): Promise<RequirementDetail> {
    const data = await request<any>(`/requirements/${id}/actions/submit-review`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return mapRequirementDetail(data);
  },
  async createRequirementReview(id: number, payload: RequirementReviewPayload): Promise<RequirementReview> {
    const data = await request<any>(`/requirements/${id}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        reviewer_name: payload.reviewerName,
        result: payload.result,
        comment: payload.comment,
      }),
    });

    return mapReview(data);
  },
  async uploadRequirementAttachment(id: number, file: File): Promise<RequirementAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    const data = await request<any>(`/requirements/${id}/attachments`, {
      method: 'POST',
      body: formData,
    });

    return mapRequirementAttachment(data);
  },
  async batchGenerateExecutions(
    payload: RequirementGenerateExecutionPayload,
  ): Promise<RequirementGenerateExecutionResult> {
    const data = await request<any>('/requirements/batch-generate-executions', {
      method: 'POST',
      body: JSON.stringify({
        requirement_ids: payload.requirementIds,
        project_id: payload.projectId,
        project_name: payload.projectName,
        plan_start: payload.planStart,
        plan_end: payload.planEnd,
      }),
    });

    return {
      items: Array.isArray(data?.items) ? data.items.map(mapExecution) : [],
      skippedRequirementIds: toNumberArray(data?.skipped_requirement_ids),
    };
  },
  async getProjects(): Promise<Project[]> {
    const data = await request<any>('/projects');
    return Array.isArray(data?.items) ? data.items.map(mapProject) : [];
  },
  async createProject(payload: CreateProjectPayload): Promise<Project> {
    const data = await request<any>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        code: payload.code,
        owner_name: payload.ownerName,
        status: payload.status,
      }),
    });

    return mapProject(data);
  },
  async getExecutions(): Promise<Execution[]> {
    const data = await request<any>('/executions');
    return Array.isArray(data?.items) ? data.items.map(mapExecution) : [];
  },
  async getExecutionDetail(id: number): Promise<ExecutionDetail | null> {
    const data = await request<any>(`/executions/${id}`);
    return data ? mapExecutionDetail(data) : null;
  },
  async createExecution(payload: CreateExecutionPayload): Promise<ExecutionDetail> {
    const data = await request<any>('/executions', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        project_id: payload.projectId,
        project_name: payload.projectName,
        owner_name: payload.ownerName,
        status: payload.status,
        plan_start: payload.planStart,
        plan_end: payload.planEnd,
        actual_progress: 0,
        plan_progress: 0,
      }),
    });

    return mapExecutionDetail(data);
  },
  async updateExecution(id: number, payload: UpdateExecutionPayload): Promise<ExecutionDetail> {
    const data = await request<any>(`/executions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        owner_name: payload.ownerName,
        status: payload.status,
        plan_start: payload.planStart,
        plan_end: payload.planEnd,
        actual_progress: payload.actualProgress,
        plan_progress: payload.planProgress,
      }),
    });

    return mapExecutionDetail(data);
  },
  async getExecutionTasks(executionId: number): Promise<ExecutionTask[]> {
    const data = await request<any>(`/executions/${executionId}/tasks`);
    return Array.isArray(data?.items) ? data.items.map(mapTask) : [];
  },
  async createExecutionTask(payload: CreateExecutionTaskPayload): Promise<ExecutionTask> {
    const data = await request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        execution_id: payload.executionId,
        name: payload.name,
        owner_name: payload.ownerName,
        status: payload.status,
        actual_progress: payload.actualProgress,
      }),
    });

    return mapTask(data);
  },
  async updateExecutionTask(id: number, payload: UpdateExecutionTaskPayload): Promise<ExecutionTask> {
    const data = await request<any>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        owner_name: payload.ownerName,
        status: payload.status,
        actual_progress: payload.actualProgress,
      }),
    });

    return mapTask(data);
  },
  async getExecutionWorklogs(executionId: number): Promise<Worklog[]> {
    const data = await request<any>(`/executions/${executionId}/worklogs`);
    return Array.isArray(data?.items) ? data.items.map(mapWorklog) : [];
  },
  async createWorklog(payload: CreateWorklogPayload): Promise<Worklog> {
    const data = await request<any>('/worklogs', {
      method: 'POST',
      body: JSON.stringify({
        execution_id: payload.executionId,
        owner_name: payload.ownerName,
        work_date: payload.workDate,
        hours: payload.hours,
        summary: payload.summary,
      }),
    });

    return mapWorklog(data);
  },
  async updateWorklog(id: number, payload: UpdateWorklogPayload): Promise<Worklog> {
    const data = await request<any>(`/worklogs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        execution_id: payload.executionId,
        owner_name: payload.ownerName,
        work_date: payload.workDate,
        hours: payload.hours,
        summary: payload.summary,
      }),
    });

    return mapWorklog(data);
  },
  async getDailyTasks(): Promise<DailyTask[]> {
    const data = await request<any>('/daily-tasks');
    return Array.isArray(data?.items) ? data.items.map(mapDailyTask) : [];
  },
  async createDailyTask(payload: CreateDailyTaskPayload): Promise<DailyTask> {
    const data = await request<any>('/daily-tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        owner_name: payload.ownerName,
        status: payload.status,
        due_at: payload.dueAt,
        exclude_from_report: payload.excludeFromReport,
      }),
    });

    return mapDailyTask(data);
  },
  async updateDailyTask(id: number, payload: UpdateDailyTaskPayload): Promise<DailyTask> {
    const data = await request<any>(`/daily-tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: payload.title,
        owner_name: payload.ownerName,
        status: payload.status,
        due_at: payload.dueAt,
        exclude_from_report: payload.excludeFromReport,
      }),
    });

    return mapDailyTask(data);
  },
  async getBugs(): Promise<Bug[]> {
    const data = await request<any>('/bugs');
    return Array.isArray(data?.items) ? data.items.map(mapBug) : [];
  },
  async getBugDetail(id: number): Promise<Bug | null> {
    const data = await request<any>(`/bugs/${id}`);
    return data ? mapBug(data) : null;
  },
  async createBug(payload: CreateBugPayload): Promise<Bug> {
    const data = await request<any>('/bugs', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        severity: payload.severity,
        priority: payload.priority,
        status: payload.status,
        link_type: payload.linkType,
        link_id: payload.linkId,
        link_name: payload.linkName,
        owner_name: payload.ownerName,
        reporter_name: payload.reporterName,
        reproduction_steps: payload.reproductionSteps,
        expected_result: payload.expectedResult,
        actual_result: payload.actualResult,
      }),
    });

    return mapBug(data);
  },
  async updateBug(id: number, payload: UpdateBugPayload): Promise<Bug> {
    const data = await request<any>(`/bugs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: payload.title,
        severity: payload.severity,
        priority: payload.priority,
        status: payload.status,
        link_type: payload.linkType,
        link_id: payload.linkId,
        link_name: payload.linkName,
        owner_name: payload.ownerName,
        reporter_name: payload.reporterName,
        reproduction_steps: payload.reproductionSteps,
        expected_result: payload.expectedResult,
        actual_result: payload.actualResult,
      }),
    });

    return mapBug(data);
  },
  async batchSubmitBugs(payload: BatchSubmitBugsPayload): Promise<BatchSubmitBugsResult> {
    const data = await request<any>('/bugs/batch-submit', {
      method: 'POST',
      body: JSON.stringify({ bug_ids: payload.bugIds }),
    });

    return {
      items: Array.isArray(data?.items) ? data.items.map(mapBug) : [],
      skippedBugIds: toNumberArray(data?.skipped_bug_ids),
    };
  },
  async getSettingsMembers(): Promise<SettingsMember[]> {
    const data = await request<any>('/settings/members');
    return Array.isArray(data?.items) ? data.items.map(mapSettingsMember) : [];
  },
  async createSettingsMember(payload: CreateSettingsMemberPayload): Promise<SettingsMember> {
    const data = await request<any>('/settings/members', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        department: payload.department,
        title: payload.title,
        status: payload.status,
        roles: payload.roles,
        dingtalk_bound: payload.dingtalkBound,
      }),
    });

    return mapSettingsMember(data);
  },
  async updateSettingsMember(id: number, payload: UpdateSettingsMemberPayload): Promise<SettingsMember> {
    const data = await request<any>(`/settings/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        department: payload.department,
        title: payload.title,
        status: payload.status,
        roles: payload.roles,
        dingtalk_bound: payload.dingtalkBound,
      }),
    });

    return mapSettingsMember(data);
  },
  async getSettingsRoles(): Promise<SettingsRole[]> {
    const data = await request<any>('/settings/roles');
    return Array.isArray(data?.items) ? data.items.map(mapSettingsRole) : [];
  },
  async createSettingsRole(payload: CreateSettingsRolePayload): Promise<SettingsRole> {
    const data = await request<any>('/settings/roles', {
      method: 'POST',
      body: JSON.stringify({
        key: payload.key,
        name: payload.name,
        scope: payload.scope,
        description: payload.description,
        permissions: payload.permissions,
      }),
    });

    return mapSettingsRole(data);
  },
  async deleteSettingsRole(id: number): Promise<void> {
    await request<any>(`/settings/roles/${id}`, {
      method: 'DELETE',
    });
  },
  async updateSettingsRole(id: number, payload: UpdateSettingsRolePayload): Promise<SettingsRole> {
    const data = await request<any>(`/settings/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        scope: payload.scope,
        description: payload.description,
        permissions: payload.permissions,
      }),
    });

    return mapSettingsRole(data);
  },
  async getSettingsPolicies(): Promise<SettingsPolicy[]> {
    const data = await request<any>('/settings/policies');
    return Array.isArray(data?.items) ? data.items.map(mapSettingsPolicy) : [];
  },
  async createSettingsPolicy(payload: CreateSettingsPolicyPayload): Promise<SettingsPolicy> {
    const data = await request<any>('/settings/policies', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        scope: payload.scope,
        description: payload.description,
        permissions: payload.permissions,
      }),
    });

    return mapSettingsPolicy(data);
  },
  async deleteSettingsPolicy(id: number): Promise<void> {
    await request<any>(`/settings/policies/${id}`, {
      method: 'DELETE',
    });
  },
  async updateSettingsPolicy(id: number, payload: UpdateSettingsPolicyPayload): Promise<SettingsPolicy> {
    const data = await request<any>(`/settings/policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        scope: payload.scope,
        description: payload.description,
        permissions: payload.permissions,
      }),
    });

    return mapSettingsPolicy(data);
  },
  async getSettingsDictionaries(): Promise<SettingsDictionary[]> {
    const data = await request<any>('/settings/dictionaries');
    return Array.isArray(data?.items) ? data.items.map(mapSettingsDictionary) : [];
  },
  async createSettingsDictionary(payload: CreateSettingsDictionaryPayload): Promise<SettingsDictionary> {
    const data = await request<any>('/settings/dictionaries', {
      method: 'POST',
      body: JSON.stringify({
        key: payload.key,
        name: payload.name,
        values: payload.values,
      }),
    });

    return mapSettingsDictionary(data);
  },
  async deleteSettingsDictionary(id: number): Promise<void> {
    await request<any>(`/settings/dictionaries/${id}`, {
      method: 'DELETE',
    });
  },
  async updateSettingsDictionary(id: number, payload: UpdateSettingsDictionaryPayload): Promise<SettingsDictionary> {
    const data = await request<any>(`/settings/dictionaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        values: payload.values,
      }),
    });

    return mapSettingsDictionary(data);
  },
  async getSettingsWorkflows(): Promise<SettingsWorkflow[]> {
    const data = await request<any>('/settings/workflows');
    return Array.isArray(data?.items) ? data.items.map(mapSettingsWorkflow) : [];
  },
  async createSettingsWorkflow(payload: CreateSettingsWorkflowPayload): Promise<SettingsWorkflow> {
    const data = await request<any>('/settings/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        scope: payload.scope,
        stages: payload.stages,
        enabled: payload.enabled,
      }),
    });

    return mapSettingsWorkflow(data);
  },
  async deleteSettingsWorkflow(id: number): Promise<void> {
    await request<any>(`/settings/workflows/${id}`, {
      method: 'DELETE',
    });
  },
  async updateSettingsWorkflow(id: number, payload: UpdateSettingsWorkflowPayload): Promise<SettingsWorkflow> {
    const data = await request<any>(`/settings/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        scope: payload.scope,
        stages: payload.stages,
        enabled: payload.enabled,
      }),
    });

    return mapSettingsWorkflow(data);
  },
  async getTeamSchedule(): Promise<TeamScheduleItem[]> {
    const data = await request<any>('/schedules/team-gantt');
    return Array.isArray(data?.items) ? data.items.map(mapTeamScheduleItem) : [];
  },
  async getExecutionSchedule(): Promise<ExecutionScheduleItem[]> {
    const data = await request<any>('/schedules/execution-gantt');
    return Array.isArray(data?.items) ? data.items.map(mapExecutionScheduleItem) : [];
  },
  async generateDailyReport(): Promise<DailyReportDraft> {
    const data = await request<any>('/reports/daily/generate', { method: 'POST' });
    return mapDailyReport(data);
  },
  async generateWeeklyReport(): Promise<WeeklyReportDraft> {
    const data = await request<any>('/reports/weekly/generate', { method: 'POST' });
    return mapWeeklyReport(data);
  },
};

