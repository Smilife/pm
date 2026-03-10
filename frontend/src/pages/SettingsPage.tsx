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

const scopeLabelMap: Record<string, string> = {
  org: '组织级',
  project: '项目级',
  self: '个人级',
};

const roleNameMap: Record<string, string> = {
  super_admin: '超级管理员',
  org_admin: '组织管理员',
  project_admin: '项目管理员',
  requirement_owner: '需求负责人',
  execution_member: '执行成员',
  read_only: '只读成员',
};

const roleDescriptionMap: Record<string, string> = {
  super_admin: '拥有交付、报表和全局设置的完整访问权限。',
  org_admin: '负责成员、角色模板和基础策略配置。',
  project_admin: '负责项目内需求协同、执行排期和缺陷提交流程。',
  requirement_owner: '负责需求质量、评审准备和执行交接。',
  execution_member: '维护任务进度、工时日志、日常事项和相关缺陷。',
  read_only: '只提供交付过程的只读可见性，不包含编辑权限。',
};

const policyNameMap: Record<string, string> = {
  'Delivery control baseline': '交付管控基线',
  'Personal execution collaboration': '个人执行协同',
  'Organization settings control': '组织设置控制',
};

const policyDescriptionMap: Record<string, string> = {
  'Delivery control baseline': '默认分配给交付负责人，用于管理需求、计划和升级决策。',
  'Personal execution collaboration': '允许工程成员更新子任务、日志、日常事项和相关缺陷。',
  'Organization settings control': '授予成员、角色、策略、字典和流程配置的查看权限。',
};

const dictionaryNameMap: Record<string, string> = {
  requirement_status: '需求状态',
  execution_status: '执行状态',
  bug_severity: '缺陷严重程度',
  project_status: '项目状态',
};

const workflowNameMap: Record<string, string> = {
  'Requirement Review Flow': '需求评审流程',
  'Defect Triage Flow': '缺陷流转流程',
  'Daily Report Draft Flow': '日报草稿流程',
};

const valueLabelMap: Record<string, string> = {
  Draft: '草稿',
  Understanding: '需求澄清',
  Confirmed: '已确认',
  ToReview: '待评审',
  Reviewed: '已评审',
  Scheduled: '已排期',
  InDevelopment: '开发中',
  NotStarted: '未开始',
  InProgress: '进行中',
  Blocked: '阻塞',
  ToVerify: '待验证',
  Done: '完成',
  Closed: '关闭',
  Open: '已打开',
  Resolved: '已解决',
  Collect: '收集',
  Generate: '生成',
  Review: '审阅',
  Share: '分享',
  Low: '低',
  Medium: '中',
  High: '高',
  Critical: '严重',
  Active: '进行中',
  Risk: '风险',
};

const departmentLabelMap: Record<string, string> = {
  'Platform R&D': '平台研发',
  'Operations PMO': '运营 PMO',
  Product: '产品',
  Engineering: '工程',
  Leadership: '管理层',
};

const titleLabelMap: Record<string, string> = {
  'Platform Lead': '平台负责人',
  'Org Admin': '组织管理员',
  'Requirement Owner': '需求负责人',
  'Execution Member': '执行成员',
  'Read Only Observer': '只读观察者',
};

type MemberFormValues = CreateSettingsMemberPayload;

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
      messageApi.success('成员邀请成功，默认密码为 demo123。');
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
      messageApi.success('成员信息已更新。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const roleOptions = useMemo(
    () => (rolesQuery.data ?? []).map((item) => ({ label: formatRoleName(item.key, item.name), value: item.key })),
    [rolesQuery.data],
  );

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
      title: '成员',
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.email}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 180,
      render: (value: string) => formatDepartment(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: SettingsMember['status']) => <Tag color={value === 'Active' ? 'success' : 'warning'}>{value === 'Active' ? '启用' : '已邀请'}</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 260,
      render: (value: string[]) => (
        <Space size={[4, 4]} wrap>
          {value.map((item) => (
            <Tag key={item} color="blue">
              {formatRoleName(item, item)}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: '权限数', dataIndex: 'permissionCount', width: 120 },
    {
      title: '钉钉',
      dataIndex: 'dingtalkBound',
      width: 120,
      render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '已绑定' : '未绑定'}</Tag>,
    },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 180, render: (value: string) => value || '-' },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_value, record) =>
        canManageMembers ? (
          <Button size="small" onClick={() => openEditModal(record)}>
            编辑
          </Button>
        ) : null,
    },
  ];

  const roleColumns: ColumnsType<SettingsRole> = [
    {
      title: '角色',
      dataIndex: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{formatRoleName(record.key, record.name)}</Typography.Text>
          <Typography.Text type="secondary">{record.key}</Typography.Text>
        </Space>
      ),
    },
    { title: '范围', dataIndex: 'scope', width: 120, render: (value: string) => <Tag>{formatScope(value)}</Tag> },
    { title: '用户数', dataIndex: 'userCount', width: 100 },
    { title: '权限数', dataIndex: 'permissions', width: 120, render: (value: string[]) => value.length },
    { title: '说明', dataIndex: 'description', render: (_value, record) => formatRoleDescription(record.key, record.description) },
  ];

  const openCreateModal = () => {
    if (!canManageMembers) {
      messageApi.warning('当前角色没有管理成员的权限。');
      return;
    }

    createForm.setFieldsValue({
      name: '',
      email: '',
      department: '研发中心',
      title: '执行成员',
      status: 'Invited',
      roles: ['execution_member'],
      dingtalkBound: false,
    });
    setCreateModalOpen(true);
  };

  const openEditModal = (member: SettingsMember) => {
    if (!canManageMembers) {
      messageApi.warning('当前角色没有管理成员的权限。');
      return;
    }

    setEditingMember(member);
    editForm.setFieldsValue({
      name: member.name,
      email: member.email,
      department: formatDepartment(member.department),
      title: formatMemberTitle(member.title),
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

  if (!canViewAny) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="当前角色没有组织设置访问权限。"
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
      label: '成员',
      children: (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Alert
            type="info"
            showIcon
            message="新邀请成员会先使用默认密码 demo123，直到你接入真实身份系统。"
            description="角色选择会根据当前角色模板自动重算该成员的权限集合。"
          />
          {membersQuery.error ? (
            <Alert type="error" showIcon message="读取成员失败" description={formatApiError(membersQuery.error)} />
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
      label: '角色',
      children: renderRolesPanel(roleColumns, rolesQuery.data ?? [], rolesQuery.isLoading, rolesQuery.error),
    });
  }

  if (canViewPolicies) {
    tabs.push({
      key: 'policies',
      label: '策略',
      children: renderPoliciesPanel(policiesQuery.data ?? [], policiesQuery.isLoading, policiesQuery.error),
    });
  }

  if (canViewDictionaries) {
    tabs.push({
      key: 'dictionaries',
      label: '字典',
      children: renderDictionariesPanel(dictionariesQuery.data ?? [], dictionariesQuery.isLoading, dictionariesQuery.error),
    });
  }

  if (canViewWorkflows) {
    tabs.push({
      key: 'workflows',
      label: '流程',
      children: renderWorkflowsPanel(workflowsQuery.data ?? [], workflowsQuery.isLoading, workflowsQuery.error),
    });
  }

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="设置中心"
        description="组织级设置中心，用于查看成员、角色模板、策略包、共享字典和流程基线。"
        extra={
          <Space>
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{user?.name ?? '未知用户'}</Typography.Text>
              <Typography.Text type="secondary">{formatRoleList(roles)}</Typography.Text>
            </Space>
            {canManageMembers ? (
              <Button type="primary" onClick={openCreateModal}>
                邀请成员
              </Button>
            ) : null}
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message="设置中心现在已经支持真实的成员管理，角色、策略、字典和流程仍保持总览视图。"
        description="这样演示环境里就可以直接新增账号，并端到端验证权限感知的导航与页面行为。"
      />

      <Space size={16} wrap>
        <Card>
          <Statistic title="成员数" value={summary.members} />
          <Typography.Text type="secondary">启用中：{summary.activeMembers}</Typography.Text>
        </Card>
        <Card>
          <Statistic title="角色模板" value={summary.roleTemplates} />
          <Typography.Text type="secondary">当前账号角色：{roles.length}</Typography.Text>
        </Card>
        <Card>
          <Statistic title="策略包" value={summary.policies} />
          <Typography.Text type="secondary">交付与设置权限分组</Typography.Text>
        </Card>
        <Card>
          <Statistic title="共享字典" value={summary.dictionaries} />
          <Typography.Text type="secondary">状态枚举和严重程度集合</Typography.Text>
        </Card>
        <Card>
          <Statistic title="流程模板" value={summary.workflows} />
          <Typography.Text type="secondary">需求、缺陷与报表流程</Typography.Text>
        </Card>
      </Space>

      <Card>
        <Tabs items={tabs} />
      </Card>

      <Modal
        title="邀请成员"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateMember}
        okText="邀请"
        confirmLoading={createMemberMutation.isPending}
      >
        <MemberEditorForm form={createForm} roleOptions={roleOptions} roleLoading={rolesQuery.isLoading} />
      </Modal>

      <Modal
        title={editingMember ? `编辑 ${editingMember.name}` : '编辑成员'}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingMember(null);
        }}
        onOk={handleUpdateMember}
        okText="保存"
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
      <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入成员姓名。' }]}>
        <Input placeholder="例如：张伟" />
      </Form.Item>
      <Form.Item
        label="邮箱"
        name="email"
        rules={[
          { required: true, message: '请输入成员邮箱。' },
          { type: 'email', message: '请输入有效邮箱。' },
        ]}
      >
        <Input placeholder="name@example.com" />
      </Form.Item>
      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="部门" name="department" rules={[{ required: true, message: '请输入部门。' }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>
        <Form.Item label="岗位" name="title" rules={[{ required: true, message: '请输入岗位。' }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>
      </Space>
      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="状态" name="status" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: '已邀请', value: 'Invited' },
              { label: '启用', value: 'Active' },
            ]}
          />
        </Form.Item>
        <Form.Item label="角色" name="roles" rules={[{ required: true, message: '请至少选择一个角色。' }]} style={{ flex: 2 }}>
          <Select mode="multiple" options={roleOptions} loading={roleLoading} placeholder="请选择角色" />
        </Form.Item>
      </Space>
      <Form.Item label="钉钉绑定" name="dingtalkBound" valuePropName="checked">
        <Switch checkedChildren="已绑定" unCheckedChildren="未绑定" />
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

function renderRolesPanel(columns: ColumnsType<SettingsRole>, items: SettingsRole[], loading: boolean, error: unknown) {
  if (error) {
    return <Alert type="error" showIcon message="读取角色失败" description={formatApiError(error)} />;
  }

  return (
    <Table
      rowKey="id"
      columns={columns}
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
    return <Alert type="error" showIcon message="读取策略失败" description={formatApiError(error)} />;
  }

  if (!loading && items.length === 0) {
    return <Empty description="暂无策略包。" />;
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Card key={item.id} size="small" title={formatPolicyName(item.name)} extra={<Tag>{formatScope(item.scope)}</Tag>}>
          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{formatPolicyDescription(item.name, item.description)}</Typography.Paragraph>
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
    return <Alert type="error" showIcon message="读取字典失败" description={formatApiError(error)} />;
  }

  if (!loading && items.length === 0) {
    return <Empty description="暂无字典配置。" />;
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Card key={item.id} size="small" title={formatDictionaryName(item)} extra={<Typography.Text type="secondary">{item.updatedAt}</Typography.Text>}>
          <Space direction="vertical" size={8} style={{ display: 'flex' }}>
            <Typography.Text type="secondary">{item.key}</Typography.Text>
            <Space size={[6, 6]} wrap>
              {item.values.map((value) => (
                <Tag key={value} color="blue">
                  {formatValueLabel(value)}
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
    return <Alert type="error" showIcon message="读取流程失败" description={formatApiError(error)} />;
  }

  if (!loading && items.length === 0) {
    return <Empty description="暂无流程模板。" />;
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Card
          key={item.id}
          size="small"
          title={formatWorkflowName(item.name)}
          extra={
            <Space>
              <Tag>{formatScope(item.scope)}</Tag>
              <Tag color={item.enabled ? 'success' : 'default'}>{item.enabled ? '启用' : '停用'}</Tag>
            </Space>
          }
        >
          <Space direction="vertical" size={8} style={{ display: 'flex' }}>
            <Typography.Text type="secondary">最近更新 {item.updatedAt}</Typography.Text>
            <Space size={[6, 6]} wrap>
              {item.stages.map((stage) => (
                <Tag key={stage} color="geekblue">
                  {formatValueLabel(stage)}
                </Tag>
              ))}
            </Space>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function formatScope(value: string): string {
  return scopeLabelMap[value] ?? value;
}

function formatRoleName(key: string, fallback: string): string {
  return roleNameMap[key] ?? fallback;
}

function formatRoleDescription(key: string, fallback: string): string {
  return roleDescriptionMap[key] ?? fallback;
}

function formatPolicyName(value: string): string {
  return policyNameMap[value] ?? value;
}

function formatPolicyDescription(name: string, description: string): string {
  return policyDescriptionMap[name] ?? description;
}

function formatDictionaryName(item: SettingsDictionary): string {
  return dictionaryNameMap[item.key] ?? item.name;
}

function formatWorkflowName(value: string): string {
  return workflowNameMap[value] ?? value;
}

function formatValueLabel(value: string): string {
  return valueLabelMap[value] ?? value;
}

function formatDepartment(value: string): string {
  return departmentLabelMap[value] ?? value;
}

function formatMemberTitle(value: string): string {
  return titleLabelMap[value] ?? value;
}

function formatRoleList(values: string[]): string {
  if (values.length === 0) {
    return '未加载角色';
  }

  return values.map((item) => formatRoleName(item, item)).join('，');
}