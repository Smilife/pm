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
    title: 'Bug',
    dataIndex: 'title',
    render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
  },
  {
    title: 'Severity',
    dataIndex: 'severity',
    width: 120,
    render: (value: Bug['severity']) => <Tag color={severityColorMap[value]}>{value}</Tag>,
  },
  { title: 'Priority', dataIndex: 'priority', width: 100 },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 130,
    render: (value: Bug['status']) => <StatusTag value={value} />,
  },
  { title: 'Linked to', dataIndex: 'linkName', width: 220 },
  { title: 'Owner', dataIndex: 'ownerName', width: 140 },
  { title: 'Reporter', dataIndex: 'reporterName', width: 140 },
  { title: 'Updated at', dataIndex: 'updatedAt', width: 180 },
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
      messageApi.success('Bug created.');
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
      messageApi.success('Bug updated.');
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
      messageApi.warning('Your current role cannot create bugs.');
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
      messageApi.warning('Your current role cannot edit bugs.');
      return;
    }

    const detail = detailQuery.data;
    if (!detail) {
      messageApi.info('Select a bug first.');
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
      messageApi.warning('Your current role cannot create bugs.');
      return;
    }

    const values = await createForm.validateFields();
    createMutation.mutate(toBugPayload(values, projectsQuery.data ?? [], executionsQuery.data ?? []));
  };

  const handleUpdate = async () => {
    if (!canUpdateBugs) {
      messageApi.warning('Your current role cannot edit bugs.');
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
      messageApi.warning('Your current role cannot submit bugs.');
      return;
    }

    const targetIds = bugIds && bugIds.length > 0 ? bugIds : selectedRowKeys;
    if (targetIds.length === 0) {
      messageApi.info('Select at least one bug first.');
      return;
    }

    submitMutation.mutate(targetIds);
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="Bugs"
        description="Capture execution and project defects, keep reproduction details together, and quickly move draft bugs into the active triage queue."
        extra={
          <Space>
            {canSubmitBugs ? (
              <Button disabled={selectedRowKeys.length === 0} onClick={() => handleBatchSubmit()}>
                Submit selected
              </Button>
            ) : null}
            {canCreateBugs ? (
              <Button type="primary" onClick={openCreateModal}>
                Create bug
              </Button>
            ) : null}
          </Space>
        }
      />

      {selectedRowKeys.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message={`Selected ${selectedRowKeys.length} bugs | Draft: ${selectedDraftCount} | Resolved or closed: ${selectedClosedCount}`}
          description="Batch submit moves draft or in-progress bugs into Open. Resolved and closed bugs are skipped automatically."
        />
      ) : null}

      <Card title="Bug list">
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
        title={detailQuery.data?.title ?? 'Bug detail'}
        open={selectedBugId !== null}
        width={760}
        onClose={() => setSelectedBugId(null)}
        extra={
          detailQuery.data ? (
            <Space>
              {canSubmitBugs ? (
                <Button onClick={() => handleBatchSubmit([detailQuery.data!.id])} loading={submitMutation.isPending}>
                  Submit
                </Button>
              ) : null}
              {canUpdateBugs ? <Button onClick={openEditModal}>Edit</Button> : null}
              <StatusTag value={detailQuery.data.status} />
            </Space>
          ) : null
        }
      >
        {detailQuery.isLoading ? (
          <Typography.Paragraph>Loading bug detail...</Typography.Paragraph>
        ) : detailQuery.data ? (
          <BugDetailContent bug={detailQuery.data} />
        ) : (
          <Empty description="Select a bug to inspect details." />
        )}
      </Drawer>

      <Modal
        title="Create bug"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
        confirmLoading={createMutation.isPending}
      >
        <BugEditorForm form={createForm} projects={projectsQuery.data ?? []} executions={executionsQuery.data ?? []} />
      </Modal>

      <Modal
        title="Edit bug"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdate}
        okText="Save"
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
      <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Enter a bug title.' }]}>
        <Input placeholder="Example: Approval button stays disabled after review" />
      </Form.Item>

      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="Severity" name="severity" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: 'Low', value: 'Low' },
              { label: 'Medium', value: 'Medium' },
              { label: 'High', value: 'High' },
              { label: 'Critical', value: 'Critical' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Priority" name="priority" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: 'P0', value: 'P0' },
              { label: 'P1', value: 'P1' },
              { label: 'P2', value: 'P2' },
            ]}
          />
        </Form.Item>

        {mode === 'edit' ? (
          <Form.Item label="Status" name="status" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select
              options={[
                { label: 'Draft', value: 'Draft' },
                { label: 'Open', value: 'Open' },
                { label: 'In progress', value: 'InProgress' },
                { label: 'Resolved', value: 'Resolved' },
                { label: 'Closed', value: 'Closed' },
              ]}
            />
          </Form.Item>
        ) : null}
      </Space>

      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="Linked type" name="linkType" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Select
            options={[
              { label: 'Execution', value: 'execution' },
              { label: 'Project', value: 'project' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Linked record" name="linkId" rules={[{ required: true, message: 'Select a linked record.' }]} style={{ flex: 2 }}>
          <Select
            showSearch
            optionFilterProp="label"
            options={linkOptions.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            notFoundContent="No records available"
          />
        </Form.Item>
      </Space>

      <Space size={12} style={{ width: '100%' }} align="start">
        <Form.Item label="Owner" name="ownerName" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>

        <Form.Item label="Reporter" name="reporterName" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Input />
        </Form.Item>
      </Space>

      <Form.Item label="Reproduction steps" name="reproductionStepsText">
        <Input.TextArea rows={5} placeholder="One step per line" />
      </Form.Item>

      <Form.Item label="Expected result" name="expectedResult">
        <Input.TextArea rows={3} placeholder="Describe the expected result" />
      </Form.Item>

      <Form.Item label="Actual result" name="actualResult">
        <Input.TextArea rows={3} placeholder="Describe the actual result" />
      </Form.Item>
    </Form>
  );
}

function BugDetailContent({ bug }: { bug: Bug }) {
  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Status">
          <StatusTag value={bug.status} />
        </Descriptions.Item>
        <Descriptions.Item label="Severity">
          <Tag color={severityColorMap[bug.severity]}>{bug.severity}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Priority">{bug.priority}</Descriptions.Item>
        <Descriptions.Item label="Linked to">{bug.linkName || '-'}</Descriptions.Item>
        <Descriptions.Item label="Owner">{bug.ownerName}</Descriptions.Item>
        <Descriptions.Item label="Reporter">{bug.reporterName}</Descriptions.Item>
        <Descriptions.Item label="Created at">{bug.createdAt || '-'}</Descriptions.Item>
        <Descriptions.Item label="Submitted at">{bug.submittedAt || '-'}</Descriptions.Item>
      </Descriptions>

      <Card title="Reproduction steps" size="small">
        {bug.reproductionSteps.length > 0 ? (
          <List
            size="small"
            dataSource={bug.reproductionSteps}
            renderItem={(item, index) => <List.Item>{`${index + 1}. ${item}`}</List.Item>}
          />
        ) : (
          <Empty description="No reproduction steps recorded." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card title="Expected result" size="small">
        {bug.expectedResult ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>{bug.expectedResult}</Typography.Paragraph>
        ) : (
          <Empty description="No expected result recorded." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card title="Actual result" size="small">
        {bug.actualResult ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>{bug.actualResult}</Typography.Paragraph>
        ) : (
          <Empty description="No actual result recorded." image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
    return `Submitted ${submittedCount} bugs and skipped ${skippedCount} already finished or missing records.`;
  }

  return `Submitted ${submittedCount} bugs to the active queue.`;
}
