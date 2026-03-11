import type {
  DailyReportDraft,
  Execution,
  Project,
  Requirement,
  RequirementDetail,
  RequirementGenerateExecutionPayload,
  RequirementGenerateExecutionResult,
  RequirementReview,
  RequirementReviewPayload,
  ReviewResult,
  WorkspaceSummary,
} from './types';

const workspaceSummary: WorkspaceSummary = {
  dashboardMode: 'team',
  myExecutions: 12,
  dueToday: 4,
  blocked: 2,
  reportsReady: 1,
  overview: {
    projectCount: 2,
    atRiskProjectCount: 1,
    memberCount: 4,
    activeMemberCount: 3,
    attentionMemberCount: 2,
    openBugCount: 2,
  },
  projectOverview: [
    {
      id: 201,
      name: 'Project Management Platform V1',
      code: 'PM-V1',
      ownerName: 'Zhao Kai',
      status: 'Active',
      health: 'watch',
      executionCount: 18,
      activeExecutionCount: 9,
      blockedExecutionCount: 2,
      openBugCount: 1,
      riskCount: 2,
      averageProgress: 56,
      dueSoonCount: 3,
      overdueCount: 0,
      lastActivityAt: '2026-03-11 10:30',
    },
    {
      id: 202,
      name: 'Unified Notification Center',
      code: 'NOTIFY',
      ownerName: 'Chen Jing',
      status: 'Risk',
      health: 'risk',
      executionCount: 7,
      activeExecutionCount: 4,
      blockedExecutionCount: 1,
      openBugCount: 2,
      riskCount: 3,
      averageProgress: 38,
      dueSoonCount: 2,
      overdueCount: 1,
      lastActivityAt: '2026-03-11 09:20',
    },
  ],
  memberOverview: [
    {
      id: 1,
      name: 'Wang Jun',
      email: 'wangjun@example.com',
      department: 'R&D',
      title: 'Project Lead',
      status: 'Active',
      dingtalkBound: true,
      activeExecutionCount: 3,
      blockedExecutionCount: 0,
      pendingDailyTaskCount: 1,
      openBugCount: 0,
      hoursThisWeek: 15.5,
      lastActivityAt: '2026-03-11 10:15',
      focusStatus: 'active',
      focusLabel: 'Focused',
    },
    {
      id: 2,
      name: 'Chen Jing',
      email: 'chenjing@example.com',
      department: 'R&D',
      title: 'Engineer',
      status: 'Active',
      dingtalkBound: true,
      activeExecutionCount: 2,
      blockedExecutionCount: 1,
      pendingDailyTaskCount: 2,
      openBugCount: 1,
      hoursThisWeek: 11.0,
      lastActivityAt: '2026-03-11 09:40',
      focusStatus: 'risk',
      focusLabel: 'Needs coordination',
    },
    {
      id: 3,
      name: 'Li Nan',
      email: 'linan@example.com',
      department: 'Product',
      title: 'Product Manager',
      status: 'Active',
      dingtalkBound: false,
      activeExecutionCount: 1,
      blockedExecutionCount: 0,
      pendingDailyTaskCount: 2,
      openBugCount: 1,
      hoursThisWeek: 6.5,
      lastActivityAt: '2026-03-10 18:00',
      focusStatus: 'watch',
      focusLabel: 'Needs attention',
    },
    {
      id: 4,
      name: 'Sun Mei',
      email: 'sunmei@example.com',
      department: 'QA',
      title: 'Tester',
      status: 'Invited',
      dingtalkBound: false,
      activeExecutionCount: 0,
      blockedExecutionCount: 0,
      pendingDailyTaskCount: 0,
      openBugCount: 0,
      hoursThisWeek: 0,
      lastActivityAt: '',
      focusStatus: 'idle',
      focusLabel: 'No active items',
    },
  ],
};

type RequirementRecord = Omit<RequirementDetail, 'linkedExecutionCount' | 'linkedExecutionNames' | 'reviews'>;

let requirementRecords: RequirementRecord[] = [
  {
    id: 1001,
    title: 'Requirement review and batch execution generation',
    status: 'ToReview',
    priority: 'P0',
    ownerName: 'Wang Jun',
    expectedReleaseAt: '2026-03-21',
    description: 'Connect requirement intake, review and execution generation so the team can move from idea to delivery in one flow.',
    currentStage: 'Waiting for review',
    solutionSummary: 'Store maturity checks and review decisions in the requirement detail view, then hand the item over to execution management.',
    acceptanceCriteria: [
      'At least three acceptance points are visible',
      'Review records are traceable',
      'Batch execution generation creates requirement links',
    ],
    impactScope: ['Requirement pool', 'Execution management', 'Report aggregation'],
    risks: ['Missing review details can lead to invalid execution generation', 'Unclear status rules may cause skipped steps'],
    maturityChecks: [
      { key: 'acceptance', label: 'Acceptance criteria added', passed: true },
      { key: 'solution', label: 'Solution summary added', passed: true },
      { key: 'impact', label: 'Impact scope defined', passed: true },
      { key: 'risk', label: 'Risks and dependencies captured', passed: false },
      { key: 'owner', label: 'Owner assigned', passed: true },
    ],
    linkedExecutionIds: [],
    attachments: [],
  },
  {
    id: 1002,
    title: 'Highlight team gantt conflicts',
    status: 'Reviewed',
    priority: 'P1',
    ownerName: 'Chen Jing',
    expectedReleaseAt: '2026-03-28',
    description: 'Highlight overlapping execution windows for the same team member so project admins can adjust schedule conflicts early.',
    currentStage: 'Reviewed',
    solutionSummary: 'Group execution windows by member, detect overlap and surface the results in summary cards and gantt rows.',
    acceptanceCriteria: [
      'Conflict summary cards are visible',
      'Conflicts can be viewed per member',
      'Conflict results can be filtered by project',
    ],
    impactScope: ['Team gantt', 'Schedule management', 'Workspace risk exposure'],
    risks: ['Missing plan dates will reduce conflict detection accuracy'],
    maturityChecks: [
      { key: 'acceptance', label: 'Acceptance criteria added', passed: true },
      { key: 'solution', label: 'Solution summary added', passed: true },
      { key: 'impact', label: 'Impact scope defined', passed: true },
      { key: 'risk', label: 'Risks and dependencies captured', passed: true },
      { key: 'owner', label: 'Owner assigned', passed: true },
    ],
    linkedExecutionIds: [3002],
    attachments: [],
  },
  {
    id: 1003,
    title: 'Generate daily report drafts automatically',
    status: 'InDevelopment',
    priority: 'P0',
    ownerName: 'Li Nan',
    expectedReleaseAt: '2026-03-18',
    description: 'Aggregate execution changes, worklogs and daily items into an editable daily report draft.',
    currentStage: 'In development',
    solutionSummary: 'Build a four-part report template with completed work, work in progress, risks and next steps.',
    acceptanceCriteria: [
      'Draft can be generated with one action',
      'Draft can be edited and exported',
      'Items excluded from reporting are skipped',
    ],
    impactScope: ['Daily report', 'Weekly report', 'Execution worklogs', 'Daily items'],
    risks: ['Low quality worklogs reduce the quality of generated reports'],
    maturityChecks: [
      { key: 'acceptance', label: 'Acceptance criteria added', passed: true },
      { key: 'solution', label: 'Solution summary added', passed: true },
      { key: 'impact', label: 'Impact scope defined', passed: true },
      { key: 'risk', label: 'Risks and dependencies captured', passed: true },
      { key: 'owner', label: 'Owner assigned', passed: true },
    ],
    linkedExecutionIds: [3003],
    attachments: [],
  },
];

let projects: Project[] = [
  {
    id: 201,
    name: 'Project Management Platform V1',
    code: 'PM-V1',
    ownerName: 'Zhao Kai',
    status: 'Active',
    executionCount: 18,
    riskCount: 2,
  },
  {
    id: 202,
    name: 'Unified Notification Center',
    code: 'NOTIFY',
    ownerName: 'Chen Jing',
    status: 'Risk',
    executionCount: 7,
    riskCount: 3,
  },
];

let executions: Execution[] = [
  {
    id: 3001,
    name: 'Build frontend and backend skeleton',
    projectName: 'Project Management Platform V1',
    ownerName: 'Wang Jun',
    status: 'InProgress',
    planStart: '2026-03-09',
    planEnd: '2026-03-12',
    actualProgress: 45,
    planProgress: 35,
  },
  {
    id: 3002,
    name: 'Implement requirement pool base APIs',
    projectName: 'Project Management Platform V1',
    ownerName: 'Li Nan',
    status: 'Blocked',
    planStart: '2026-03-10',
    planEnd: '2026-03-15',
    actualProgress: 20,
    planProgress: 18,
  },
  {
    id: 3003,
    name: 'Implement daily report aggregation',
    projectName: 'Project Management Platform V1',
    ownerName: 'Chen Jing',
    status: 'NotStarted',
    planStart: '2026-03-13',
    planEnd: '2026-03-18',
    actualProgress: 0,
    planProgress: 0,
  },
];

let reviews: RequirementReview[] = [
  {
    id: 1,
    requirementId: 1002,
    reviewerName: 'Zhao Kai',
    result: 'approved',
    comment: 'Scope and solution are clear, this can enter scheduling.',
    reviewedAt: '2026-03-08 10:00',
  },
  {
    id: 2,
    requirementId: 1001,
    reviewerName: 'Li Nan',
    result: 'supplement_required',
    comment: 'Risks and rollback expectations still need more detail.',
    reviewedAt: '2026-03-09 09:30',
  },
];

const dailyReport: DailyReportDraft = {
  generatedAt: '2026-03-09 16:00',
  completed: ['Finished the requirement and permission planning docs', 'Aligned the API plan with current OpenAPI structure'],
  inProgress: ['Bootstrapping the frontend and backend skeleton', 'Connecting requirement review to execution generation'],
  risks: ['PHP runtime is not available locally, so backend execution is not yet verified'],
  nextSteps: ['Add explicit requirement transition APIs', 'Move on to execution tree and worklog support'],
};

function delay<T>(payload: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(payload), 180);
  });
}

function mapRequirementSummary(item: RequirementRecord): Requirement {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    priority: item.priority,
    ownerName: item.ownerName,
    expectedReleaseAt: item.expectedReleaseAt,
    linkedExecutionCount: item.linkedExecutionIds.length,
  };
}

function getExecutionNames(ids: number[]): string[] {
  return ids
    .map((id) => executions.find((item) => item.id === id)?.name)
    .filter((item): item is string => Boolean(item));
}

function mapRequirementDetail(item: RequirementRecord): RequirementDetail {
  return {
    ...mapRequirementSummary(item),
    description: item.description,
    currentStage: item.currentStage,
    solutionSummary: item.solutionSummary,
    acceptanceCriteria: item.acceptanceCriteria,
    impactScope: item.impactScope,
    risks: item.risks,
    maturityChecks: item.maturityChecks,
    linkedExecutionIds: item.linkedExecutionIds,
    linkedExecutionNames: getExecutionNames(item.linkedExecutionIds),
    attachments: item.attachments,
    reviews: reviews
      .filter((review) => review.requirementId === item.id)
      .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt)),
  };
}

function nextReviewId(): number {
  return reviews.length ? Math.max(...reviews.map((item) => item.id)) + 1 : 1;
}

function nextExecutionId(): number {
  return executions.length ? Math.max(...executions.map((item) => item.id)) + 1 : 1;
}

function toRequirementStatus(result: ReviewResult): RequirementRecord['status'] {
  switch (result) {
    case 'approved':
      return 'Reviewed';
    case 'delayed':
      return 'Confirmed';
    case 'rejected':
      return 'Confirmed';
    case 'supplement_required':
    default:
      return 'Confirmed';
  }
}

export const mockApi = {
  getWorkspaceSummary: () => delay(workspaceSummary),
  getRequirements: () => delay(requirementRecords.map(mapRequirementSummary)),
  getRequirementDetail: (id: number) => {
    const item = requirementRecords.find((record) => record.id === id);
    return delay(item ? mapRequirementDetail(item) : null);
  },
  createRequirementReview: async (id: number, payload: RequirementReviewPayload) => {
    const review: RequirementReview = {
      id: nextReviewId(),
      requirementId: id,
      reviewerName: payload.reviewerName,
      result: payload.result,
      comment: payload.comment,
      reviewedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };

    reviews = [review, ...reviews];
    requirementRecords = requirementRecords.map((item) =>
      item.id === id
        ? {
            ...item,
            status: toRequirementStatus(payload.result),
            currentStage: payload.result === 'approved' ? 'Reviewed' : 'Confirmed',
          }
        : item,
    );

    return delay(review);
  },
  batchGenerateExecutions: async (
    payload: RequirementGenerateExecutionPayload,
  ): Promise<RequirementGenerateExecutionResult> => {
    const created: Execution[] = [];
    const skippedRequirementIds: number[] = [];
    const generatedIdsByRequirement = new Map<number, number[]>();

    payload.requirementIds.forEach((requirementId) => {
      const requirement = requirementRecords.find((item) => item.id === requirementId);

      if (!requirement) {
        skippedRequirementIds.push(requirementId);
        return;
      }

      if (!['Reviewed', 'Scheduled', 'InDevelopment'].includes(requirement.status)) {
        skippedRequirementIds.push(requirementId);
        return;
      }

      const executionId = nextExecutionId() + created.length;
      const execution: Execution = {
        id: executionId,
        name: `Execution - ${requirement.title}`,
        projectName: payload.projectName,
        ownerName: requirement.ownerName,
        status: 'NotStarted',
        planStart: payload.planStart,
        planEnd: payload.planEnd,
        actualProgress: 0,
        planProgress: 0,
      };

      created.push(execution);
      generatedIdsByRequirement.set(requirementId, [...(generatedIdsByRequirement.get(requirementId) ?? []), executionId]);
    });

    executions = [...created, ...executions];
    requirementRecords = requirementRecords.map((item) => {
      const newIds = generatedIdsByRequirement.get(item.id);
      if (!newIds || newIds.length === 0) {
        return item;
      }

      return {
        ...item,
        status: 'Scheduled',
        currentStage: 'Scheduled',
        linkedExecutionIds: [...item.linkedExecutionIds, ...newIds],
      };
    });
    projects = projects.map((item) =>
      item.id === payload.projectId
        ? { ...item, executionCount: item.executionCount + created.length }
        : item,
    );

    return delay({ items: created, skippedRequirementIds });
  },
  getProjects: () => delay(projects),
  getExecutions: () => delay(executions),
  getDailyReportDraft: () => delay(dailyReport),
};
