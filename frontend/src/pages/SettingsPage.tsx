import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { FormInstance } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../components/PageHeader';
import { formatApiError, pmApi } from '../services/api';
import type {
  CreateSettingsMemberPayload,
  SettingsDictionary,
  SettingsMember,
  SettingsPolicy,
  SettingsRole,
  SettingsWorkflow,
  UpdateSettingsMemberPayload,
} from '../services/types';
import { useAuthStore } from '../store/authStore';

const settingsPermissions = {
  members: 'settings.member.manage.org',
  roles: 'settings.role.manage.org',
  policies: 'settings.policy.manage.org',
  dictionaries: 'settings.dictionary.view.org',
  workflows: 'settings.workflow.view.org',
} as const;

type MemberFormValues = CreateSettingsMemberPayload;

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
  const canManageMembers = permissions.includes(settingsPermissions.members);
  const canViewRoles = permissions.includes(settingsPermissions.roles);
  const canViewPolicies = permissions.includes(settingsPermissions.policies);
  const canViewDictionaries = permissions.includes(settingsPermissions.dictionaries);
  const canViewWorkflows = permissions.includes(settingsPermissions.workflows);
  const canViewAny = canManageMembers || canViewRoles || canViewPolicies || canViewDictionaries || canViewWorkflows;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SettingsMember | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<MemberFormValues>();
  const [editForm] = Form.useForm<MemberFormValues>();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ['settings-members'],
    queryFn: pmApi.getSettingsMembers,
    enabled: canManageMembers,
  });
  const rolesQuery = useQuery({
    queryKey: ['settings-roles'],
    queryFn: pmApi.getSettingsRoles,
    enabled: canViewRoles || canManageMembers,
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

  const createMemberMutation = useMutation<SettingsMember, unknown, CreateSettingsMemberPayload>({
    mutationFn: (payload) => pmApi.createSettingsMember(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-members'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-roles'] }),
      ]);
      setCreateModalOpen(false);
      createForm.resetFields();
      messageApi.success('Member invited. Default password is demo123.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateMemberMutation = useMutation<SettingsMember, unknown, { id: number; payload: UpdateSettingsMemberPayload }>({
    mutationFn: ({ id, payload }) => pmApi.updateSettingsMember(id, payload),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-members'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-roles'] }),
      ]);
      if (updated.id === user?.id) {
        await useAuthStore.getState().bootstrap();
      }
      setEditModalOpen(false);
      setEditingMember(null);
      editForm.resetFields();
      messageApi.success('Member updated.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const roleOptions = useMemo(
    () => (rolesQuery.data ?? []).map((item) => ({ label: item.name, value: item.key })),
    [rolesQuery.data],
  );

  const openCreateModal = () => {
    if (!canManageMembers) {
      messageApi.warning('Your current role cannot manage members.');
      return;
    }

    createForm.setFieldsValue({
      name: '',
      email: '',
      department: 'Engineering',
      title: 'Execution Member',
      status: 'Invited',
      roles: ['execution_member'],
      dingtalkBound: false,
    });
    setCreateModalOpen(true);
  };

  const openEditModal = (member: SettingsMember) => {
    if (!canManageMembers) {
      messageApi.warning('Your current role cannot manage members.');
      return;
    }

    setEditingMember(member);
    editForm.setFieldsValue({
      name: member.name,
      email: member.email,
      department: member.department,
      title: member.title,
      status: member.status,
      roles: member.roles,
      dingtalkBound: member.dingtalkBound,
    });
    setEditModalOpen(true);
  };

  const handleCreateMember = async () => {
    const values = await createForm.validateFields();
    createMemberMutation.mutate(normalizeMemberPayload(values));
  };

  const handleUpdateMember = async () => {
    if (!editingMember) {
      return;
    }

    const values = await editForm.validateFields();
    updateMemberMutation.mutate({
      id: editingMember.id,
      payload: normalizeMemberPayload(values),
    });
  };

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

  const memberColumns: ColumnsType<SettingsMember> = [
    {
      title: 'Member',
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.email}</Typography.Text>
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
    { title: 'Last login', dataIndex: 'lastLoginAt', width: 180, render: (value: string) => value || '-' },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_value, record) =>
        canManageMembers ? (
          <Button size="small" onClick={() => openEditModal(record)}>
            Edit
          </Button>
        ) : null,
    },
  ];

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

  if (canManageMembers) {
    tabs.push({
      key: 'members',
      label: 'Members',
      children: (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Alert
            type="info"
            showIcon
            message="Invited members use the default password demo123 until you replace auth with a real identity flow."
            description="Role selection automatically recomputes the member's permission set from the current role templates."
          />
          {membersQuery.error ? (
            <Alert type="error" showIcon message="Failed to load members" description={formatApiError(membersQuery.error)} />
          ) : (
            <Table
              rowKey="id"
              columns={memberColumns}
              dataSource={membersQuery.data ?? []}
              loading={membersQuery.isLoading}
              pagination={false}
              scroll={{ x: 1320 }}
            />
          )}
        </Space>
      ),
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
      {contextHolder}
      <PageHeader
        title="Settings"
        description="Organization settings center for members, role templates, policy bundles, shared dictionaries, and workflow baselines."
        extra={
          <Space>
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{user?.name ?? 'Unknown user'}</Typography.Text>
              <Typography.Text type="secondary">{roles.join(', ') || 'No roles loaded'}</Typography.Text>
            </Space>
            {canManageMembers ? (
              <Button type="primary" onClick={openCreateModal}>
                Invite member
              </Button>
            ) : null}
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message="Settings now support real member management while keeping role, policy, dictionary, and workflow tabs as overview views."
        description="This gives the demo workspace a realistic way to add accounts and test permission-aware navigation end to end."
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

      <Modal
        title="Invite member"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateMember}
        okText="Invite"
        confirmLoading={createMemberMutation.isPending}
      >
        <MemberEditorForm form={createForm} roleOptions={roleOptions} roleLoading={rolesQuery.isLoading} />
      </Modal>

      <Modal
        title={editingMember ? `Edit ${editingMember.name}` : 'Edit member'}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingMember(null);
        }}
        onOk={handleUpdateMember}
        okText="Save"
        confirmLoading={updateMemberMutation.isPending}
      >
        <MemberEditorForm form={editForm} roleOptions={roleOptions} roleLoading={rolesQuery.isLoading} />
      </Modal>
    </Space>
  );
}

function MemberEditorForm({
  form,
  roleOptions,
  roleLoading,
}: {
  form: FormInstance<MemberFormValues>;
  roleOptions: Array<{ label: string; value: string }>;
  roleLoading: boolean;
}) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Enter a member name.' }]}>
        <Input placeholder="Example: Zhang Wei" />
      </Form.Item>
      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'Enter a member email.' },
          { type: 'email', message: 'Enter a valid email.' },
        ]}
      >
        <Input placeholder="name@example.com" />
      </Form.Item>
      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="Department" name="department" rules={[{ required: true, message: 'Enter a department.' }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>
        <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Enter a title.' }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>
      </Space>
      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="Status" name="status" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: 'Invited', value: 'Invited' },
              { label: 'Active', value: 'Active' },
            ]}
          />
        </Form.Item>
        <Form.Item label="Roles" name="roles" rules={[{ required: true, message: 'Select at least one role.' }]} style={{ flex: 2 }}>
          <Select mode="multiple" options={roleOptions} loading={roleLoading} placeholder="Select roles" />
        </Form.Item>
      </Space>
      <Form.Item label="DingTalk bound" name="dingtalkBound" valuePropName="checked">
        <Switch checkedChildren="Bound" unCheckedChildren="Not bound" />
      </Form.Item>
    </Form>
  );
}

function normalizeMemberPayload(values: MemberFormValues): CreateSettingsMemberPayload {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    department: values.department.trim(),
    title: values.title.trim(),
    status: values.status,
    roles: Array.isArray(values.roles) ? values.roles : [],
    dingtalkBound: Boolean(values.dingtalkBound),
  };
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
