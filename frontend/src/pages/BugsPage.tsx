import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { FormInstance } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { formatApiError, pmApi } from '../services/api';
import type {
  BatchSubmitBugsResult,
  Bug,
  BugLinkType,
  CreateBugPayload,
  Execution,
  Project,
  UpdateBugPayload,
} from '../services/types';
import { useAuthStore } from '../store/authStore';

const severityColorMap: Record<Bug['severity'], string> = {
  Low: 'default',
  Medium: 'processing',
  High: 'warning',
  Critical: 'error',
};

const severityLabelMap: Record<Bug['severity'], string> = {
  Low: '低',
  Medium: '中',
  High: '高',
  Critical: '严重',
};

type BugFormValues = {
  title: string;
  severity: Bug['severity'];
  priority: Bug['priority'];
  status?: Bug['status'];
  linkType: BugLinkType;
  linkId: number;
  ownerName: string;
  reporterName: string;
  reproductionStepsText: string;
  expectedResult: string;
  actualResult: string;
};

const columns: ColumnsType<Bug> = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  {
    title: '缺陷标题',
    dataIndex: 'title',
    render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
  },
  {
    title: '严重程度',
    dataIndex: 'severity',
    width: 120,
    render: (value: Bug['severity']) => <Tag color={severityColorMap[value]}>{severityLabelMap[value]}</Tag>,
  },
  { title: '优先级', dataIndex: 'priority', width: 100 },
  {
    title: '状态',
    dataIndex: 'status',
    width: 130,
    render: (value: Bug['status']) => <StatusTag value={value} />,
  },
  { title: '关联对象', dataIndex: 'linkName', width: 220 },
  { title: '负责人', dataIndex: 'ownerName', width: 140 },
  { title: '提单人', dataIndex: 'reporterName', width: 140 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
];

export function BugsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? 'Wang Jun');
  const canViewProjects = permissions.includes('project.view.related');
  const canViewExecutions = permissions.includes('execution.view.related');
  const canCreateBugs = permissions.includes('bug.create.related');
  const canUpdateBugs = permissions.includes('bug.update.related');
  const canSubmitBugs = permissions.includes('bug.submit.related');
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<BugFormValues>();
  const [editForm] = Form.useForm<BugFormValues>();
  const queryClient = useQueryClient();

  const bugsQuery = useQuery({ queryKey: ['bugs'], queryFn: pmApi.getBugs });
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: pmApi.getProjects,
    enabled: canViewProjects,
  });
  const executionsQuery = useQuery({
    queryKey: ['executions'],
    queryFn: pmApi.getExecutions,
    enabled: canViewExecutions,
  });
  const detailQuery = useQuery({
    queryKey: ['bug-detail', selectedBugId],
    queryFn: async () => {
      if (selectedBugId === null) {
        return null;
      }
      return pmApi.getBugDetail(selectedBugId);
    },
    enabled: selectedBugId !== null,
  });

  const selectedBugs = useMemo(() => {
    const items = bugsQuery.data ?? [];
    return items.filter((item) => selectedRowKeys.includes(item.id));
  }, [bugsQuery.data, selectedRowKeys]);

  const selectedDraftCount = useMemo(
    () => selectedBugs.filter((item) => item.status === 'Draft').length,
    [selectedBugs],
  );

  const selectedClosedCount = useMemo(
    () => selectedBugs.filter((item) => item.status === 'Resolved' || item.status === 'Closed').length,
    [selectedBugs],
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateBugPayload) => pmApi.createBug(payload),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bugs'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-bugs'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['bug-detail', created.id] }),
      ]);
      setCreateModalOpen(false);
      createForm.resetFields();
      setSelectedBugId(created.id);
      messageApi.success('缺陷已创建。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateBugPayload }) => pmApi.updateBug(id, payload),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bugs'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-bugs'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['bug-detail', updated.id] }),
      ]);
      setEditModalOpen(false);
      editForm.resetFields();
      messageApi.success('缺陷已更新。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const submitMutation = useMutation({
    mutationFn: (bugIds: number[]) => pmApi.batchSubmitBugs({ bugIds }),
    onSuccess: async (result, bugIds) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bugs'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-bugs'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
        ...(selectedBugId !== null ? [queryClient.invalidateQueries({ queryKey: ['bug-detail', selectedBugId] })] : []),
      ]);
      if (bugIds.length === selectedRowKeys.length) {
        setSelectedRowKeys([]);
      }
      messageApi.success(buildBatchSubmitMessage(result));
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const openCreateModal = () => {
    if (!canCreateBugs) {
      messageApi.warning('当前角色没有创建缺陷的权限。');
      return;
    }

    const defaultLinkType: BugLinkType = executionsQuery.data && executionsQuery.data.length > 0 ? 'execution' : 'project';
    const defaultLinkId =
      defaultLinkType === 'execution' ? executionsQuery.data?.[0]?.id : projectsQuery.data?.[0]?.id;
    const defaultOwnerName =
      defaultLinkType === 'execution'
        ? executionsQuery.data?.[0]?.ownerName ?? currentUserName
        : projectsQuery.data?.[0]?.ownerName ?? currentUserName;

    createForm.setFieldsValue({
      title: '',
      severity: 'Medium',
      priority: 'P1',
      linkType: defaultLinkType,
      linkId: defaultLinkId,
      ownerName: defaultOwnerName,
      reporterName: currentUserName,
      reproductionStepsText: '',
      expectedResult: '',
      actualResult: '',
    });
    setCreateModalOpen(true);
  };

  const openEditModal = () => {
    if (!canUpdateBugs) {
      messageApi.warning('当前角色没有编辑缺陷的权限。');
      return;
    }

    const detail = detailQuery.data;
    if (!detail) {
      messageApi.info('请先选择一条缺陷。');
      return;
    }

    editForm.setFieldsValue({
      title: detail.title,
      severity: detail.severity,
      priority: detail.priority,
      status: detail.status,
      linkType: detail.linkType,
      linkId: detail.linkId,
      ownerName: detail.ownerName,
      reporterName: detail.reporterName,
      reproductionStepsText: detail.reproductionSteps.join('\n'),
      expectedResult: detail.expectedResult,
      actualResult: detail.actualResult,
    });
    setEditModalOpen(true);
  };

  const handleCreate = async () => {
    if (!canCreateBugs) {
      messageApi.warning('当前角色没有创建缺陷的权限。');
      return;
    }

    const values = await createForm.validateFields();
    createMutation.mutate(toBugPayload(values, projectsQuery.data ?? [], executionsQuery.data ?? []));
  };

  const handleUpdate = async () => {
    if (!canUpdateBugs) {
      messageApi.warning('当前角色没有编辑缺陷的权限。');
      return;
    }

    if (selectedBugId === null) {
      return;
    }

    const values = await editForm.validateFields();
    updateMutation.mutate({
      id: selectedBugId,
      payload: toBugPayload(values, projectsQuery.data ?? [], executionsQuery.data ?? []),
    });
  };

  const handleBatchSubmit = (bugIds?: number[]) => {
    if (!canSubmitBugs) {
      messageApi.warning('当前角色没有提交缺陷的权限。');
      return;
    }

    const targetIds = bugIds && bugIds.length > 0 ? bugIds : selectedRowKeys;
    if (targetIds.length === 0) {
      messageApi.info('请先选择至少一条缺陷。');
      return;
    }

    submitMutation.mutate(targetIds);
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="缺陷"
        description="记录项目和执行中的缺陷，沉淀复现信息，并快速把草稿缺陷提交到处理队列。"
        extra={
          <Space>
            {canSubmitBugs ? (
              <Button disabled={selectedRowKeys.length === 0} onClick={() => handleBatchSubmit()}>
                批量提交
              </Button>
            ) : null}
            {canCreateBugs ? (
              <Button type="primary" onClick={openCreateModal}>
                新建缺陷
              </Button>
            ) : null}
          </Space>
        }
      />

      {selectedRowKeys.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message={`已选 ${selectedRowKeys.length} 条缺陷 | 草稿 ${selectedDraftCount} 条 | 已解决或已关闭 ${selectedClosedCount} 条`}
          description="批量提交会把草稿或处理中缺陷推进到已打开状态，已解决和已关闭项会自动跳过。"
        />
      ) : null}

      <Card title="缺陷列表">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={bugsQuery.data ?? []}
          loading={bugsQuery.isLoading}
          pagination={false}
          scroll={{ x: 1280 }}
          rowSelection={
            canSubmitBugs
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys.map((item) => Number(item))),
                }
              : undefined
          }
          onRow={(record) => ({
            onClick: () => setSelectedBugId(record.id),
          })}
        />
      </Card>

      <Drawer
        title={detailQuery.data?.title ?? '缺陷详情'}
        open={selectedBugId !== null}
        width={760}
        onClose={() => setSelectedBugId(null)}
        extra={
          detailQuery.data ? (
            <Space>
              {canSubmitBugs ? (
                <Button onClick={() => handleBatchSubmit([detailQuery.data!.id])} loading={submitMutation.isPending}>
                  提交
                </Button>
              ) : null}
              {canUpdateBugs ? <Button onClick={openEditModal}>编辑</Button> : null}
              <StatusTag value={detailQuery.data.status} />
            </Space>
          ) : null
        }
      >
        {detailQuery.isLoading ? (
          <Typography.Paragraph>正在加载缺陷详情...</Typography.Paragraph>
        ) : detailQuery.data ? (
          <BugDetailContent bug={detailQuery.data} />
        ) : (
          <Empty description="请选择一条缺陷查看详情。" />
        )}
      </Drawer>

      <Modal
        title="新建缺陷"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        confirmLoading={createMutation.isPending}
      >
        <BugEditorForm form={createForm} projects={projectsQuery.data ?? []} executions={executionsQuery.data ?? []} />
      </Modal>

      <Modal
        title="编辑缺陷"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdate}
        okText="保存"
        confirmLoading={updateMutation.isPending}
      >
        <BugEditorForm form={editForm} projects={projectsQuery.data ?? []} executions={executionsQuery.data ?? []} mode="edit" />
      </Modal>
    </Space>
  );
}

type BugEditorFormProps = {
  form: FormInstance<BugFormValues>;
  projects: Project[];
  executions: Execution[];
  mode?: 'create' | 'edit';
};

function BugEditorForm({ form, projects, executions, mode = 'create' }: BugEditorFormProps) {
  const linkType = Form.useWatch('linkType', form) ?? 'execution';
  const linkOptions = linkType === 'project' ? projects : executions;

  return (
    <Form form={form} layout="vertical">
      <Form.Item label="缺陷标题" name="title" rules={[{ required: true, message: '请输入缺陷标题。' }]}>
        <Input placeholder="例如：评审通过后按钮仍然不可点击" />
      </Form.Item>

      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="严重程度" name="severity" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: '低', value: 'Low' },
              { label: '中', value: 'Medium' },
              { label: '高', value: 'High' },
              { label: '严重', value: 'Critical' },
            ]}
          />
        </Form.Item>

        <Form.Item label="优先级" name="priority" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: 'P0', value: 'P0' },
              { label: 'P1', value: 'P1' },
              { label: 'P2', value: 'P2' },
            ]}
          />
        </Form.Item>

        {mode === 'edit' ? (
          <Form.Item label="状态" name="status" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select
              options={[
                { label: '草稿', value: 'Draft' },
                { label: '已打开', value: 'Open' },
                { label: '处理中', value: 'InProgress' },
                { label: '已解决', value: 'Resolved' },
                { label: '已关闭', value: 'Closed' },
              ]}
            />
          </Form.Item>
        ) : null}
      </Space>

      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="关联类型" name="linkType" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: '执行', value: 'execution' },
              { label: '项目', value: 'project' },
            ]}
          />
        </Form.Item>

        <Form.Item label="关联记录" name="linkId" rules={[{ required: true, message: '请选择关联记录。' }]} style={{ flex: 2 }}>
          <Select
            showSearch
            optionFilterProp="label"
            options={linkOptions.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            notFoundContent="暂无可选记录"
          />
        </Form.Item>
      </Space>

      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="负责人" name="ownerName" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>

        <Form.Item label="提单人" name="reporterName" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>
      </Space>

      <Form.Item label="复现步骤" name="reproductionStepsText">
        <Input.TextArea rows={5} placeholder="每行填写一步" />
      </Form.Item>

      <Form.Item label="期望结果" name="expectedResult">
        <Input.TextArea rows={3} placeholder="描述期望结果" />
      </Form.Item>

      <Form.Item label="实际结果" name="actualResult">
        <Input.TextArea rows={3} placeholder="描述实际结果" />
      </Form.Item>
    </Form>
  );
}

function BugDetailContent({ bug }: { bug: Bug }) {
  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="状态">
          <StatusTag value={bug.status} />
        </Descriptions.Item>
        <Descriptions.Item label="严重程度">
          <Tag color={severityColorMap[bug.severity]}>{severityLabelMap[bug.severity]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="优先级">{bug.priority}</Descriptions.Item>
        <Descriptions.Item label="关联对象">{bug.linkName || '-'}</Descriptions.Item>
        <Descriptions.Item label="负责人">{bug.ownerName}</Descriptions.Item>
        <Descriptions.Item label="提单人">{bug.reporterName}</Descriptions.Item>
        <Descriptions.Item label="创建时间">{bug.createdAt || '-'}</Descriptions.Item>
        <Descriptions.Item label="提交时间">{bug.submittedAt || '-'}</Descriptions.Item>
      </Descriptions>

      <Card title="复现步骤" size="small">
        {bug.reproductionSteps.length > 0 ? (
          <List
            size="small"
            dataSource={bug.reproductionSteps}
            renderItem={(item, index) => <List.Item>{`${index + 1}. ${item}`}</List.Item>}
          />
        ) : (
          <Empty description="暂无复现步骤" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card title="期望结果" size="small">
        {bug.expectedResult ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>{bug.expectedResult}</Typography.Paragraph>
        ) : (
          <Empty description="暂无期望结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card title="实际结果" size="small">
        {bug.actualResult ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>{bug.actualResult}</Typography.Paragraph>
        ) : (
          <Empty description="暂无实际结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </Space>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toBugPayload(values: BugFormValues, projects: Project[], executions: Execution[]): CreateBugPayload {
  const linkedRecord = values.linkType === 'project'
    ? projects.find((item) => item.id === values.linkId)
    : executions.find((item) => item.id === values.linkId);

  return {
    title: values.title.trim(),
    severity: values.severity,
    priority: values.priority,
    status: values.status ?? 'Draft',
    linkType: values.linkType,
    linkId: values.linkId,
    linkName: linkedRecord?.name ?? '',
    ownerName: values.ownerName.trim(),
    reporterName: values.reporterName.trim(),
    reproductionSteps: splitLines(values.reproductionStepsText ?? ''),
    expectedResult: values.expectedResult.trim(),
    actualResult: values.actualResult.trim(),
  };
}

function buildBatchSubmitMessage(result: BatchSubmitBugsResult): string {
  const submittedCount = result.items.length;
  const skippedCount = result.skippedBugIds.length;

  if (skippedCount > 0) {
    return `已提交 ${submittedCount} 条缺陷，另有 ${skippedCount} 条已完成或不存在的记录被跳过。`;
  }

  return `已提交 ${submittedCount} 条缺陷到处理队列。`;
}