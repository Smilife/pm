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
import type { FormInstance, TabsProps } from 'antd';
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
  UpdateSettingsDictionaryPayload,
  UpdateSettingsMemberPayload,
  UpdateSettingsPolicyPayload,
  UpdateSettingsRolePayload,
  UpdateSettingsWorkflowPayload,
} from '../services/types';
import { useAuthStore } from '../store/authStore';

const settingsPermissions = {
  members: 'settings.member.manage.org',
  roles: 'settings.role.manage.org',
  policies: 'settings.policy.manage.org',
  dictionariesView: 'settings.dictionary.view.org',
  dictionariesManage: 'settings.dictionary.manage.org',
  workflowsView: 'settings.workflow.view.org',
  workflowsManage: 'settings.workflow.manage.org',
} as const;

const scopeLabelMap: Record<string, string> = {
  org: '\u7ec4\u7ec7\u7ea7',
  project: '\u9879\u76ee\u7ea7',
  self: '\u4e2a\u4eba\u7ea7',
};

const departmentLabelMap: Record<string, string> = {
  'Platform R&D': '\u5e73\u53f0\u7814\u53d1',
  'Operations PMO': '\u8fd0\u8425 PMO',
  Product: '\u4ea7\u54c1',
  Engineering: '\u5de5\u7a0b',
  Leadership: '\u7ba1\u7406\u5c42',
};

const titleLabelMap: Record<string, string> = {
  'Platform Lead': '\u5e73\u53f0\u8d1f\u8d23\u4eba',
  'Org Admin': '\u7ec4\u7ec7\u7ba1\u7406\u5458',
  'Requirement Owner': '\u9700\u6c42\u8d1f\u8d23\u4eba',
  'Execution Member': '\u6267\u884c\u6210\u5458',
  'Read Only Observer': '\u53ea\u8bfb\u89c2\u5bdf\u8005',
};

const departmentOptions = Object.entries(departmentLabelMap).map(([value, label]) => ({ value, label }));
const titleOptions = Object.entries(titleLabelMap).map(([value, label]) => ({ value, label }));
const scopeOptions = Object.entries(scopeLabelMap).map(([value, label]) => ({ value, label }));
const memberStatusOptions = [
  { value: 'Invited', label: '\u5df2\u9080\u8bf7' },
  { value: 'Active', label: '\u542f\u7528\u4e2d' },
] as const;

type MemberFormValues = CreateSettingsMemberPayload;
type RoleFormValues = UpdateSettingsRolePayload;
type PolicyFormValues = UpdateSettingsPolicyPayload;
type DictionaryFormValues = UpdateSettingsDictionaryPayload;
type WorkflowFormValues = UpdateSettingsWorkflowPayload;

export function SettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const currentRoles = useAuthStore((state) => state.roles);
  const permissions = useAuthStore((state) => state.permissions);
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  const canManageMembers = permissions.includes(settingsPermissions.members);
  const canManageRoles = permissions.includes(settingsPermissions.roles);
  const canViewRoles = canManageRoles || canManageMembers;
  const canManagePolicies = permissions.includes(settingsPermissions.policies);
  const canViewPolicies = canManagePolicies;
  const canManageDictionaries = permissions.includes(settingsPermissions.dictionariesManage);
  const canViewDictionaries = canManageDictionaries || permissions.includes(settingsPermissions.dictionariesView);
  const canManageWorkflows = permissions.includes(settingsPermissions.workflowsManage);
  const canViewWorkflows = canManageWorkflows || permissions.includes(settingsPermissions.workflowsView);
  const canViewAny = canManageMembers || canViewRoles || canViewPolicies || canViewDictionaries || canViewWorkflows;

  const [createMemberModalOpen, setCreateMemberModalOpen] = useState(false);
  const [editMemberModalOpen, setEditMemberModalOpen] = useState(false);
  const [editRoleModalOpen, setEditRoleModalOpen] = useState(false);
  const [editPolicyModalOpen, setEditPolicyModalOpen] = useState(false);
  const [editDictionaryModalOpen, setEditDictionaryModalOpen] = useState(false);
  const [editWorkflowModalOpen, setEditWorkflowModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SettingsMember | null>(null);
  const [editingRole, setEditingRole] = useState<SettingsRole | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<SettingsPolicy | null>(null);
  const [editingDictionary, setEditingDictionary] = useState<SettingsDictionary | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<SettingsWorkflow | null>(null);

  const [createMemberForm] = Form.useForm<MemberFormValues>();
  const [editMemberForm] = Form.useForm<MemberFormValues>();
  const [editRoleForm] = Form.useForm<RoleFormValues>();
  const [editPolicyForm] = Form.useForm<PolicyFormValues>();
  const [editDictionaryForm] = Form.useForm<DictionaryFormValues>();
  const [editWorkflowForm] = Form.useForm<WorkflowFormValues>();

  const membersQuery = useQuery({ queryKey: ['settings-members'], queryFn: pmApi.getSettingsMembers, enabled: canManageMembers });
  const rolesQuery = useQuery({ queryKey: ['settings-roles'], queryFn: pmApi.getSettingsRoles, enabled: canViewRoles });
  const policiesQuery = useQuery({ queryKey: ['settings-policies'], queryFn: pmApi.getSettingsPolicies, enabled: canViewPolicies });
  const dictionariesQuery = useQuery({ queryKey: ['settings-dictionaries'], queryFn: pmApi.getSettingsDictionaries, enabled: canViewDictionaries });
  const workflowsQuery = useQuery({ queryKey: ['settings-workflows'], queryFn: pmApi.getSettingsWorkflows, enabled: canViewWorkflows });
  const permissionOptions = useMemo(() => {
    const values = new Set<string>();
    for (const role of rolesQuery.data ?? []) {
      for (const permission of role.permissions) {
        values.add(permission);
      }
    }
    for (const policy of policiesQuery.data ?? []) {
      for (const permission of policy.permissions) {
        values.add(permission);
      }
    }
    return Array.from(values).sort().map((value) => ({ value, label: value }));
  }, [rolesQuery.data, policiesQuery.data]);

  const roleOptions = useMemo(
    () => (rolesQuery.data ?? []).map((item) => ({ value: item.key, label: item.name })),
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
    [membersQuery.data, rolesQuery.data, policiesQuery.data, dictionariesQuery.data, workflowsQuery.data],
  );

  const createMemberMutation = useMutation({
    mutationFn: (payload: CreateSettingsMemberPayload) => pmApi.createSettingsMember(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-members'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-roles'] }),
      ]);
      setCreateMemberModalOpen(false);
      createMemberForm.resetFields();
      messageApi.success('\u6210\u5458\u9080\u8bf7\u6210\u529f\uff0c\u9ed8\u8ba4\u5bc6\u7801\u4e3a demo123\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSettingsMemberPayload }) => pmApi.updateSettingsMember(id, payload),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-members'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-roles'] }),
      ]);
      if (updated.id === currentUser?.id) {
        await useAuthStore.getState().bootstrap();
      }
      setEditMemberModalOpen(false);
      setEditingMember(null);
      editMemberForm.resetFields();
      messageApi.success('\u6210\u5458\u4fe1\u606f\u5df2\u66f4\u65b0\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSettingsRolePayload }) => pmApi.updateSettingsRole(id, payload),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-roles'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-members'] }),
      ]);
      if (currentRoles.includes(updated.key)) {
        await useAuthStore.getState().bootstrap();
      }
      setEditRoleModalOpen(false);
      setEditingRole(null);
      editRoleForm.resetFields();
      messageApi.success('\u89d2\u8272\u6a21\u677f\u5df2\u66f4\u65b0\uff0c\u76f8\u5173\u6210\u5458\u6743\u9650\u5df2\u81ea\u52a8\u91cd\u7b97\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const updatePolicyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSettingsPolicyPayload }) => pmApi.updateSettingsPolicy(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-policies'] });
      setEditPolicyModalOpen(false);
      setEditingPolicy(null);
      editPolicyForm.resetFields();
      messageApi.success('\u7b56\u7565\u5305\u5df2\u66f4\u65b0\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const updateDictionaryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSettingsDictionaryPayload }) => pmApi.updateSettingsDictionary(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-dictionaries'] });
      setEditDictionaryModalOpen(false);
      setEditingDictionary(null);
      editDictionaryForm.resetFields();
      messageApi.success('\u5171\u4eab\u5b57\u5178\u5df2\u66f4\u65b0\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSettingsWorkflowPayload }) => pmApi.updateSettingsWorkflow(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workflows'] });
      setEditWorkflowModalOpen(false);
      setEditingWorkflow(null);
      editWorkflowForm.resetFields();
      messageApi.success('\u6d41\u7a0b\u6a21\u677f\u5df2\u66f4\u65b0\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const memberColumns: ColumnsType<SettingsMember> = [
    { title: '\u6210\u5458', dataIndex: 'name', render: (_value, record) => <Space direction="vertical" size={0}><Typography.Text strong>{record.name}</Typography.Text><Typography.Text type="secondary">{record.email}</Typography.Text></Space> },
    { title: '\u90e8\u95e8', dataIndex: 'department', width: 140, render: (value: string) => formatDepartment(value) },
    { title: '\u5c97\u4f4d', dataIndex: 'title', width: 160, render: (value: string) => formatTitle(value) },
    { title: '\u72b6\u6001', dataIndex: 'status', width: 120, render: (value: SettingsMember['status']) => <Tag color={value === 'Active' ? 'success' : 'warning'}>{value === 'Active' ? '\u542f\u7528\u4e2d' : '\u5df2\u9080\u8bf7'}</Tag> },
    { title: '\u89d2\u8272', dataIndex: 'roles', width: 240, render: (value: string[]) => <Space size={[4, 4]} wrap>{value.map((item) => <Tag key={item} color="blue">{item}</Tag>)}</Space> },
    { title: '\u6743\u9650\u6570', dataIndex: 'permissionCount', width: 100 },
    { title: '\u9489\u9489', dataIndex: 'dingtalkBound', width: 100, render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '\u5df2\u7ed1\u5b9a' : '\u672a\u7ed1\u5b9a'}</Tag> },
    { title: '\u6700\u8fd1\u767b\u5f55', dataIndex: 'lastLoginAt', width: 180, render: (value: string) => value || '-' },
    { title: '\u64cd\u4f5c', key: 'actions', width: 100, render: (_value, record) => <Button size="small" onClick={() => openEditMemberModal(record)}>\u7f16\u8f91</Button> },
  ];

  const roleColumns: ColumnsType<SettingsRole> = [
    { title: '\u89d2\u8272\u6a21\u677f', dataIndex: 'name', render: (_value, record) => <Space direction="vertical" size={0}><Typography.Text strong>{record.name}</Typography.Text><Typography.Text type="secondary">{record.key}</Typography.Text></Space> },
    { title: '\u8303\u56f4', dataIndex: 'scope', width: 110, render: (value: string) => <Tag>{formatScope(value)}</Tag> },
    { title: '\u6210\u5458\u6570', dataIndex: 'userCount', width: 100 },
    { title: '\u6743\u9650\u6570', dataIndex: 'permissions', width: 100, render: (value: string[]) => value.length },
    { title: '\u8bf4\u660e', dataIndex: 'description' },
  ];

  if (canManageRoles) {
    roleColumns.push({ title: '\u64cd\u4f5c', key: 'actions', width: 100, render: (_value, record) => <Button size="small" onClick={() => openEditRoleModal(record)}>\u7f16\u8f91</Button> });
  }

  const openCreateMemberModal = () => {
    createMemberForm.setFieldsValue({ name: '', email: '', department: 'Engineering', title: 'Execution Member', status: 'Invited', roles: ['execution_member'], dingtalkBound: false });
    setCreateMemberModalOpen(true);
  };
  const openEditMemberModal = (member: SettingsMember) => {
    setEditingMember(member);
    editMemberForm.setFieldsValue({ name: member.name, email: member.email, department: member.department, title: member.title, status: member.status, roles: member.roles, dingtalkBound: member.dingtalkBound });
    setEditMemberModalOpen(true);
  };
  const openEditRoleModal = (role: SettingsRole) => {
    setEditingRole(role);
    editRoleForm.setFieldsValue({ name: role.name, scope: role.scope, description: role.description, permissions: role.permissions });
    setEditRoleModalOpen(true);
  };
  const openEditPolicyModal = (policy: SettingsPolicy) => {
    setEditingPolicy(policy);
    editPolicyForm.setFieldsValue({ name: policy.name, scope: policy.scope, description: policy.description, permissions: policy.permissions });
    setEditPolicyModalOpen(true);
  };
  const openEditDictionaryModal = (dictionary: SettingsDictionary) => {
    setEditingDictionary(dictionary);
    editDictionaryForm.setFieldsValue({ name: dictionary.name, values: dictionary.values });
    setEditDictionaryModalOpen(true);
  };
  const openEditWorkflowModal = (workflow: SettingsWorkflow) => {
    setEditingWorkflow(workflow);
    editWorkflowForm.setFieldsValue({ name: workflow.name, scope: workflow.scope, stages: workflow.stages, enabled: workflow.enabled });
    setEditWorkflowModalOpen(true);
  };
  const tabs: TabsProps['items'] = [];

  if (canManageMembers) {
    tabs.push({
      key: 'members',
      label: '\u6210\u5458',
      children: <Space direction="vertical" size={16} style={{ display: 'flex' }}><Alert type="info" showIcon message="\u65b0\u9080\u8bf7\u6210\u5458\u4f1a\u5148\u4f7f\u7528\u9ed8\u8ba4\u5bc6\u7801 demo123\u3002" description="\u4fee\u6539\u89d2\u8272\u6a21\u677f\u540e\uff0c\u5173\u8054\u6210\u5458\u7684\u6743\u9650\u4f1a\u81ea\u52a8\u91cd\u7b97\u3002" />{membersQuery.error ? <Alert type="error" showIcon message="\u8bfb\u53d6\u6210\u5458\u5931\u8d25" description={formatApiError(membersQuery.error)} /> : <Table rowKey="id" columns={memberColumns} dataSource={membersQuery.data ?? []} loading={membersQuery.isLoading} pagination={false} scroll={{ x: 1320 }} />}</Space>,
    });
  }

  if (canViewRoles) {
    tabs.push({
      key: 'roles',
      label: '\u89d2\u8272',
      children: rolesQuery.error ? <Alert type="error" showIcon message="\u8bfb\u53d6\u89d2\u8272\u6a21\u677f\u5931\u8d25" description={formatApiError(rolesQuery.error)} /> : <Table rowKey="id" columns={roleColumns} dataSource={rolesQuery.data ?? []} loading={rolesQuery.isLoading} pagination={false} expandable={{ expandedRowRender: (record) => <Space size={[6, 6]} wrap>{record.permissions.map((item) => <Tag key={item}>{item}</Tag>)}</Space>, rowExpandable: (record) => record.permissions.length > 0 }} scroll={{ x: 1080 }} />,
    });
  }

  if (canViewPolicies) {
    tabs.push({
      key: 'policies',
      label: '\u7b56\u7565',
      children: renderPoliciesPanel(policiesQuery.data ?? [], policiesQuery.isLoading, policiesQuery.error, canManagePolicies, openEditPolicyModal),
    });
  }

  if (canViewDictionaries) {
    tabs.push({
      key: 'dictionaries',
      label: '\u5b57\u5178',
      children: renderDictionariesPanel(dictionariesQuery.data ?? [], dictionariesQuery.isLoading, dictionariesQuery.error, canManageDictionaries, openEditDictionaryModal),
    });
  }

  if (canViewWorkflows) {
    tabs.push({
      key: 'workflows',
      label: '\u6d41\u7a0b',
      children: renderWorkflowsPanel(workflowsQuery.data ?? [], workflowsQuery.isLoading, workflowsQuery.error, canManageWorkflows, openEditWorkflowModal),
    });
  }

  if (!canViewAny) {
    return <Result status="403" title="403" subTitle="\u5f53\u524d\u89d2\u8272\u6ca1\u6709\u8bbf\u95ee\u7ec4\u7ec7\u8bbe\u7f6e\u7684\u6743\u9650\u3002" />;
  }

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader title="\u8bbe\u7f6e\u4e2d\u5fc3" description="\u7edf\u4e00\u67e5\u770b\u4e0e\u7ef4\u62a4\u6210\u5458\u3001\u89d2\u8272\u6a21\u677f\u3001\u7b56\u7565\u5305\u3001\u5171\u4eab\u5b57\u5178\u548c\u6d41\u7a0b\u6a21\u677f\u3002" extra={<Space><Space direction="vertical" size={0}><Typography.Text strong>{currentUser?.name ?? '\u672a\u77e5\u7528\u6237'}</Typography.Text><Typography.Text type="secondary">{formatRoleList(currentRoles)}</Typography.Text></Space>{canManageMembers ? <Button type="primary" onClick={openCreateMemberModal}>\u9080\u8bf7\u6210\u5458</Button> : null}</Space>} />
      <Alert type="info" showIcon message="\u8bbe\u7f6e\u4e2d\u5fc3\u5df2\u7ecf\u652f\u6301\u771f\u5b9e\u7f16\u8f91\u3002" description="\u6210\u5458\u3001\u89d2\u8272\u6a21\u677f\u548c\u7b56\u7565\u5305\u53ef\u4ee5\u76f4\u63a5\u4fee\u6539\uff1b\u5171\u4eab\u5b57\u5178\u4e0e\u6d41\u7a0b\u6a21\u677f\u9700\u8981\u5177\u5907\u66f4\u9ad8\u7684\u8bbe\u7f6e\u6743\u9650\u65f6\u624d\u4f1a\u663e\u793a\u7f16\u8f91\u6309\u94ae\u3002" />
      <Space size={16} wrap>
        <Card><Statistic title="\u6210\u5458\u6570" value={summary.members} /><Typography.Text type="secondary">\u542f\u7528\u4e2d\uff1a{summary.activeMembers}</Typography.Text></Card>
        <Card><Statistic title="\u89d2\u8272\u6a21\u677f" value={summary.roleTemplates} /><Typography.Text type="secondary">\u5f53\u524d\u8d26\u53f7\u89d2\u8272\uff1a{currentRoles.length}</Typography.Text></Card>
        <Card><Statistic title="\u7b56\u7565\u5305" value={summary.policies} /><Typography.Text type="secondary">\u4ea4\u4ed8\u4e0e\u7ec4\u7ec7\u63a7\u5236\u80fd\u529b</Typography.Text></Card>
        <Card><Statistic title="\u5171\u4eab\u5b57\u5178" value={summary.dictionaries} /><Typography.Text type="secondary">\u72b6\u6001\u679a\u4e3e\u4e0e\u4e25\u91cd\u7a0b\u5ea6\u96c6\u5408</Typography.Text></Card>
        <Card><Statistic title="\u6d41\u7a0b\u6a21\u677f" value={summary.workflows} /><Typography.Text type="secondary">\u9700\u6c42\u3001\u7f3a\u9677\u4e0e\u62a5\u8868\u6d41\u7a0b</Typography.Text></Card>
      </Space>
      <Card><Tabs items={tabs} /></Card>

      <Modal title="\u9080\u8bf7\u6210\u5458" open={createMemberModalOpen} onCancel={() => setCreateMemberModalOpen(false)} onOk={async () => createMemberMutation.mutate(normalizeMemberPayload(await createMemberForm.validateFields()))} okText="\u53d1\u9001\u9080\u8bf7" confirmLoading={createMemberMutation.isPending}><MemberEditorForm form={createMemberForm} roleOptions={roleOptions} roleLoading={rolesQuery.isLoading} /></Modal>
      <Modal title={editingMember ? `\u7f16\u8f91\u6210\u5458\uff1a${editingMember.name}` : '\u7f16\u8f91\u6210\u5458'} open={editMemberModalOpen} onCancel={() => { setEditMemberModalOpen(false); setEditingMember(null); }} onOk={async () => editingMember && updateMemberMutation.mutate({ id: editingMember.id, payload: normalizeMemberPayload(await editMemberForm.validateFields()) })} okText="\u4fdd\u5b58" confirmLoading={updateMemberMutation.isPending}><MemberEditorForm form={editMemberForm} roleOptions={roleOptions} roleLoading={rolesQuery.isLoading} /></Modal>
      <Modal title={editingRole ? `\u7f16\u8f91\u89d2\u8272\uff1a${editingRole.name}` : '\u7f16\u8f91\u89d2\u8272'} open={editRoleModalOpen} onCancel={() => { setEditRoleModalOpen(false); setEditingRole(null); }} onOk={async () => editingRole && updateRoleMutation.mutate({ id: editingRole.id, payload: normalizeRolePayload(await editRoleForm.validateFields()) })} okText="\u4fdd\u5b58" width={760} confirmLoading={updateRoleMutation.isPending}><RoleEditorForm form={editRoleForm} roleKey={editingRole?.key ?? ''} permissionOptions={permissionOptions} /></Modal>
      <Modal title={editingPolicy ? `\u7f16\u8f91\u7b56\u7565\uff1a${editingPolicy.name}` : '\u7f16\u8f91\u7b56\u7565'} open={editPolicyModalOpen} onCancel={() => { setEditPolicyModalOpen(false); setEditingPolicy(null); }} onOk={async () => editingPolicy && updatePolicyMutation.mutate({ id: editingPolicy.id, payload: normalizePolicyPayload(await editPolicyForm.validateFields()) })} okText="\u4fdd\u5b58" width={760} confirmLoading={updatePolicyMutation.isPending}><PolicyEditorForm form={editPolicyForm} permissionOptions={permissionOptions} /></Modal>
      <Modal title={editingDictionary ? `\u7f16\u8f91\u5b57\u5178\uff1a${editingDictionary.name}` : '\u7f16\u8f91\u5b57\u5178'} open={editDictionaryModalOpen} onCancel={() => { setEditDictionaryModalOpen(false); setEditingDictionary(null); }} onOk={async () => editingDictionary && updateDictionaryMutation.mutate({ id: editingDictionary.id, payload: normalizeDictionaryPayload(await editDictionaryForm.validateFields()) })} okText="\u4fdd\u5b58" confirmLoading={updateDictionaryMutation.isPending}><DictionaryEditorForm form={editDictionaryForm} dictionaryKey={editingDictionary?.key ?? ''} /></Modal>
      <Modal title={editingWorkflow ? `\u7f16\u8f91\u6d41\u7a0b\uff1a${editingWorkflow.name}` : '\u7f16\u8f91\u6d41\u7a0b'} open={editWorkflowModalOpen} onCancel={() => { setEditWorkflowModalOpen(false); setEditingWorkflow(null); }} onOk={async () => editingWorkflow && updateWorkflowMutation.mutate({ id: editingWorkflow.id, payload: normalizeWorkflowPayload(await editWorkflowForm.validateFields()) })} okText="\u4fdd\u5b58" confirmLoading={updateWorkflowMutation.isPending}><WorkflowEditorForm form={editWorkflowForm} /></Modal>
    </Space>
  );
}
function MemberEditorForm({ form, roleOptions, roleLoading }: { form: FormInstance<MemberFormValues>; roleOptions: Array<{ value: string; label: string }>; roleLoading: boolean }) {
  return <Form form={form} layout="vertical"><Form.Item label="\u59d3\u540d" name="name" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u6210\u5458\u59d3\u540d\u3002' }]}><Input placeholder="Zhang Wei" /></Form.Item><Form.Item label="\u90ae\u7bb1" name="email" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u6210\u5458\u90ae\u7bb1\u3002' }, { type: 'email', message: '\u8bf7\u8f93\u5165\u6709\u6548\u90ae\u7bb1\u3002' }]}><Input placeholder="name@example.com" /></Form.Item><Space size={12} style={{ width: '100%' }} align="start"><Form.Item label="\u90e8\u95e8" name="department" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u90e8\u95e8\u3002' }]} style={{ flex: 1 }}><Select options={departmentOptions} placeholder="\u8bf7\u9009\u62e9\u90e8\u95e8" /></Form.Item><Form.Item label="\u5c97\u4f4d" name="title" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u5c97\u4f4d\u3002' }]} style={{ flex: 1 }}><Select options={titleOptions} placeholder="\u8bf7\u9009\u62e9\u5c97\u4f4d" /></Form.Item></Space><Space size={12} style={{ width: '100%' }} align="start"><Form.Item label="\u72b6\u6001" name="status" rules={[{ required: true }]} style={{ flex: 1 }}><Select options={memberStatusOptions.map((item) => ({ ...item }))} /></Form.Item><Form.Item label="\u89d2\u8272" name="roles" rules={[{ required: true, message: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u89d2\u8272\u3002' }]} style={{ flex: 2 }}><Select mode="multiple" options={roleOptions} loading={roleLoading} placeholder="\u8bf7\u9009\u62e9\u89d2\u8272" /></Form.Item></Space><Form.Item label="\u9489\u9489\u7ed1\u5b9a" name="dingtalkBound" valuePropName="checked"><Switch checkedChildren="\u5df2\u7ed1\u5b9a" unCheckedChildren="\u672a\u7ed1\u5b9a" /></Form.Item></Form>;
}

function RoleEditorForm({ form, roleKey, permissionOptions }: { form: FormInstance<RoleFormValues>; roleKey: string; permissionOptions: Array<{ value: string; label: string }> }) {
  return <Form form={form} layout="vertical"><Form.Item label="Role Key"><Input value={roleKey} disabled /></Form.Item><Space size={12} style={{ width: '100%' }} align="start"><Form.Item label="\u89d2\u8272\u540d\u79f0" name="name" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u89d2\u8272\u540d\u79f0\u3002' }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item label="\u8303\u56f4" name="scope" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u8303\u56f4\u3002' }]} style={{ width: 180 }}><Select options={scopeOptions} /></Form.Item></Space><Form.Item label="\u89d2\u8272\u8bf4\u660e" name="description" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u89d2\u8272\u8bf4\u660e\u3002' }]}><Input.TextArea rows={3} /></Form.Item><Form.Item label="\u6743\u9650\u70b9" name="permissions" rules={[{ required: true, message: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6743\u9650\u70b9\u3002' }]}><Select mode="multiple" options={permissionOptions} optionFilterProp="label" placeholder="\u8bf7\u9009\u62e9\u6743\u9650\u70b9" /></Form.Item></Form>;
}

function PolicyEditorForm({ form, permissionOptions }: { form: FormInstance<PolicyFormValues>; permissionOptions: Array<{ value: string; label: string }> }) {
  return <Form form={form} layout="vertical"><Space size={12} style={{ width: '100%' }} align="start"><Form.Item label="\u7b56\u7565\u540d\u79f0" name="name" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u7b56\u7565\u540d\u79f0\u3002' }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item label="\u8303\u56f4" name="scope" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u8303\u56f4\u3002' }]} style={{ width: 180 }}><Select options={scopeOptions} /></Form.Item></Space><Form.Item label="\u7b56\u7565\u8bf4\u660e" name="description" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u7b56\u7565\u8bf4\u660e\u3002' }]}><Input.TextArea rows={3} /></Form.Item><Form.Item label="\u6743\u9650\u70b9" name="permissions" rules={[{ required: true, message: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6743\u9650\u70b9\u3002' }]}><Select mode="multiple" options={permissionOptions} optionFilterProp="label" placeholder="\u8bf7\u9009\u62e9\u6743\u9650\u70b9" /></Form.Item></Form>;
}

function DictionaryEditorForm({ form, dictionaryKey }: { form: FormInstance<DictionaryFormValues>; dictionaryKey: string }) {
  return <Form form={form} layout="vertical"><Form.Item label="Dictionary Key"><Input value={dictionaryKey} disabled /></Form.Item><Form.Item label="\u5b57\u5178\u540d\u79f0" name="name" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u5b57\u5178\u540d\u79f0\u3002' }]}><Input /></Form.Item><Form.Item label="\u5b57\u5178\u503c" name="values" rules={[{ required: true, message: '\u8bf7\u81f3\u5c11\u4fdd\u7559\u4e00\u4e2a\u5b57\u5178\u503c\u3002' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="\u8f93\u5165\u540e\u56de\u8f66\uff0c\u652f\u6301\u76f4\u63a5\u589e\u5220\u679a\u4e3e\u503c" /></Form.Item></Form>;
}

function WorkflowEditorForm({ form }: { form: FormInstance<WorkflowFormValues> }) {
  return <Form form={form} layout="vertical"><Space size={12} style={{ width: '100%' }} align="start"><Form.Item label="\u6d41\u7a0b\u540d\u79f0" name="name" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u6d41\u7a0b\u540d\u79f0\u3002' }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item label="\u8303\u56f4" name="scope" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u8303\u56f4\u3002' }]} style={{ width: 180 }}><Select options={scopeOptions} /></Form.Item></Space><Form.Item label="\u6d41\u7a0b\u9636\u6bb5" name="stages" rules={[{ required: true, message: '\u8bf7\u81f3\u5c11\u4fdd\u7559\u4e00\u4e2a\u9636\u6bb5\u3002' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="\u8f93\u5165\u540e\u56de\u8f66\uff0c\u652f\u6301\u76f4\u63a5\u589e\u5220\u9636\u6bb5" /></Form.Item><Form.Item label="\u542f\u7528\u72b6\u6001" name="enabled" valuePropName="checked"><Switch checkedChildren="\u542f\u7528" unCheckedChildren="\u505c\u7528" /></Form.Item></Form>;
}

function renderPoliciesPanel(items: SettingsPolicy[], loading: boolean, error: unknown, canManage: boolean, onEdit: (item: SettingsPolicy) => void) {
  if (error) return <Alert type="error" showIcon message="\u8bfb\u53d6\u7b56\u7565\u5305\u5931\u8d25" description={formatApiError(error)} />;
  if (!loading && items.length === 0) return <Empty description="\u6682\u65e0\u7b56\u7565\u5305\u3002" />;
  return <Space direction="vertical" size={16} style={{ display: 'flex' }}>{items.map((item) => <Card key={item.id} size="small" title={item.name} extra={<Space><Tag>{formatScope(item.scope)}</Tag>{canManage ? <Button size="small" onClick={() => onEdit(item)}>\u7f16\u8f91</Button> : null}</Space>}><Space direction="vertical" size={12} style={{ display: 'flex' }}><Typography.Paragraph style={{ marginBottom: 0 }}>{item.description}</Typography.Paragraph><Space size={[6, 6]} wrap>{item.permissions.map((permission) => <Tag key={permission}>{permission}</Tag>)}</Space></Space></Card>)}</Space>;
}

function renderDictionariesPanel(items: SettingsDictionary[], loading: boolean, error: unknown, canManage: boolean, onEdit: (item: SettingsDictionary) => void) {
  if (error) return <Alert type="error" showIcon message="\u8bfb\u53d6\u5171\u4eab\u5b57\u5178\u5931\u8d25" description={formatApiError(error)} />;
  if (!loading && items.length === 0) return <Empty description="\u6682\u65e0\u5b57\u5178\u914d\u7f6e\u3002" />;
  return <Space direction="vertical" size={16} style={{ display: 'flex' }}>{items.map((item) => <Card key={item.id} size="small" title={item.name} extra={<Space><Typography.Text type="secondary">{item.updatedAt || '-'}</Typography.Text>{canManage ? <Button size="small" onClick={() => onEdit(item)}>\u7f16\u8f91</Button> : null}</Space>}><Space direction="vertical" size={8} style={{ display: 'flex' }}><Typography.Text type="secondary">{item.key}</Typography.Text><Space size={[6, 6]} wrap>{item.values.map((value) => <Tag key={value} color="blue">{value}</Tag>)}</Space></Space></Card>)}</Space>;
}

function renderWorkflowsPanel(items: SettingsWorkflow[], loading: boolean, error: unknown, canManage: boolean, onEdit: (item: SettingsWorkflow) => void) {
  if (error) return <Alert type="error" showIcon message="\u8bfb\u53d6\u6d41\u7a0b\u6a21\u677f\u5931\u8d25" description={formatApiError(error)} />;
  if (!loading && items.length === 0) return <Empty description="\u6682\u65e0\u6d41\u7a0b\u6a21\u677f\u3002" />;
  return <Space direction="vertical" size={16} style={{ display: 'flex' }}>{items.map((item) => <Card key={item.id} size="small" title={item.name} extra={<Space><Tag>{formatScope(item.scope)}</Tag><Tag color={item.enabled ? 'success' : 'default'}>{item.enabled ? '\u542f\u7528' : '\u505c\u7528'}</Tag>{canManage ? <Button size="small" onClick={() => onEdit(item)}>\u7f16\u8f91</Button> : null}</Space>}><Space direction="vertical" size={8} style={{ display: 'flex' }}><Typography.Text type="secondary">\u6700\u8fd1\u66f4\u65b0\uff1a{item.updatedAt || '-'}</Typography.Text><Space size={[6, 6]} wrap>{item.stages.map((stage) => <Tag key={stage} color="geekblue">{stage}</Tag>)}</Space></Space></Card>)}</Space>;
}

function normalizeMemberPayload(values: MemberFormValues): CreateSettingsMemberPayload { return { name: values.name.trim(), email: values.email.trim(), department: values.department, title: values.title, status: values.status, roles: normalizeList(values.roles), dingtalkBound: Boolean(values.dingtalkBound) }; }
function normalizeRolePayload(values: RoleFormValues): UpdateSettingsRolePayload { return { name: values.name.trim(), scope: values.scope, description: values.description.trim(), permissions: normalizeList(values.permissions) }; }
function normalizePolicyPayload(values: PolicyFormValues): UpdateSettingsPolicyPayload { return { name: values.name.trim(), scope: values.scope, description: values.description.trim(), permissions: normalizeList(values.permissions) }; }
function normalizeDictionaryPayload(values: DictionaryFormValues): UpdateSettingsDictionaryPayload { return { name: values.name.trim(), values: normalizeList(values.values) }; }
function normalizeWorkflowPayload(values: WorkflowFormValues): UpdateSettingsWorkflowPayload { return { name: values.name.trim(), scope: values.scope, stages: normalizeList(values.stages), enabled: Boolean(values.enabled) }; }
function normalizeList(values: string[]): string[] { return Array.isArray(values) ? Array.from(new Set(values.map((item) => item.trim()).filter((item) => item.length > 0))) : []; }
function formatScope(value: string): string { return scopeLabelMap[value] ?? value; }
function formatDepartment(value: string): string { return departmentLabelMap[value] ?? value; }
function formatTitle(value: string): string { return titleLabelMap[value] ?? value; }
function formatRoleList(values: string[]): string { return values.length === 0 ? '\u672a\u52a0\u8f7d\u89d2\u8272' : values.join(' / '); }