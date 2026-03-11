import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Input, List, Progress, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TabsProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { pmApi } from '../services/api';
import type { WorkspaceMemberOverview, WorkspaceProjectOverview } from '../services/types';

const settingsPermissions = [
  'settings.member.manage.org',
  'settings.role.manage.org',
  'settings.policy.manage.org',
  'settings.dictionary.view.org',
  'settings.workflow.view.org',
] as const;

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
  pageDescription: '\u9762\u5411\u56e2\u961f\u8d1f\u8d23\u4eba\u7684\u7ba1\u7406\u9a7e\u9a76\u8231\uff0c\u4ece\u9879\u76ee\u89c6\u89d2\u548c\u4eba\u5458\u89c6\u89d2\u5b9e\u65f6\u67e5\u770b\u63a8\u8fdb\u3001\u98ce\u9669\u4e0e\u5de5\u4f5c\u8d1f\u8f7d\u3002',
  projectList: '\u9879\u76ee\u5217\u8868',
  executionList: '\u6267\u884c\u5217\u8868',
  bugCenter: '\u7f3a\u9677\u4e2d\u5fc3',
  memberSettings: '\u6210\u5458\u4e0e\u8bbe\u7f6e',
  myExecutions: '\u6211\u8d1f\u8d23\u7684\u6267\u884c',
  dueToday: '\u4eca\u65e5\u5230\u671f',
  atRiskProjects: '\u98ce\u9669\u9879\u76ee',
  attentionMembers: '\u9700\u5173\u6ce8\u6210\u5458',
  openBugs: '\u672a\u5173\u95ed\u7f3a\u9677',
  reportsReady: '\u5f85\u751f\u6210\u62a5\u8868',
  projectCount: '\u9879\u76ee\u603b\u6570',
  memberCount: '\u6210\u5458\u8986\u76d6\u6570',
  activeMembers: '\u6d3b\u8dc3\u6210\u5458',
  blockedExecutions: '\u963b\u585e\u6267\u884c',
  overviewTab: '\u603b\u89c8',
  projectTab: '\u9879\u76ee\u89c6\u89d2',
  memberTab: '\u4eba\u5458\u89c6\u89d2',
  riskyProjectsCard: '\u98ce\u9669\u9879\u76ee',
  keyMembersCard: '\u91cd\u70b9\u6210\u5458',
  needAttentionSuffix: '\u4e2a\u9700\u5173\u6ce8',
  needAttentionMemberSuffix: '\u4f4d\u9700\u5173\u6ce8',
  noRiskProjects: '\u5f53\u524d\u6ca1\u6709\u9ad8\u98ce\u9669\u9879\u76ee\u3002',
  noKeyMembers: '\u5f53\u524d\u6ca1\u6709\u9700\u8981\u91cd\u70b9\u5173\u6ce8\u7684\u6210\u5458\u3002',
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
  const canViewSettings = settingsPermissions.some((permission) => permissions.includes(permission));
  const summaryQuery = useQuery({ queryKey: ['workspace-summary'], queryFn: pmApi.getWorkspaceSummary });

  const [projectKeyword, setProjectKeyword] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<WorkspaceProjectOverview['status'] | 'all'>('all');
  const [memberKeyword, setMemberKeyword] = useState('');
  const [memberFocusFilter, setMemberFocusFilter] = useState<WorkspaceMemberOverview['focusStatus'] | 'all'>('all');

  const deferredProjectKeyword = useDeferredValue(projectKeyword);
  const deferredMemberKeyword = useDeferredValue(memberKeyword);

  const overview = summaryQuery.data?.overview;
  const projectOverview = summaryQuery.data?.projectOverview ?? [];
  const memberOverview = summaryQuery.data?.memberOverview ?? [];

  const riskyProjects = useMemo(
    () => projectOverview.filter((item) => item.health !== 'healthy').slice(0, 5),
    [projectOverview],
  );
  const attentionMembers = useMemo(
    () => memberOverview.filter((item) => item.focusStatus === 'risk' || item.focusStatus === 'watch').slice(0, 5),
    [memberOverview],
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
    { title: text.focusTagColumn, dataIndex: 'focusStatus', width: 130, render: (_value, record) => renderFocusTag(record) },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: text.overviewTab,
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
        </Space>
      ),
    },
    {
      key: 'project',
      label: text.projectTab,
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
    {
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
    },
  ];

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title={text.pageTitle}
        description={text.pageDescription}
        extra={
          <Space wrap>
            {canViewProjects ? <Button onClick={() => navigate('/projects')}>{text.projectList}</Button> : null}
            {canViewExecutions ? <Button onClick={() => navigate('/executions')}>{text.executionList}</Button> : null}
            {canViewBugs ? <Button onClick={() => navigate('/bugs')}>{text.bugCenter}</Button> : null}
            {canViewSettings ? (
              <Button type="primary" onClick={() => navigate('/settings')}>
                {text.memberSettings}
              </Button>
            ) : null}
          </Space>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title={text.myExecutions} value={summaryQuery.data?.myExecutions ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title={text.dueToday} value={summaryQuery.data?.dueToday ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title={text.atRiskProjects} value={overview?.atRiskProjectCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title={text.attentionMembers} value={overview?.attentionMemberCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title={text.openBugs} value={overview?.openBugCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title={text.reportsReady} value={summaryQuery.data?.reportsReady ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title={text.projectCount} value={overview?.projectCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title={text.memberCount} value={overview?.memberCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title={text.activeMembers} value={overview?.activeMemberCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title={text.blockedExecutions} value={summaryQuery.data?.blocked ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
      </Row>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </Space>
  );
}

function renderHealthTag(value: WorkspaceProjectOverview['health']) {
  return <Tag color={healthColorMap[value]}>{healthLabelMap[value]}</Tag>;
}

function renderFocusTag(member: WorkspaceMemberOverview) {
  return <Tag color={focusColorMap[member.focusStatus]}>{member.focusLabel || focusLabelMap[member.focusStatus]}</Tag>;
}
