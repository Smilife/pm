import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Empty, Result, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../components/PageHeader';
import { formatApiError, pmApi } from '../services/api';
import type {
  SettingsDictionary,
  SettingsMember,
  SettingsPolicy,
  SettingsRole,
  SettingsWorkflow,
} from '../services/types';
import { useAuthStore } from '../store/authStore';

const settingsPermissions = {
  members: 'settings.member.manage.org',
  roles: 'settings.role.manage.org',
  policies: 'settings.policy.manage.org',
  dictionaries: 'settings.dictionary.view.org',
  workflows: 'settings.workflow.view.org',
} as const;

const memberColumns: ColumnsType<SettingsMember> = [
  {
    title: 'Member',
    dataIndex: 'name',
    render: (_value, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{record.name}</Typography.Text>
        <Typography.Text type="secondary">{record.title}</Typography.Text>
      </Space>
    ),
  },
  { title: 'Department', dataIndex: 'department', width: 180 },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 120,
    render: (value: SettingsMember['status']) => <Tag color={value === 'Active' ? 'success' : 'warning'}>{value}</Tag>,
  },
  {
    title: 'Roles',
    dataIndex: 'roles',
    width: 260,
    render: (value: string[]) => (
      <Space size={[4, 4]} wrap>
        {value.map((item) => (
          <Tag key={item} color="blue">
            {item}
          </Tag>
        ))}
      </Space>
    ),
  },
  { title: 'Permissions', dataIndex: 'permissionCount', width: 120 },
  {
    title: 'DingTalk',
    dataIndex: 'dingtalkBound',
    width: 120,
    render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? 'Bound' : 'Not bound'}</Tag>,
  },
  { title: 'Last login', dataIndex: 'lastLoginAt', width: 180 },
];

const roleColumns: ColumnsType<SettingsRole> = [
  {
    title: 'Role',
    dataIndex: 'name',
    render: (_value, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{record.name}</Typography.Text>
        <Typography.Text type="secondary">{record.key}</Typography.Text>
      </Space>
    ),
  },
  { title: 'Scope', dataIndex: 'scope', width: 120, render: (value: string) => <Tag>{value}</Tag> },
  { title: 'Users', dataIndex: 'userCount', width: 100 },
  { title: 'Permission count', dataIndex: 'permissions', width: 160, render: (value: string[]) => value.length },
  { title: 'Description', dataIndex: 'description' },
];

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const roles = useAuthStore((state) => state.roles);
  const permissions = useAuthStore((state) => state.permissions);

  const canViewMembers = permissions.includes(settingsPermissions.members);
  const canViewRoles = permissions.includes(settingsPermissions.roles);
  const canViewPolicies = permissions.includes(settingsPermissions.policies);
  const canViewDictionaries = permissions.includes(settingsPermissions.dictionaries);
  const canViewWorkflows = permissions.includes(settingsPermissions.workflows);
  const canViewAny = canViewMembers || canViewRoles || canViewPolicies || canViewDictionaries || canViewWorkflows;

  const membersQuery = useQuery({
    queryKey: ['settings-members'],
    queryFn: pmApi.getSettingsMembers,
    enabled: canViewMembers,
  });
  const rolesQuery = useQuery({
    queryKey: ['settings-roles'],
    queryFn: pmApi.getSettingsRoles,
    enabled: canViewRoles,
  });
  const policiesQuery = useQuery({
    queryKey: ['settings-policies'],
    queryFn: pmApi.getSettingsPolicies,
    enabled: canViewPolicies,
  });
  const dictionariesQuery = useQuery({
    queryKey: ['settings-dictionaries'],
    queryFn: pmApi.getSettingsDictionaries,
    enabled: canViewDictionaries,
  });
  const workflowsQuery = useQuery({
    queryKey: ['settings-workflows'],
    queryFn: pmApi.getSettingsWorkflows,
    enabled: canViewWorkflows,
  });

  const summary = useMemo(
    () => ({
      members: membersQuery.data?.length ?? 0,
      activeMembers: (membersQuery.data ?? []).filter((item) => item.status === 'Active').length,
      roleTemplates: rolesQuery.data?.length ?? 0,
      policies: policiesQuery.data?.length ?? 0,
      dictionaries: dictionariesQuery.data?.length ?? 0,
      workflows: workflowsQuery.data?.length ?? 0,
    }),
    [dictionariesQuery.data, membersQuery.data, policiesQuery.data, rolesQuery.data, workflowsQuery.data],
  );

  if (!canViewAny) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Your current role does not include access to organization settings."
      />
    );
  }

  const tabs = [] as {
    key: string;
    label: string;
    children: JSX.Element;
  }[];

  if (canViewMembers) {
    tabs.push({
      key: 'members',
      label: 'Members',
      children: renderMembersPanel(membersQuery.data ?? [], membersQuery.isLoading, membersQuery.error),
    });
  }

  if (canViewRoles) {
    tabs.push({
      key: 'roles',
      label: 'Roles',
      children: renderRolesPanel(rolesQuery.data ?? [], rolesQuery.isLoading, rolesQuery.error),
    });
  }

  if (canViewPolicies) {
    tabs.push({
      key: 'policies',
      label: 'Policies',
      children: renderPoliciesPanel(policiesQuery.data ?? [], policiesQuery.isLoading, policiesQuery.error),
    });
  }

  if (canViewDictionaries) {
    tabs.push({
      key: 'dictionaries',
      label: 'Dictionaries',
      children: renderDictionariesPanel(dictionariesQuery.data ?? [], dictionariesQuery.isLoading, dictionariesQuery.error),
    });
  }

  if (canViewWorkflows) {
    tabs.push({
      key: 'workflows',
      label: 'Workflows',
      children: renderWorkflowsPanel(workflowsQuery.data ?? [], workflowsQuery.isLoading, workflowsQuery.error),
    });
  }

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title="Settings"
        description="Read-only organization settings center for members, role templates, policy bundles, shared dictionaries, and workflow baselines."
        extra={
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{user?.name ?? 'Unknown user'}</Typography.Text>
            <Typography.Text type="secondary">{roles.join(', ') || 'No roles loaded'}</Typography.Text>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message="This settings center is backed by demo JSON data and current route-level permissions."
        description="It is ready for review, role validation, and future inline editing work."
      />

      <Space size={16} wrap>
        <Card>
          <Statistic title="Members" value={summary.members} />
          <Typography.Text type="secondary">Active: {summary.activeMembers}</Typography.Text>
        </Card>
        <Card>
          <Statistic title="Role templates" value={summary.roleTemplates} />
          <Typography.Text type="secondary">Current roles: {roles.length}</Typography.Text>
        </Card>
        <Card>
          <Statistic title="Policies" value={summary.policies} />
          <Typography.Text type="secondary">Permission groups for delivery and settings</Typography.Text>
        </Card>
        <Card>
          <Statistic title="Shared dictionaries" value={summary.dictionaries} />
          <Typography.Text type="secondary">Status values and severity sets</Typography.Text>
        </Card>
        <Card>
          <Statistic title="Workflow templates" value={summary.workflows} />
          <Typography.Text type="secondary">Requirement, defect, and report flows</Typography.Text>
        </Card>
      </Space>

      <Card>
        <Tabs items={tabs} />
      </Card>
    </Space>
  );
}

function renderMembersPanel(items: SettingsMember[], loading: boolean, error: unknown) {
  if (error) {
    return <Alert type="error" showIcon message="Failed to load members" description={formatApiError(error)} />;
  }

  return (
    <Table
      rowKey="id"
      columns={memberColumns}
      dataSource={items}
      loading={loading}
      pagination={false}
      scroll={{ x: 1180 }}
    />
  );
}

function renderRolesPanel(items: SettingsRole[], loading: boolean, error: unknown) {
  if (error) {
    return <Alert type="error" showIcon message="Failed to load roles" description={formatApiError(error)} />;
  }

  return (
    <Table
      rowKey="id"
      columns={roleColumns}
      dataSource={items}
      loading={loading}
      pagination={false}
      expandable={{
        expandedRowRender: (record) => (
          <Space size={[6, 6]} wrap>
            {record.permissions.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </Space>
        ),
        rowExpandable: (record) => record.permissions.length > 0,
      }}
      scroll={{ x: 1080 }}
    />
  );
}

function renderPoliciesPanel(items: SettingsPolicy[], loading: boolean, error: unknown) {
  if (error) {
    return <Alert type="error" showIcon message="Failed to load policies" description={formatApiError(error)} />;
  }

  if (!loading && items.length === 0) {
    return <Empty description="No policy bundles configured." />;
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Card key={item.id} size="small" title={item.name} extra={<Tag>{item.scope}</Tag>}>
          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{item.description}</Typography.Paragraph>
            <Space size={[6, 6]} wrap>
              {item.permissions.map((permission) => (
                <Tag key={permission}>{permission}</Tag>
              ))}
            </Space>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function renderDictionariesPanel(items: SettingsDictionary[], loading: boolean, error: unknown) {
  if (error) {
    return <Alert type="error" showIcon message="Failed to load dictionaries" description={formatApiError(error)} />;
  }

  if (!loading && items.length === 0) {
    return <Empty description="No dictionaries available." />;
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Card key={item.id} size="small" title={item.name} extra={<Typography.Text type="secondary">{item.updatedAt}</Typography.Text>}>
          <Space direction="vertical" size={8} style={{ display: 'flex' }}>
            <Typography.Text type="secondary">{item.key}</Typography.Text>
            <Space size={[6, 6]} wrap>
              {item.values.map((value) => (
                <Tag key={value} color="blue">
                  {value}
                </Tag>
              ))}
            </Space>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function renderWorkflowsPanel(items: SettingsWorkflow[], loading: boolean, error: unknown) {
  if (error) {
    return <Alert type="error" showIcon message="Failed to load workflows" description={formatApiError(error)} />;
  }

  if (!loading && items.length === 0) {
    return <Empty description="No workflows configured." />;
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Card
          key={item.id}
          size="small"
          title={item.name}
          extra={
            <Space>
              <Tag>{item.scope}</Tag>
              <Tag color={item.enabled ? 'success' : 'default'}>{item.enabled ? 'Enabled' : 'Disabled'}</Tag>
            </Space>
          }
        >
          <Space direction="vertical" size={8} style={{ display: 'flex' }}>
            <Typography.Text type="secondary">Updated at {item.updatedAt}</Typography.Text>
            <Space size={[6, 6]} wrap>
              {item.stages.map((stage) => (
                <Tag key={stage} color="geekblue">
                  {stage}
                </Tag>
              ))}
            </Space>
          </Space>
        </Card>
      ))}
    </Space>
  );
}
