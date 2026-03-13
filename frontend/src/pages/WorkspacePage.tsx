import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Input, List, Progress, Row, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { TabsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { pmApi } from '../services/api';
import type { WorkspaceMemberOverview, WorkspaceProjectOverview } from '../services/types';
import { useAuthStore } from '../store/authStore';

const settingsPermissions = [
  'settings.member.manage.org',
  'settings.role.manage.org',
  'settings.policy.manage.org',
  'settings.dictionary.view.org',
  'settings.workflow.view.org',
] as const;

type DashboardMode = 'team' | 'personal';
type MetricTone = 'brand' | 'warning' | 'danger' | 'neutral';

type MetricCardItem = {
  key: string;
  title: string;
  value: number;
  hint: string;
  tone: MetricTone;
};

type ReminderItem = {
  key: string;
  title: string;
  description: string;
  tag: string;
  color: string;
};

const text = {
  allStatuses: '\u5168\u90e8\u72b6\u6001',
  statusActive: '\u8fdb\u884c\u4e2d',
  statusRisk: '\u98ce\u9669',
  statusDone: '\u5df2\u5b8c\u6210',
  allMembers: '\u5168\u90e8\u6210\u5458',
  focusRisk: '\u9700\u8981\u534f\u8c03',
  focusWatch: '\u9700\u8981\u5173\u6ce8',
  focusActive: '\u6295\u5165\u4e2d',
  focusIdle: '\u6682\u65e0\u5728\u9014',
  healthHealthy: '\u5065\u5eb7',
  healthWatch: '\u5173\u6ce8',
  healthRisk: '\u98ce\u9669',
  pageTitle: '\u5de5\u4f5c\u53f0',
  teamDescription: '\u9762\u5411\u56e2\u961f\u7ba1\u7406\u7684\u7ba1\u7406\u9a7e\u9a76\u8231\uff0c\u91cd\u70b9\u67e5\u770b\u9879\u76ee\u98ce\u9669\u3001\u6210\u5458\u8d1f\u8f7d\u4e0e\u6574\u4f53\u63a8\u8fdb\u3002',
  personalDescription: '\u805a\u7126\u6211\u7684\u5f53\u524d\u5de5\u4f5c\uff0c\u53ea\u5c55\u793a\u6211\u8d1f\u8d23\u7684\u4e8b\u9879\u4e0e\u6211\u53c2\u4e0e\u7684\u9879\u76ee\u3002',
  teamMode: '\u56e2\u961f\u89c6\u89d2',
  personalMode: '\u4e2a\u4eba\u89c6\u89d2',
  teamModeHint: '\u5f53\u524d\u663e\u793a\u6240\u6709\u53ef\u7ba1\u7406\u9879\u76ee\u3001\u98ce\u9669\u6210\u5458\u4e0e\u6574\u4f53\u63a8\u8fdb\u60c5\u51b5\u3002',
  personalModeHint: '\u5f53\u524d\u4ec5\u663e\u793a\u6211\u7684\u5de5\u4f5c\u4e0e\u6211\u53c2\u4e0e\u7684\u9879\u76ee\uff0c\u4e0d\u5c55\u793a\u5176\u4ed6\u6210\u5458\u8fdb\u5ea6\u3002',
  projectList: '\u9879\u76ee\u5217\u8868',
  executionList: '\u6267\u884c\u5217\u8868',
  bugCenter: '\u7f3a\u9677\u4e2d\u5fc3',
  teamGantt: '\u56e2\u961f\u7518\u7279\u56fe',
  projectGantt: '\u9879\u76ee\u7518\u7279\u56fe',
  memberSettings: '\u6210\u5458\u4e0e\u8bbe\u7f6e',
  myExecutions: '\u6211\u8d1f\u8d23\u7684\u6267\u884c',
  myProjects: '\u6211\u53c2\u4e0e\u7684\u9879\u76ee',
  teamProjectCount: '\u53ef\u7ba1\u7406\u9879\u76ee',
  teamActiveExecutions: '\u5728\u9014\u6267\u884c',
  dueToday: '\u4eca\u65e5\u5230\u671f',
  dueTodayPersonal: '\u4eca\u65e5\u5230\u671f\u4e8b\u9879',
  atRiskProjects: '\u98ce\u9669\u9879\u76ee',
  attentionMembers: '\u9700\u534f\u8c03\u6210\u5458',
  openBugs: '\u672a\u5173\u95ed\u7f3a\u9677',
  blockedExecutions: '\u963b\u585e\u4e8b\u9879',
  reportsReady: '\u5f85\u6574\u7406\u62a5\u8868',
  overviewTab: '\u603b\u89c8',
  projectTab: '\u9879\u76ee\u89c6\u89d2',
  myProjectTab: '\u6211\u53c2\u4e0e\u7684\u9879\u76ee',
  memberTab: '\u4eba\u5458\u89c6\u89d2',
  riskyProjectsCard: '\u98ce\u9669\u9879\u76ee',
  keyMembersCard: '\u91cd\u70b9\u6210\u5458',
  myProjectsCard: '\u6211\u53c2\u4e0e\u7684\u9879\u76ee',
  myRemindersCard: '\u6211\u7684\u5de5\u4f5c\u63d0\u9192',
  needAttentionSuffix: '\u4e2a\u9700\u5173\u6ce8',
  needAttentionMemberSuffix: '\u4f4d\u9700\u5173\u6ce8',
  noRiskProjects: '\u5f53\u524d\u6ca1\u6709\u9ad8\u98ce\u9669\u9879\u76ee\u3002',
  noKeyMembers: '\u5f53\u524d\u6ca1\u6709\u9700\u8981\u91cd\u70b9\u5173\u6ce8\u7684\u6210\u5458\u3002',
  noPersonalProjects: '\u6682\u65e0\u53ef\u89c1\u9879\u76ee\u3002',
  noReminders: '\u5f53\u524d\u6ca1\u6709\u7d27\u6025\u63d0\u9192\u3002',
  noRemindersDescription: '\u76ee\u524d\u6ca1\u6709\u963b\u585e\u3001\u5230\u671f\u6216\u7f3a\u9677\u538b\u529b\uff0c\u53ef\u4ee5\u6309\u8ba1\u5212\u7ee7\u7eed\u63a8\u8fdb\u3002',
  reminderBlockedTitle: '\u5b58\u5728\u963b\u585e\u4e8b\u9879',
  reminderDueTodayTitle: '\u4eca\u5929\u6709\u5230\u671f\u4e8b\u9879',
  reminderReportsTitle: '\u53ef\u4ee5\u6574\u7406\u62a5\u8868',
  reminderBugTitle: '\u6709\u5f85\u8ddf\u8fdb\u7f3a\u9677',
  reminderBlockedDescriptionPrefix: '\u5f53\u524d\u6709',
  reminderBlockedDescriptionSuffix: '\u4e2a\u963b\u585e\u6267\u884c\uff0c\u5efa\u8bae\u5c3d\u5feb\u534f\u540c\u5904\u7406\u3002',
  reminderDueTodayDescriptionSuffix: '\u9879\u4e8b\u9879\u5728\u4eca\u65e5\u5230\u671f\uff0c\u8bf7\u4f18\u5148\u68c0\u67e5\u8fdb\u5ea6\u3002',
  reminderReportsDescriptionSuffix: '\u6761\u65e5\u5e38\u4e8b\u9879\u53ef\u7eb3\u5165\u62a5\u8868\uff0c\u8bb0\u5f97\u53ca\u65f6\u6574\u7406\u3002',
  reminderBugDescriptionSuffix: '\u4e2a\u7f3a\u9677\u4ecd\u672a\u5173\u95ed\uff0c\u8bf7\u5173\u6ce8\u4fee\u590d\u8fdb\u5c55\u3002',
  projectSearchPlaceholder: '\u6309\u9879\u76ee\u540d\u3001\u7f16\u7801\u6216\u8d1f\u8d23\u4eba\u641c\u7d22',
  memberSearchPlaceholder: '\u6309\u6210\u5458\u3001\u90e8\u95e8\u3001\u5c97\u4f4d\u6216\u90ae\u7bb1\u641c\u7d22',
  clearFilters: '\u6e05\u7a7a\u7b5b\u9009',
  displayPrefix: '\u663e\u793a',
  projectUnit: '\u4e2a\u9879\u76ee',
  memberUnit: '\u4f4d\u6210\u5458',
  noMatchedProjects: '\u6ca1\u6709\u5339\u914d\u7684\u9879\u76ee',
  noProjectData: '\u6682\u65e0\u9879\u76ee\u6570\u636e',
  noMatchedMembers: '\u6ca1\u6709\u5339\u914d\u7684\u6210\u5458',
  noMemberData: '\u6682\u65e0\u6210\u5458\u6570\u636e',
  projectColumn: '\u9879\u76ee',
  ownerColumn: '\u8d1f\u8d23\u4eba',
  statusColumn: '\u72b6\u6001',
  healthColumn: '\u5065\u5eb7\u5ea6',
  activeExecutionColumn: '\u5728\u9014\u6267\u884c',
  blockedExecutionColumn: '\u963b\u585e\u6267\u884c',
  openBugColumn: '\u672a\u5173\u95ed\u7f3a\u9677',
  averageProgressColumn: '\u5e73\u5747\u8fdb\u5ea6',
  dueSoonColumn: '\u8fd13\u5929\u5230\u671f',
  lastActivityColumn: '\u6700\u8fd1\u6d3b\u52a8',
  memberColumn: '\u6210\u5458',
  unregisteredEmail: '\u672a\u767b\u8bb0\u90ae\u7bb1',
  departmentTitleColumn: '\u90e8\u95e8 / \u5c97\u4f4d',
  memberStatusColumn: '\u6210\u5458\u72b6\u6001',
  onDuty: '\u5728\u5c97',
  invited: '\u5f85\u6fc0\u6d3b',
  pendingDailyTasksColumn: '\u5f85\u529e\u65e5\u5e38',
  relatedBugsColumn: '\u76f8\u5173\u7f3a\u9677',
  workHoursColumn: '\u8fd17\u5929\u5de5\u65f6',
  lastActiveColumn: '\u6700\u8fd1\u6d3b\u8dc3',
  focusTagColumn: '\u5173\u6ce8\u6807\u7b7e',
  riskProjectSummary: '\u8d1f\u8d23\u4eba',
  blockedSummary: '\u963b\u585e',
  bugSummary: '\u7f3a\u9677',
  dueSoonSummary: '\u8fd13\u5929\u5230\u671f',
  inFlightSummary: '\u5728\u9014',
  workHoursSummary: '\u5de5\u65f6',
  progressSummary: '\u5e73\u5747\u8fdb\u5ea6',
  projectCountHint: '\u5f53\u524d\u53ef\u7ba1\u7406\u7684\u9879\u76ee\u603b\u6570',
  activeExecutionHint: '\u4ecd\u5728\u63a8\u8fdb\u4e2d\u7684\u6267\u884c\u4efb\u52a1',
  riskProjectHint: '\u5b58\u5728\u963b\u585e\u3001\u903e\u671f\u6216\u7f3a\u9677\u538b\u529b\u7684\u9879\u76ee',
  attentionMemberHint: '\u9700\u8981\u8ddf\u8fdb\u7684\u6210\u5458\u8d1f\u8f7d\u4e0e\u963b\u585e\u60c5\u51b5',
  dueTodayHint: '\u4eca\u5929\u9700\u8981\u5904\u7406\u7684\u6267\u884c\u4e0e\u65e5\u5e38\u4e8b\u9879',
  openBugHint: '\u5f53\u524d\u8303\u56f4\u5185\u4ecd\u5f85\u8ddf\u8fdb\u7684\u7f3a\u9677',
  myExecutionsHint: '\u5f53\u524d\u7531\u6211\u8d1f\u8d23\u7684\u5728\u9014\u5de5\u4f5c',
  myProjectsHint: '\u6211\u5f53\u524d\u53c2\u4e0e\u7684\u9879\u76ee\u6570\u91cf',
  dueTodayPersonalHint: '\u4eca\u5929\u9700\u8981\u6211\u4f18\u5148\u5904\u7406\u7684\u4e8b\u9879',
  blockedHint: '\u5f53\u524d\u9700\u8981\u534f\u8c03\u89e3\u51b3\u7684\u963b\u585e\u9879',
  hoursSuffix: 'h',
} as const;

const projectStatusOptions = [
  { label: text.allStatuses, value: 'all' },
  { label: text.statusActive, value: 'Active' },
  { label: text.statusRisk, value: 'Risk' },
  { label: text.statusDone, value: 'Done' },
] as const;

const memberFocusOptions = [
  { label: text.allMembers, value: 'all' },
  { label: text.focusRisk, value: 'risk' },
  { label: text.focusWatch, value: 'watch' },
  { label: text.focusActive, value: 'active' },
  { label: text.focusIdle, value: 'idle' },
] as const;

const healthColorMap: Record<WorkspaceProjectOverview['health'], string> = {
  healthy: 'success',
  watch: 'warning',
  risk: 'error',
};

const healthLabelMap: Record<WorkspaceProjectOverview['health'], string> = {
  healthy: text.healthHealthy,
  watch: text.healthWatch,
  risk: text.healthRisk,
};

const focusColorMap: Record<WorkspaceMemberOverview['focusStatus'], string> = {
  active: 'processing',
  watch: 'warning',
  risk: 'error',
  idle: 'default',
};

const focusLabelMap: Record<WorkspaceMemberOverview['focusStatus'], string> = {
  active: text.focusActive,
  watch: text.focusWatch,
  risk: text.focusRisk,
  idle: text.focusIdle,
};

export function WorkspacePage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.permissions);
  const canViewProjects = permissions.includes('project.view.related');
  const canViewExecutions = permissions.includes('execution.view.related');
  const canViewBugs = permissions.includes('bug.view.related');
  const canViewSchedule = permissions.includes('schedule.view.related');
  const canViewSettings = settingsPermissions.some((permission) => permissions.includes(permission));
  const summaryQuery = useQuery({ queryKey: ['workspace-summary'], queryFn: pmApi.getWorkspaceSummary });

  const [projectKeyword, setProjectKeyword] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<WorkspaceProjectOverview['status'] | 'all'>('all');
  const [memberKeyword, setMemberKeyword] = useState('');
  const [memberFocusFilter, setMemberFocusFilter] = useState<WorkspaceMemberOverview['focusStatus'] | 'all'>('all');

  const deferredProjectKeyword = useDeferredValue(projectKeyword);
  const deferredMemberKeyword = useDeferredValue(memberKeyword);

  const dashboardMode: DashboardMode = summaryQuery.data?.dashboardMode ?? 'team';
  const isTeamDashboard = dashboardMode === 'team';
  const overview = summaryQuery.data?.overview;
  const projectOverview = summaryQuery.data?.projectOverview ?? [];
  const memberOverview = summaryQuery.data?.memberOverview ?? [];

  const riskyProjects = useMemo(() => projectOverview.filter((item) => item.health !== 'healthy').slice(0, 5), [projectOverview]);
  const attentionMembers = useMemo(
    () => memberOverview.filter((item) => item.focusStatus === 'risk' || item.focusStatus === 'watch').slice(0, 5),
    [memberOverview],
  );
  const activeExecutionTotal = useMemo(
    () => projectOverview.reduce((sum, item) => sum + item.activeExecutionCount, 0),
    [projectOverview],
  );

  const filteredProjects = useMemo(() => {
    const normalizedKeyword = deferredProjectKeyword.trim().toLowerCase();

    return projectOverview.filter((item) => {
      const matchesKeyword =
        normalizedKeyword === '' ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.code.toLowerCase().includes(normalizedKeyword) ||
        item.ownerName.toLowerCase().includes(normalizedKeyword);
      const matchesStatus = projectStatusFilter === 'all' || item.status === projectStatusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [deferredProjectKeyword, projectOverview, projectStatusFilter]);

  const filteredMembers = useMemo(() => {
    const normalizedKeyword = deferredMemberKeyword.trim().toLowerCase();

    return memberOverview.filter((item) => {
      const matchesKeyword =
        normalizedKeyword === '' ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.department.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.email.toLowerCase().includes(normalizedKeyword);
      const matchesFocus = memberFocusFilter === 'all' || item.focusStatus === memberFocusFilter;

      return matchesKeyword && matchesFocus;
    });
  }, [deferredMemberKeyword, memberFocusFilter, memberOverview]);

  const metricCards = useMemo<MetricCardItem[]>(() => {
    if (isTeamDashboard) {
      return [
        {
          key: 'project-count',
          title: text.teamProjectCount,
          value: overview?.projectCount ?? 0,
          hint: text.projectCountHint,
          tone: 'brand',
        },
        {
          key: 'active-executions',
          title: text.teamActiveExecutions,
          value: activeExecutionTotal,
          hint: text.activeExecutionHint,
          tone: 'neutral',
        },
        {
          key: 'risk-projects',
          title: text.atRiskProjects,
          value: overview?.atRiskProjectCount ?? 0,
          hint: text.riskProjectHint,
          tone: 'danger',
        },
        {
          key: 'attention-members',
          title: text.attentionMembers,
          value: overview?.attentionMemberCount ?? 0,
          hint: text.attentionMemberHint,
          tone: 'warning',
        },
        {
          key: 'due-today',
          title: text.dueToday,
          value: summaryQuery.data?.dueToday ?? 0,
          hint: text.dueTodayHint,
          tone: 'warning',
        },
        {
          key: 'open-bugs',
          title: text.openBugs,
          value: overview?.openBugCount ?? 0,
          hint: text.openBugHint,
          tone: 'danger',
        },
      ];
    }

    return [
      {
        key: 'my-executions',
        title: text.myExecutions,
        value: summaryQuery.data?.myExecutions ?? 0,
        hint: text.myExecutionsHint,
        tone: 'brand',
      },
      {
        key: 'my-projects',
        title: text.myProjects,
        value: overview?.projectCount ?? 0,
        hint: text.myProjectsHint,
        tone: 'neutral',
      },
      {
        key: 'due-today',
        title: text.dueTodayPersonal,
        value: summaryQuery.data?.dueToday ?? 0,
        hint: text.dueTodayPersonalHint,
        tone: 'warning',
      },
      {
        key: 'blocked',
        title: text.blockedExecutions,
        value: summaryQuery.data?.blocked ?? 0,
        hint: text.blockedHint,
        tone: 'danger',
      },
    ];
  }, [activeExecutionTotal, isTeamDashboard, overview, summaryQuery.data?.blocked, summaryQuery.data?.dueToday, summaryQuery.data?.myExecutions]);

  const personalReminders = useMemo<ReminderItem[]>(() => {
    const items: ReminderItem[] = [];
    const blockedCount = summaryQuery.data?.blocked ?? 0;
    const dueTodayCount = summaryQuery.data?.dueToday ?? 0;
    const reportsReadyCount = summaryQuery.data?.reportsReady ?? 0;
    const openBugCount = overview?.openBugCount ?? 0;

    if (blockedCount > 0) {
      items.push({
        key: 'blocked',
        title: text.reminderBlockedTitle,
        description: `${text.reminderBlockedDescriptionPrefix} ${blockedCount} ${text.reminderBlockedDescriptionSuffix}`,
        tag: text.focusRisk,
        color: 'error',
      });
    }
    if (dueTodayCount > 0) {
      items.push({
        key: 'due-today',
        title: text.reminderDueTodayTitle,
        description: `${text.reminderBlockedDescriptionPrefix} ${dueTodayCount} ${text.reminderDueTodayDescriptionSuffix}`,
        tag: text.focusWatch,
        color: 'warning',
      });
    }
    if (reportsReadyCount > 0) {
      items.push({
        key: 'reports',
        title: text.reminderReportsTitle,
        description: `${text.reminderBlockedDescriptionPrefix} ${reportsReadyCount} ${text.reminderReportsDescriptionSuffix}`,
        tag: text.reportsReady,
        color: 'processing',
      });
    }
    if (openBugCount > 0) {
      items.push({
        key: 'bugs',
        title: text.reminderBugTitle,
        description: `${text.reminderBlockedDescriptionPrefix} ${openBugCount} ${text.reminderBugDescriptionSuffix}`,
        tag: text.openBugs,
        color: 'default',
      });
    }

    if (items.length === 0) {
      items.push({
        key: 'clear',
        title: text.noReminders,
        description: text.noRemindersDescription,
        tag: text.healthHealthy,
        color: 'success',
      });
    }

    return items;
  }, [overview?.openBugCount, summaryQuery.data?.blocked, summaryQuery.data?.dueToday, summaryQuery.data?.reportsReady]);

  const hasProjectFilters = deferredProjectKeyword.trim() !== '' || projectStatusFilter !== 'all';
  const hasMemberFilters = deferredMemberKeyword.trim() !== '' || memberFocusFilter !== 'all';

  const clearProjectFilters = () => {
    setProjectKeyword('');
    setProjectStatusFilter('all');
  };

  const clearMemberFilters = () => {
    setMemberKeyword('');
    setMemberFocusFilter('all');
  };

  const projectColumns: ColumnsType<WorkspaceProjectOverview> = [
    {
      title: text.projectColumn,
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.code}</Typography.Text>
        </Space>
      ),
    },
    { title: text.ownerColumn, dataIndex: 'ownerName', width: 120 },
    { title: text.statusColumn, dataIndex: 'status', width: 100, render: (value: string) => <StatusTag value={value} /> },
    { title: text.healthColumn, dataIndex: 'health', width: 100, render: (value: WorkspaceProjectOverview['health']) => renderHealthTag(value) },
    { title: text.activeExecutionColumn, dataIndex: 'activeExecutionCount', width: 100 },
    { title: text.blockedExecutionColumn, dataIndex: 'blockedExecutionCount', width: 100 },
    { title: text.openBugColumn, dataIndex: 'openBugCount', width: 110 },
    {
      title: text.averageProgressColumn,
      dataIndex: 'averageProgress',
      width: 180,
      render: (value: number) => <Progress percent={value} size="small" />,
    },
    { title: text.dueSoonColumn, dataIndex: 'dueSoonCount', width: 110 },
    { title: text.lastActivityColumn, dataIndex: 'lastActivityAt', width: 140, render: (value: string) => value || '-' },
  ];

  const memberColumns: ColumnsType<WorkspaceMemberOverview> = [
    {
      title: text.memberColumn,
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.email || text.unregisteredEmail}</Typography.Text>
        </Space>
      ),
    },
    {
      title: text.departmentTitleColumn,
      dataIndex: 'department',
      width: 200,
      render: (_value, record) => `${record.department} / ${record.title}`,
    },
    {
      title: text.memberStatusColumn,
      dataIndex: 'status',
      width: 100,
      render: (value: WorkspaceMemberOverview['status']) => (
        <Tag color={value === 'Active' ? 'processing' : 'default'}>{value === 'Active' ? text.onDuty : text.invited}</Tag>
      ),
    },
    { title: text.activeExecutionColumn, dataIndex: 'activeExecutionCount', width: 100 },
    { title: text.blockedExecutionColumn, dataIndex: 'blockedExecutionCount', width: 100 },
    { title: text.pendingDailyTasksColumn, dataIndex: 'pendingDailyTaskCount', width: 100 },
    { title: text.relatedBugsColumn, dataIndex: 'openBugCount', width: 100 },
    { title: text.workHoursColumn, dataIndex: 'hoursThisWeek', width: 110, render: (value: number) => `${value.toFixed(1)} ${text.hoursSuffix}` },
    { title: text.lastActiveColumn, dataIndex: 'lastActivityAt', width: 140, render: (value: string) => value || '-' },
    { title: text.focusTagColumn, dataIndex: 'focusStatus', width: 140, render: (_value, record) => renderFocusTag(record) },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: text.overviewTab,
      children: isTeamDashboard ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card
              title={text.riskyProjectsCard}
              extra={<Typography.Text type="secondary">{`${riskyProjects.length} ${text.needAttentionSuffix}`}</Typography.Text>}
            >
              <List
                dataSource={riskyProjects}
                locale={{ emptyText: text.noRiskProjects }}
                renderItem={(item) => (
                  <List.Item extra={renderHealthTag(item.health)}>
                    <List.Item.Meta
                      title={item.name}
                      description={`${text.riskProjectSummary} ${item.ownerName} | ${text.blockedSummary} ${item.blockedExecutionCount} | ${text.bugSummary} ${item.openBugCount} | ${text.dueSoonSummary} ${item.dueSoonCount}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card
              title={text.keyMembersCard}
              extra={<Typography.Text type="secondary">{`${attentionMembers.length} ${text.needAttentionMemberSuffix}`}</Typography.Text>}
            >
              <List
                dataSource={attentionMembers}
                locale={{ emptyText: text.noKeyMembers }}
                renderItem={(item) => (
                  <List.Item extra={renderFocusTag(item)}>
                    <List.Item.Meta
                      title={item.name}
                      description={`${item.department} | ${text.inFlightSummary} ${item.activeExecutionCount} | ${text.blockedSummary} ${item.blockedExecutionCount} | ${text.workHoursSummary} ${item.hoursThisWeek.toFixed(1)} ${text.hoursSuffix}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card
              title={text.myProjectsCard}
              extra={<Typography.Text type="secondary">{`${projectOverview.length} ${text.projectUnit}`}</Typography.Text>}
            >
              <List
                dataSource={projectOverview.slice(0, 5)}
                locale={{ emptyText: text.noPersonalProjects }}
                renderItem={(item) => (
                  <List.Item extra={renderHealthTag(item.health)}>
                    <List.Item.Meta
                      title={item.name}
                      description={`${text.riskProjectSummary} ${item.ownerName} | ${text.progressSummary} ${item.averageProgress}% | ${text.dueSoonSummary} ${item.dueSoonCount}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title={text.myRemindersCard}>
              <List
                dataSource={personalReminders}
                renderItem={(item) => (
                  <List.Item extra={<Tag color={item.color}>{item.tag}</Tag>}>
                    <List.Item.Meta title={item.title} description={item.description} />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'project',
      label: isTeamDashboard ? text.projectTab : text.myProjectTab,
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="page-toolbar">
            <Space wrap>
              <Input.Search
                allowClear
                value={projectKeyword}
                onChange={(event) => setProjectKeyword(event.target.value)}
                placeholder={text.projectSearchPlaceholder}
                style={{ width: 300 }}
              />
              <Select
                value={projectStatusFilter}
                onChange={(value) => setProjectStatusFilter(value)}
                style={{ width: 160 }}
                options={projectStatusOptions.map((item) => ({ ...item }))}
              />
              {hasProjectFilters ? <Button onClick={clearProjectFilters}>{text.clearFilters}</Button> : null}
            </Space>
            <Typography.Text type="secondary">{`${text.displayPrefix} ${filteredProjects.length} / ${projectOverview.length} ${text.projectUnit}`}</Typography.Text>
          </div>
          <Table
            rowKey="id"
            columns={projectColumns}
            dataSource={filteredProjects}
            loading={summaryQuery.isLoading}
            pagination={false}
            locale={{ emptyText: hasProjectFilters ? text.noMatchedProjects : text.noProjectData }}
            scroll={{ x: 1280 }}
          />
        </Space>
      ),
    },
  ];

  if (isTeamDashboard) {
    tabItems.push({
      key: 'member',
      label: text.memberTab,
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="page-toolbar">
            <Space wrap>
              <Input.Search
                allowClear
                value={memberKeyword}
                onChange={(event) => setMemberKeyword(event.target.value)}
                placeholder={text.memberSearchPlaceholder}
                style={{ width: 320 }}
              />
              <Select
                value={memberFocusFilter}
                onChange={(value) => setMemberFocusFilter(value)}
                style={{ width: 160 }}
                options={memberFocusOptions.map((item) => ({ ...item }))}
              />
              {hasMemberFilters ? <Button onClick={clearMemberFilters}>{text.clearFilters}</Button> : null}
            </Space>
            <Typography.Text type="secondary">{`${text.displayPrefix} ${filteredMembers.length} / ${memberOverview.length} ${text.memberUnit}`}</Typography.Text>
          </div>
          <Table
            rowKey={(record) => `${record.id}-${record.name}`}
            columns={memberColumns}
            dataSource={filteredMembers}
            loading={summaryQuery.isLoading}
            pagination={false}
            locale={{ emptyText: hasMemberFilters ? text.noMatchedMembers : text.noMemberData }}
            scroll={{ x: 1380 }}
          />
        </Space>
      ),
    });
  }

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title={text.pageTitle}
        description={isTeamDashboard ? text.teamDescription : text.personalDescription}
        extra={
          <Space wrap>
            {canViewProjects ? <Button onClick={() => navigate('/projects')}>{text.projectList}</Button> : null}
            {canViewExecutions ? <Button onClick={() => navigate('/executions')}>{text.executionList}</Button> : null}
            {canViewSchedule ? <Button onClick={() => navigate('/gantt?view=team')}>{text.teamGantt}</Button> : null}
            {canViewSchedule ? <Button onClick={() => navigate('/gantt?view=project')}>{text.projectGantt}</Button> : null}
            {canViewBugs ? <Button onClick={() => navigate('/bugs')}>{text.bugCenter}</Button> : null}
            {canViewSettings ? (
              <Button type="primary" onClick={() => navigate('/settings')}>
                {text.memberSettings}
              </Button>
            ) : null}
          </Space>
        }
      />
      <Card className="workspace-mode-card" bodyStyle={{ padding: 16 }}>
        <Space wrap size={[12, 12]}>
          <Tag color={isTeamDashboard ? 'processing' : 'default'}>{isTeamDashboard ? text.teamMode : text.personalMode}</Tag>
          <Typography.Text type="secondary">{isTeamDashboard ? text.teamModeHint : text.personalModeHint}</Typography.Text>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        {metricCards.map((item) => (
          <Col key={item.key} xs={24} md={12} xl={isTeamDashboard ? 8 : 6}>
            <WorkspaceMetricCard item={item} loading={summaryQuery.isLoading} />
          </Col>
        ))}
      </Row>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </Space>
  );
}

function WorkspaceMetricCard({ item, loading }: { item: MetricCardItem; loading: boolean }) {
  return (
    <Card className={`workspace-metric-card workspace-metric-card--${item.tone}`} loading={loading}>
      <Typography.Text type="secondary">{item.title}</Typography.Text>
      <Typography.Title level={2} className="workspace-metric-card__value">
        {item.value}
      </Typography.Title>
      <Typography.Paragraph className="workspace-metric-card__hint">{item.hint}</Typography.Paragraph>
    </Card>
  );
}

function renderHealthTag(value: WorkspaceProjectOverview['health']) {
  return <Tag color={healthColorMap[value]}>{healthLabelMap[value]}</Tag>;
}

function renderFocusTag(member: WorkspaceMemberOverview) {
  return <Tag color={focusColorMap[member.focusStatus]}>{member.focusLabel || focusLabelMap[member.focusStatus]}</Tag>;
}