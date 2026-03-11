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

const projectStatusOptions = [
  { label: '\u5168\u90e8\u72b6\u6001', value: 'all' },
  { label: '\u8fdb\u884c\u4e2d', value: 'Active' },
  { label: '\u98ce\u9669', value: 'Risk' },
  { label: '\u5df2\u5b8c\u6210', value: 'Done' },
] as const;

const memberFocusOptions = [
  { label: '\u5168\u90e8\u6210\u5458', value: 'all' },
  { label: '\u9700\u8981\u534f\u8c03', value: 'risk' },
  { label: '\u9700\u8981\u5173\u6ce8', value: 'watch' },
  { label: '\u6295\u5165\u4e2d', value: 'active' },
  { label: '\u6682\u65e0\u5728\u9014', value: 'idle' },
] as const;

const healthColorMap: Record<WorkspaceProjectOverview['health'], string> = {
  healthy: 'success',
  watch: 'warning',
  risk: 'error',
};

const healthLabelMap: Record<WorkspaceProjectOverview['health'], string> = {
  healthy: '\u5065\u5eb7',
  watch: '\u5173\u6ce8',
  risk: '\u98ce\u9669',
};

const focusColorMap: Record<WorkspaceMemberOverview['focusStatus'], string> = {
  active: 'processing',
  watch: 'warning',
  risk: 'error',
  idle: 'default',
};

const focusLabelMap: Record<WorkspaceMemberOverview['focusStatus'], string> = {
  active: '\u6295\u5165\u4e2d',
  watch: '\u9700\u8981\u5173\u6ce8',
  risk: '\u9700\u8981\u534f\u8c03',
  idle: '\u6682\u65e0\u5728\u9014\u4e8b\u9879',
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
      title: '\u9879\u76ee',
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.code}</Typography.Text>
        </Space>
      ),
    },
    { title: '\u8d1f\u8d23\u4eba', dataIndex: 'ownerName', width: 120 },
    { title: '\u72b6\u6001', dataIndex: 'status', width: 100, render: (value: string) => <StatusTag value={value} /> },
    { title: '\u5065\u5eb7\u5ea6', dataIndex: 'health', width: 100, render: (value: WorkspaceProjectOverview['health']) => renderHealthTag(value) },
    { title: '\u5728\u9014\u6267\u884c', dataIndex: 'activeExecutionCount', width: 100 },
    { title: '\u963b\u585e\u6267\u884c', dataIndex: 'blockedExecutionCount', width: 100 },
    { title: '\u672a\u5173\u95ed\u7f3a\u9677', dataIndex: 'openBugCount', width: 110 },
    {
      title: '\u5e73\u5747\u8fdb\u5ea6',
      dataIndex: 'averageProgress',
      width: 180,
      render: (value: number) => <Progress percent={value} size="small" />,
    },
    { title: '\u8fd13\u5929\u5230\u671f', dataIndex: 'dueSoonCount', width: 110 },
    { title: '\u6700\u8fd1\u6d3b\u52a8', dataIndex: 'lastActivityAt', width: 140, render: (value: string) => value || '-' },
  ];

  const memberColumns: ColumnsType<WorkspaceMemberOverview> = [
    {
      title: '\u6210\u5458',
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.email || '\u672a\u767b\u8bb0\u90ae\u7bb1'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '\u90e8\u95e8 / \u5c97\u4f4d',
      dataIndex: 'department',
      width: 200,
      render: (_value, record) => `${record.department} / ${record.title}`,
    },
    {
      title: '\u6210\u5458\u72b6\u6001',
      dataIndex: 'status',
      width: 100,
      render: (value: WorkspaceMemberOverview['status']) => (
        <Tag color={value === 'Active' ? 'processing' : 'default'}>{value === 'Active' ? '\u5728\u5c97' : '\u5f85\u6fc0\u6d3b'}</Tag>
      ),
    },
    { title: '\u5728\u9014\u6267\u884c', dataIndex: 'activeExecutionCount', width: 100 },
    { title: '\u963b\u585e\u6267\u884c', dataIndex: 'blockedExecutionCount', width: 100 },
    { title: '\u5f85\u529e\u65e5\u5e38', dataIndex: 'pendingDailyTaskCount', width: 100 },
    { title: '\u76f8\u5173\u7f3a\u9677', dataIndex: 'openBugCount', width: 100 },
    { title: '\u8fd17\u5929\u5de5\u65f6', dataIndex: 'hoursThisWeek', width: 110, render: (value: number) => `${value.toFixed(1)} h` },
    { title: '\u6700\u8fd1\u6d3b\u8dc3', dataIndex: 'lastActivityAt', width: 140, render: (value: string) => value || '-' },
    { title: '\u5173\u6ce8\u6807\u7b7e', dataIndex: 'focusStatus', width: 130, render: (_value, record) => renderFocusTag(record) },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: '\u603b\u89c8',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card
                title="\u98ce\u9669\u9879\u76ee"
                extra={<Typography.Text type="secondary">{`${riskyProjects.length} \u4e2a\u9700\u5173\u6ce8`}</Typography.Text>}
              >
                <List
                  dataSource={riskyProjects}
                  locale={{ emptyText: '\u5f53\u524d\u6ca1\u6709\u9ad8\u98ce\u9669\u9879\u76ee\u3002' }}
                  renderItem={(item) => (
                    <List.Item extra={renderHealthTag(item.health)}>
                      <List.Item.Meta
                        title={item.name}
                        description={`\u8d1f\u8d23\u4eba ${item.ownerName} | \u963b\u585e ${item.blockedExecutionCount} | \u7f3a\u9677 ${item.openBugCount} | \u8fd13\u5929\u5230\u671f ${item.dueSoonCount}`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card
                title="\u91cd\u70b9\u6210\u5458"
                extra={<Typography.Text type="secondary">{`${attentionMembers.length} \u4f4d\u9700\u5173\u6ce8`}</Typography.Text>}
              >
                <List
                  dataSource={attentionMembers}
                  locale={{ emptyText: '\u5f53\u524d\u6ca1\u6709\u9700\u8981\u91cd\u70b9\u5173\u6ce8\u7684\u6210\u5458\u3002' }}
                  renderItem={(item) => (
                    <List.Item extra={renderFocusTag(item)}>
                      <List.Item.Meta
                        title={item.name}
                        description={`${item.department} | \u5728\u9014 ${item.activeExecutionCount} | \u963b\u585e ${item.blockedExecutionCount} | \u5de5\u65f6 ${item.hoursThisWeek.toFixed(1)} h`}
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
      label: '\u9879\u76ee\u89c6\u89d2',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="page-toolbar">
            <Space wrap>
              <Input.Search
                allowClear
                value={projectKeyword}
                onChange={(event) => setProjectKeyword(event.target.value)}
                placeholder="\u6309\u9879\u76ee\u540d\u3001\u7f16\u7801\u6216\u8d1f\u8d23\u4eba\u641c\u7d22"
                style={{ width: 300 }}
              />
              <Select
                value={projectStatusFilter}
                onChange={(value) => setProjectStatusFilter(value)}
                style={{ width: 160 }}
                options={projectStatusOptions.map((item) => ({ ...item }))}
              />
              {hasProjectFilters ? <Button onClick={clearProjectFilters}>\u6e05\u7a7a\u7b5b\u9009</Button> : null}
            </Space>
            <Typography.Text type="secondary">{`\u663e\u793a ${filteredProjects.length} / ${projectOverview.length} \u4e2a\u9879\u76ee`}</Typography.Text>
          </div>
          <Table
            rowKey="id"
            columns={projectColumns}
            dataSource={filteredProjects}
            loading={summaryQuery.isLoading}
            pagination={false}
            locale={{ emptyText: hasProjectFilters ? '\u6ca1\u6709\u5339\u914d\u7684\u9879\u76ee' : '\u6682\u65e0\u9879\u76ee\u6570\u636e' }}
            scroll={{ x: 1280 }}
          />
        </Space>
      ),
    },
    {
      key: 'member',
      label: '\u4eba\u5458\u89c6\u89d2',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="page-toolbar">
            <Space wrap>
              <Input.Search
                allowClear
                value={memberKeyword}
                onChange={(event) => setMemberKeyword(event.target.value)}
                placeholder="\u6309\u6210\u5458\u3001\u90e8\u95e8\u3001\u5c97\u4f4d\u6216\u90ae\u7bb1\u641c\u7d22"
                style={{ width: 320 }}
              />
              <Select
                value={memberFocusFilter}
                onChange={(value) => setMemberFocusFilter(value)}
                style={{ width: 160 }}
                options={memberFocusOptions.map((item) => ({ ...item }))}
              />
              {hasMemberFilters ? <Button onClick={clearMemberFilters}>\u6e05\u7a7a\u7b5b\u9009</Button> : null}
            </Space>
            <Typography.Text type="secondary">{`\u663e\u793a ${filteredMembers.length} / ${memberOverview.length} \u4f4d\u6210\u5458`}</Typography.Text>
          </div>
          <Table
            rowKey={(record) => `${record.id}-${record.name}`}
            columns={memberColumns}
            dataSource={filteredMembers}
            loading={summaryQuery.isLoading}
            pagination={false}
            locale={{ emptyText: hasMemberFilters ? '\u6ca1\u6709\u5339\u914d\u7684\u6210\u5458' : '\u6682\u65e0\u6210\u5458\u6570\u636e' }}
            scroll={{ x: 1380 }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title="\u5de5\u4f5c\u53f0"
        description="\u9762\u5411\u56e2\u961f\u8d1f\u8d23\u4eba\u7684\u7ba1\u7406\u9a7e\u9a76\u8231\uff0c\u4ece\u9879\u76ee\u89c6\u89d2\u548c\u4eba\u5458\u89c6\u89d2\u5b9e\u65f6\u67e5\u770b\u63a8\u8fdb\u3001\u98ce\u9669\u4e0e\u5de5\u4f5c\u8d1f\u8f7d\u3002"
        extra={
          <Space wrap>
            {canViewProjects ? <Button onClick={() => navigate('/projects')}>\u9879\u76ee\u5217\u8868</Button> : null}
            {canViewExecutions ? <Button onClick={() => navigate('/executions')}>\u6267\u884c\u5217\u8868</Button> : null}
            {canViewBugs ? <Button onClick={() => navigate('/bugs')}>\u7f3a\u9677\u4e2d\u5fc3</Button> : null}
            {canViewSettings ? (
              <Button type="primary" onClick={() => navigate('/settings')}>
                \u6210\u5458\u4e0e\u8bbe\u7f6e
              </Button>
            ) : null}
          </Space>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title="\u6211\u8d1f\u8d23\u7684\u6267\u884c" value={summaryQuery.data?.myExecutions ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title="\u4eca\u65e5\u5230\u671f" value={summaryQuery.data?.dueToday ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title="\u98ce\u9669\u9879\u76ee" value={overview?.atRiskProjectCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title="\u9700\u5173\u6ce8\u6210\u5458" value={overview?.attentionMemberCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title="\u672a\u5173\u95ed\u7f3a\u9677" value={overview?.openBugCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card>
            <Statistic title="\u5f85\u751f\u6210\u62a5\u8868" value={summaryQuery.data?.reportsReady ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="\u9879\u76ee\u603b\u6570" value={overview?.projectCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="\u6210\u5458\u8986\u76d6\u6570" value={overview?.memberCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="\u6d3b\u8dc3\u6210\u5458" value={overview?.activeMemberCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="\u963b\u585e\u6267\u884c" value={summaryQuery.data?.blocked ?? 0} loading={summaryQuery.isLoading} />
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
  return <Tag color={focusColorMap[member.focusStatus]}>{focusLabelMap[member.focusStatus]}</Tag>;
}
