export type RequirementStatus =
  | 'Draft'
  | 'Understanding'
  | 'Confirmed'
  | 'ToReview'
  | 'Reviewed'
  | 'Scheduled'
  | 'InDevelopment';

export type ExecutionStatus =
  | 'NotStarted'
  | 'InProgress'
  | 'Blocked'
  | 'ToVerify'
  | 'Done'
  | 'Closed';

export type DailyTaskStatus = 'NotStarted' | 'InProgress' | 'Blocked' | 'Done';

export type BugStatus = 'Draft' | 'Open' | 'InProgress' | 'Resolved' | 'Closed';
export type BugSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type BugLinkType = 'project' | 'execution';

export type ReviewResult = 'approved' | 'rejected' | 'delayed' | 'supplement_required';

export interface WorkspaceSummary {
  myExecutions: number;
  dueToday: number;
  blocked: number;
  reportsReady: number;
}

export interface Requirement {
  id: number;
  title: string;
  status: RequirementStatus;
  priority: 'P0' | 'P1' | 'P2';
  ownerName: string;
  expectedReleaseAt: string;
  linkedExecutionCount: number;
}

export interface RequirementReview {
  id: number;
  requirementId: number;
  reviewerName: string;
  result: ReviewResult;
  comment: string;
  reviewedAt: string;
}

export interface MaturityCheck {
  key: string;
  label: string;
  passed: boolean;
}

export interface RequirementDetail extends Requirement {
  description: string;
  currentStage: string;
  solutionSummary: string;
  acceptanceCriteria: string[];
  impactScope: string[];
  risks: string[];
  maturityChecks: MaturityCheck[];
  linkedExecutionIds: number[];
  linkedExecutionNames: string[];
  reviews: RequirementReview[];
}

export interface RequirementReviewPayload {
  reviewerName: string;
  result: ReviewResult;
  comment: string;
}

export interface RequirementDraftPayload {
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  ownerName: string;
  expectedReleaseAt: string;
  description: string;
  solutionSummary: string;
  acceptanceCriteria: string[];
  impactScope: string[];
  risks: string[];
}

export interface CreateRequirementPayload extends RequirementDraftPayload {}

export interface UpdateRequirementPayload extends RequirementDraftPayload {
  status: RequirementStatus;
}

export interface RequirementGenerateExecutionPayload {
  requirementIds: number[];
  projectId: number;
  projectName: string;
  planStart: string;
  planEnd: string;
}

export interface RequirementGenerateExecutionResult {
  items: Execution[];
  skippedRequirementIds: number[];
}

export interface Project {
  id: number;
  name: string;
  code: string;
  ownerName: string;
  status: 'Active' | 'Risk' | 'Done';
  executionCount: number;
  riskCount: number;
}

export interface CreateProjectPayload {
  name: string;
  code: string;
  ownerName: string;
  status: 'Active' | 'Risk' | 'Done';
}

export interface Execution {
  id: number;
  name: string;
  projectName: string;
  ownerName: string;
  status: ExecutionStatus;
  planStart: string;
  planEnd: string;
  actualProgress: number;
  planProgress: number;
}

export interface ExecutionDetail extends Execution {
  projectId: number;
  requirementIds: number[];
}

export interface CreateExecutionPayload {
  name: string;
  projectId: number;
  projectName: string;
  ownerName: string;
  status: ExecutionStatus;
  planStart: string;
  planEnd: string;
}

export interface UpdateExecutionPayload {
  name: string;
  ownerName: string;
  status: ExecutionStatus;
  planStart: string;
  planEnd: string;
  actualProgress: number;
  planProgress: number;
}

export interface ExecutionTask {
  id: number;
  executionId: number;
  name: string;
  ownerName: string;
  status: ExecutionStatus;
  actualProgress: number;
}

export interface CreateExecutionTaskPayload {
  executionId: number;
  name: string;
  ownerName: string;
  status: ExecutionStatus;
  actualProgress: number;
}

export interface UpdateExecutionTaskPayload {
  name: string;
  ownerName: string;
  status: ExecutionStatus;
  actualProgress: number;
}

export interface Worklog {
  id: number;
  executionId: number;
  executionName: string;
  ownerName: string;
  workDate: string;
  hours: number;
  summary: string;
}

export interface CreateWorklogPayload {
  executionId: number;
  ownerName: string;
  workDate: string;
  hours: number;
  summary: string;
}

export interface UpdateWorklogPayload {
  executionId: number;
  ownerName: string;
  workDate: string;
  hours: number;
  summary: string;
}

export interface TeamScheduleItem extends Execution {
  projectId: number;
  requirementIds: number[];
}

export interface ExecutionScheduleItem extends ExecutionTask {
  executionName: string;
  projectName: string;
  planStart: string;
  planEnd: string;
}

export interface DailyTask {
  id: number;
  title: string;
  ownerName: string;
  status: DailyTaskStatus;
  dueAt: string;
  excludeFromReport: boolean;
}

export interface CreateDailyTaskPayload {
  title: string;
  ownerName: string;
  status: DailyTaskStatus;
  dueAt: string;
  excludeFromReport: boolean;
}

export interface UpdateDailyTaskPayload extends CreateDailyTaskPayload {}

export interface Bug {
  id: number;
  title: string;
  severity: BugSeverity;
  priority: 'P0' | 'P1' | 'P2';
  status: BugStatus;
  linkType: BugLinkType;
  linkId: number;
  linkName: string;
  ownerName: string;
  reporterName: string;
  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
}

export interface CreateBugPayload {
  title: string;
  severity: BugSeverity;
  priority: 'P0' | 'P1' | 'P2';
  status: BugStatus;
  linkType: BugLinkType;
  linkId: number;
  linkName?: string;
  ownerName: string;
  reporterName: string;
  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;
}

export interface UpdateBugPayload extends CreateBugPayload {}

export interface BatchSubmitBugsPayload {
  bugIds: number[];
}

export interface BatchSubmitBugsResult {
  items: Bug[];
  skippedBugIds: number[];
}

export type SettingsMemberStatus = 'Active' | 'Invited';

export interface SettingsMember {
  id: number;
  name: string;
  email: string;
  department: string;
  title: string;
  status: SettingsMemberStatus;
  roles: string[];
  permissionCount: number;
  dingtalkBound: boolean;
  lastLoginAt: string;
}

export interface CreateSettingsMemberPayload {
  name: string;
  email: string;
  department: string;
  title: string;
  status: SettingsMemberStatus;
  roles: string[];
  dingtalkBound: boolean;
}

export interface UpdateSettingsMemberPayload extends CreateSettingsMemberPayload {}

export interface SettingsRole {
  id: number;
  key: string;
  name: string;
  scope: 'org' | 'project' | 'self';
  description: string;
  userCount: number;
  permissions: string[];
}

export interface UpdateSettingsRolePayload {
  name: string;
  scope: 'org' | 'project' | 'self';
  description: string;
  permissions: string[];
}

export interface SettingsPolicy {
  id: number;
  name: string;
  scope: 'org' | 'project' | 'self';
  description: string;
  permissions: string[];
}

export interface UpdateSettingsPolicyPayload {
  name: string;
  scope: 'org' | 'project' | 'self';
  description: string;
  permissions: string[];
}

export interface SettingsDictionary {
  id: number;
  key: string;
  name: string;
  values: string[];
  updatedAt: string;
}

export interface UpdateSettingsDictionaryPayload {
  name: string;
  values: string[];
}

export interface SettingsWorkflow {
  id: number;
  name: string;
  scope: 'org' | 'project' | 'self';
  stages: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface UpdateSettingsWorkflowPayload {
  name: string;
  scope: 'org' | 'project' | 'self';
  stages: string[];
  enabled: boolean;
}

export interface DailyReportDraft {
  generatedAt: string;
  completed: string[];
  inProgress: string[];
  risks: string[];
  nextSteps: string[];
}

export interface WeeklyReportDraft {
  generatedAt: string;
  summary: string;
  completed: string[];
  inProgress: string[];
  risks: string[];
  nextWeek: string[];
  worklogHighlights: string[];
  totalHours: number;
}