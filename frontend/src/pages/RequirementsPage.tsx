import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';
import type {
  CreateRequirementPayload,
  Project,
  Requirement,
  RequirementDetail,
  RequirementGenerateExecutionPayload,
  RequirementReviewPayload,
  ReviewResult,
  UpdateRequirementPayload,
} from '../services/types';

const { RangePicker } = DatePicker;

const reviewResultLabelMap: Record<ReviewResult, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  delayed: 'Delayed',
  supplement_required: 'Need more info',
};

const reviewResultColorMap: Record<ReviewResult, string> = {
  approved: 'success',
  rejected: 'error',
  delayed: 'warning',
  supplement_required: 'processing',
};

const columns: ColumnsType<Requirement> = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  {
    title: 'Requirement',
    dataIndex: 'title',
    render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
  },
  { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
  { title: 'Priority', dataIndex: 'priority', width: 90 },
  { title: 'Owner', dataIndex: 'ownerName', width: 120 },
  { title: 'Target release', dataIndex: 'expectedReleaseAt', width: 140 },
  { title: 'Linked executions', dataIndex: 'linkedExecutionCount', width: 140 },
];

type RequirementCreateFormValues = {
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  ownerName: string;
  expectedReleaseAt: Dayjs;
  description: string;
  solutionSummary: string;
  acceptanceCriteriaText: string;
  impactScopeText: string;
  risksText: string;
};

type RequirementEditFormValues = RequirementCreateFormValues & {
  status: RequirementDetail['status'];
};

export function RequirementsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? 'Wang Jun');
  const canManageRequirements = permissions.includes('requirement.create.project');
  const canReviewRequirements = permissions.includes('requirement.review.create.project');
  const canGenerateExecutions = permissions.includes('requirement.execution.generate.project');
  const [selectedRequirementId, setSelectedRequirementId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [reviewForm] = Form.useForm<RequirementReviewPayload>();
  const [generateForm] = Form.useForm();
  const [createForm] = Form.useForm<RequirementCreateFormValues>();
  const [editForm] = Form.useForm<RequirementEditFormValues>();
  const queryClient = useQueryClient();

  const requirementsQuery = useQuery({ queryKey: ['requirements'], queryFn: pmApi.getRequirements });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: pmApi.getProjects });
  const detailQuery = useQuery({
    queryKey: ['requirement-detail', selectedRequirementId],
    queryFn: async () => {
      if (selectedRequirementId === null) {
        return null;
      }
      return pmApi.getRequirementDetail(selectedRequirementId);
    },
    enabled: selectedRequirementId !== null,
  });

  const selectedRows = useMemo(() => {
    const items = requirementsQuery.data ?? [];
    return items.filter((item) => selectedRowKeys.includes(item.id));
  }, [requirementsQuery.data, selectedRowKeys]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateRequirementPayload) => pmApi.createRequirement(payload),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['requirement-detail', created.id] }),
      ]);
      setCreateModalOpen(false);
      createForm.resetFields();
      setSelectedRequirementId(created.id);
      reviewForm.setFieldsValue({ reviewerName: currentUserName, result: 'approved', comment: '' });
      messageApi.success('Requirement created.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRequirementPayload }) => pmApi.updateRequirement(id, payload),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['requirement-detail', updated.id] }),
      ]);
      setEditModalOpen(false);
      messageApi.success('Requirement updated.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: (id: number) => pmApi.submitRequirementForReview(id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['requirement-detail', result.id] }),
      ]);
      messageApi.success('Requirement submitted for review.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RequirementReviewPayload }) =>
      pmApi.createRequirementReview(id, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['requirement-detail', variables.id] }),
      ]);
      reviewForm.resetFields();
      reviewForm.setFieldsValue({ reviewerName: currentUserName, result: 'approved', comment: '' });
      messageApi.success('Review record saved and requirement status updated.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const generateMutation = useMutation({
    mutationFn: (payload: RequirementGenerateExecutionPayload) => pmApi.batchGenerateExecutions(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['executions'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        ...(selectedRequirementId !== null
          ? [queryClient.invalidateQueries({ queryKey: ['requirement-detail', selectedRequirementId] })]
          : []),
      ]);
      setGenerateModalOpen(false);
      setSelectedRowKeys([]);
      generateForm.resetFields();
      const createdCount = result.items.length;
      const skippedCount = result.skippedRequirementIds.length;
      if (skippedCount > 0) {
        messageApi.warning(`Created ${createdCount} executions and skipped ${skippedCount} requirements due to status rules.`);
        return;
      }
      messageApi.success(`Created ${createdCount} executions.`);
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const openGenerateModal = (ids?: number[]) => {
    if (!canGenerateExecutions) {
      messageApi.warning('Your current role cannot generate executions.');
      return;
    }

    const requirementIds = ids && ids.length > 0 ? ids : selectedRowKeys;
    if (requirementIds.length === 0) {
      messageApi.info('Select at least one requirement first.');
      return;
    }

    if (ids && ids.length > 0) {
      setSelectedRowKeys(ids);
    }

    const defaultProject = projectsQuery.data?.[0];
    generateForm.setFieldsValue({
      projectId: defaultProject?.id,
      planRange: [dayjs().add(1, 'day'), dayjs().add(7, 'day')],
    });
    setGenerateModalOpen(true);
  };

  const openCreateModal = () => {
    if (!canManageRequirements) {
      messageApi.warning('Your current role cannot create requirements.');
      return;
    }

    createForm.setFieldsValue({
      priority: 'P1',
      ownerName: currentUserName,
      expectedReleaseAt: dayjs().add(7, 'day'),
      acceptanceCriteriaText: '',
      impactScopeText: '',
      risksText: '',
    });
    setCreateModalOpen(true);
  };

  const openEditModal = () => {
    if (!canManageRequirements) {
      messageApi.warning('Your current role cannot edit requirements.');
      return;
    }

    const detail = detailQuery.data;
    if (!detail) {
      return;
    }

    editForm.setFieldsValue({
      title: detail.title,
      status: detail.status,
      priority: detail.priority,
      ownerName: detail.ownerName,
      expectedReleaseAt: dayjs(detail.expectedReleaseAt),
      description: detail.description,
      solutionSummary: detail.solutionSummary,
      acceptanceCriteriaText: detail.acceptanceCriteria.join('\n'),
      impactScopeText: detail.impactScope.join('\n'),
      risksText: detail.risks.join('\n'),
    });
    setEditModalOpen(true);
  };

  const handleCreateRequirement = async () => {
    if (!canManageRequirements) {
      messageApi.warning('Your current role cannot create requirements.');
      return;
    }

    const values = await createForm.validateFields();
    createMutation.mutate(toRequirementDraftPayload(values));
  };

  const handleUpdateRequirement = async () => {
    if (!canManageRequirements) {
      messageApi.warning('Your current role cannot edit requirements.');
      return;
    }

    if (selectedRequirementId === null) {
      return;
    }

    const values = await editForm.validateFields();
    updateMutation.mutate({
      id: selectedRequirementId,
      payload: {
        ...toRequirementDraftPayload(values),
        status: values.status,
      },
    });
  };

  const handleSubmitReview = async () => {
    if (!canReviewRequirements) {
      messageApi.warning('Your current role cannot add review records.');
      return;
    }

    if (selectedRequirementId === null) {
      return;
    }

    const values = await reviewForm.validateFields();
    reviewMutation.mutate({ id: selectedRequirementId, payload: values });
  };

  const handleSubmitForReview = () => {
    if (!canReviewRequirements) {
      messageApi.warning('Your current role cannot submit requirements for review.');
      return;
    }

    if (selectedRequirementId === null) {
      return;
    }

    submitForReviewMutation.mutate(selectedRequirementId);
  };

  const handleGenerateExecutions = async () => {
    if (!canGenerateExecutions) {
      messageApi.warning('Your current role cannot generate executions.');
      return;
    }

    const values = await generateForm.validateFields();
    const project = projectsQuery.data?.find((item) => item.id === values.projectId);

    if (!project) {
      messageApi.error('Target project was not found.');
      return;
    }

    generateMutation.mutate({
      requirementIds: selectedRowKeys,
      projectId: project.id,
      projectName: project.name,
      planStart: values.planRange[0].format('YYYY-MM-DD'),
      planEnd: values.planRange[1].format('YYYY-MM-DD'),
    });
  };

  const canSubmitReview = detailQuery.data ? canSubmitForReview(detailQuery.data) && canReviewRequirements : false;

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="Requirements"
        description="This screen now supports creation, editing, review transition, review records and batch generation of executions."
        extra={
          canGenerateExecutions || canManageRequirements ? (
            <Space>
              {canGenerateExecutions ? (
                <Button onClick={() => openGenerateModal()} disabled={selectedRowKeys.length === 0}>
                  Batch generate executions
                </Button>
              ) : null}
              {canManageRequirements ? (
                <Button type="primary" onClick={openCreateModal}>
                  Create requirement
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      />
      <Card title="Requirement list" extra={<Typography.Text type="secondary">Selected {selectedRowKeys.length}</Typography.Text>}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={requirementsQuery.data ?? []}
          loading={requirementsQuery.isLoading}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys.map((key) => Number(key))),
          }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedRequirementId(record.id);
              reviewForm.setFieldsValue({ reviewerName: currentUserName, result: 'approved', comment: '' });
            },
          })}
        />
      </Card>

      <Drawer
        title={detailQuery.data?.title ?? 'Requirement detail'}
        width={720}
        open={selectedRequirementId !== null}
        onClose={() => setSelectedRequirementId(null)}
        extra={
          detailQuery.data ? (
            <Space>
              {canManageRequirements ? <Button onClick={openEditModal}>Edit</Button> : null}
              {canReviewRequirements ? (
                <Button
                  type="primary"
                  onClick={handleSubmitForReview}
                  disabled={!canSubmitReview}
                  loading={submitForReviewMutation.isPending}
                >
                  Submit for review
                </Button>
              ) : null}
              {canGenerateExecutions ? (
                <Button onClick={() => openGenerateModal(selectedRequirementId !== null ? [selectedRequirementId] : [])}>
                  Generate execution
                </Button>
              ) : null}
              <StatusTag value={detailQuery.data.status} />
            </Space>
          ) : null
        }
      >
        {detailQuery.isLoading ? (
          <Card loading />
        ) : detailQuery.isError ? (
          <Alert type="error" showIcon message="Requirement detail request failed" description={formatApiError(detailQuery.error)} />
        ) : detailQuery.data ? (
          <RequirementDetailContent
            detail={detailQuery.data}
            onSubmitReview={handleSubmitReview}
            reviewForm={reviewForm}
            reviewSubmitting={reviewMutation.isPending}
            canReviewRequirements={canReviewRequirements}
          />
        ) : (
          <Empty description="Requirement detail not found" />
        )}
      </Drawer>

      <Modal
        title="Create requirement"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateRequirement}
        okText="Create"
        confirmLoading={createMutation.isPending}
        width={760}
      >
        <RequirementEditorForm form={createForm} mode="create" />
      </Modal>

      <Modal
        title="Edit requirement"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdateRequirement}
        okText="Save"
        confirmLoading={updateMutation.isPending}
        width={760}
      >
        <RequirementEditorForm form={editForm} mode="edit" />
      </Modal>

      <Modal
        title="Batch generate executions"
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        onOk={handleGenerateExecutions}
        okText="Generate"
        confirmLoading={generateMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={`This run will process ${selectedRows.length} requirements`}
            description={selectedRows.map((item) => item.title).join(', ') || 'No requirements selected'}
          />
          <Form form={generateForm} layout="vertical">
            <Form.Item label="Target project" name="projectId" rules={[{ required: true, message: 'Select a target project' }]}>
              <Select
                placeholder="Select a project"
                options={(projectsQuery.data ?? []).map((item: Project) => ({
                  label: `${item.name} (${item.code})`,
                  value: item.id,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="Plan range"
              name="planRange"
              rules={[{ required: true, message: 'Select a plan start and end date' }]}
            >
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
}

function RequirementEditorForm({
  form,
  mode,
}: {
  form: FormInstance<any>;
  mode: 'create' | 'edit';
}) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Enter a requirement title' }]}>
        <Input placeholder="Example: Requirement review and batch execution generation" />
      </Form.Item>
      {mode === 'edit' ? (
        <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
          <Select
            options={[
              { value: 'Draft' },
              { value: 'Understanding' },
              { value: 'Confirmed' },
              { value: 'ToReview' },
              { value: 'Reviewed' },
              { value: 'Scheduled' },
              { value: 'InDevelopment' },
            ]}
          />
        </Form.Item>
      ) : null}
      <Space size={16} style={{ width: '100%' }}>
        <Form.Item label="Priority" name="priority" rules={[{ required: true, message: 'Select a priority' }]} style={{ flex: 1 }}>
          <Select options={[{ value: 'P0' }, { value: 'P1' }, { value: 'P2' }]} />
        </Form.Item>
        <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]} style={{ flex: 1 }}>
          <Input placeholder="Example: Wang Jun" />
        </Form.Item>
        <Form.Item
          label="Target release"
          name="expectedReleaseAt"
          rules={[{ required: true, message: 'Select a target release date' }]}
          style={{ flex: 1 }}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Space>
      <Form.Item label="Description" name="description" rules={[{ required: true, message: 'Add a short requirement description' }]}>
        <Input.TextArea rows={3} placeholder="Describe the business problem and the expected outcome." />
      </Form.Item>
      <Form.Item label="Solution summary" name="solutionSummary" rules={[{ required: true, message: 'Add a solution summary' }]}>
        <Input.TextArea rows={3} placeholder="Describe the planned approach." />
      </Form.Item>
      <Form.Item
        label="Acceptance criteria"
        name="acceptanceCriteriaText"
        rules={[{ required: true, message: 'Add at least one acceptance criterion' }]}
        extra="Enter one item per line."
      >
        <Input.TextArea rows={4} placeholder={'Acceptance point 1\nAcceptance point 2'} />
      </Form.Item>
      <Form.Item
        label="Impact scope"
        name="impactScopeText"
        rules={[{ required: true, message: 'Add at least one impact item' }]}
        extra="Enter one item per line."
      >
        <Input.TextArea rows={3} placeholder={'Requirement pool\nExecution management'} />
      </Form.Item>
      <Form.Item
        label="Risks and dependencies"
        name="risksText"
        rules={[{ required: true, message: 'Add at least one risk or dependency' }]}
        extra="Enter one item per line."
      >
        <Input.TextArea rows={3} placeholder="Dependency on review quality" />
      </Form.Item>
    </Form>
  );
}

function RequirementDetailContent({
  detail,
  onSubmitReview,
  reviewForm,
  reviewSubmitting,
  canReviewRequirements,
}: {
  detail: RequirementDetail;
  onSubmitReview: () => void;
  reviewForm: FormInstance<RequirementReviewPayload>;
  reviewSubmitting: boolean;
  canReviewRequirements: boolean;
}) {
  const failedChecks = detail.maturityChecks.filter((item) => !item.passed);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions
        size="small"
        column={2}
        items={[
          { key: 'status', label: 'Status', children: <StatusTag value={detail.status} /> },
          { key: 'stage', label: 'Stage', children: detail.currentStage },
          { key: 'priority', label: 'Priority', children: detail.priority },
          { key: 'owner', label: 'Owner', children: detail.ownerName },
          { key: 'release', label: 'Target release', children: detail.expectedReleaseAt },
          { key: 'executionCount', label: 'Linked executions', children: detail.linkedExecutionCount },
        ]}
      />

      <Card title="Description">
        <Typography.Paragraph>{detail.description}</Typography.Paragraph>
        <Typography.Text strong>Solution summary</Typography.Text>
        <Typography.Paragraph>{detail.solutionSummary}</Typography.Paragraph>
      </Card>

      <Card title="Maturity checks">
        {failedChecks.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="Some review prerequisites are still missing"
            description={failedChecks.map((item) => item.label).join(', ')}
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Alert
            type="success"
            showIcon
            message="Maturity checks are complete. This item can move through review or execution generation."
            style={{ marginBottom: 16 }}
          />
        )}
        <Space wrap>
          {detail.maturityChecks.map((item) => (
            <Tag key={item.key} color={item.passed ? 'success' : 'warning'}>
              {item.label}
            </Tag>
          ))}
        </Space>
      </Card>

      <Card title="Acceptance criteria">
        <List dataSource={detail.acceptanceCriteria} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>

      <Card title="Impact and risk">
        <Typography.Text strong>Impact scope</Typography.Text>
        <List dataSource={detail.impactScope} renderItem={(item) => <List.Item>{item}</List.Item>} />
        <Divider />
        <Typography.Text strong>Risks and dependencies</Typography.Text>
        <List dataSource={detail.risks} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>

      <Card title="Review history">
        {detail.reviews.length > 0 ? (
          <Timeline
            items={detail.reviews.map((item) => ({
              color:
                item.result === 'approved'
                  ? 'green'
                  : item.result === 'rejected'
                    ? 'red'
                    : item.result === 'delayed'
                      ? 'orange'
                      : 'blue',
              children: (
                <Space direction="vertical" size={4}>
                  <Space>
                    <Typography.Text strong>{item.reviewerName}</Typography.Text>
                    <Tag color={reviewResultColorMap[item.result]}>{reviewResultLabelMap[item.result]}</Tag>
                    <Typography.Text type="secondary">{item.reviewedAt}</Typography.Text>
                  </Space>
                  <Typography.Paragraph>{item.comment}</Typography.Paragraph>
                </Space>
              ),
            }))}
          />
        ) : (
          <Empty description="No review records yet" />
        )}
      </Card>

      {canReviewRequirements ? (
        <Card title="Add a review record">
          <Form form={reviewForm} layout="vertical">
            <Form.Item label="Reviewer" name="reviewerName" rules={[{ required: true, message: 'Enter a reviewer name' }]}>
              <Input placeholder="Example: Wang Jun" />
            </Form.Item>
            <Form.Item label="Decision" name="result" rules={[{ required: true, message: 'Select a review decision' }]}>
              <Radio.Group optionType="button" buttonStyle="solid">
                <Radio.Button value="approved">Approve</Radio.Button>
                <Radio.Button value="rejected">Reject</Radio.Button>
                <Radio.Button value="delayed">Delay</Radio.Button>
                <Radio.Button value="supplement_required">Need more info</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="Comment" name="comment" rules={[{ required: true, message: 'Write a short review comment' }]}>
              <Input.TextArea rows={4} placeholder="Capture the decision, open questions and next steps." />
            </Form.Item>
            <Button type="primary" loading={reviewSubmitting} onClick={onSubmitReview}>
              Save review record
            </Button>
          </Form>
        </Card>
      ) : null}

      <Card title="Linked executions">
        {detail.linkedExecutionNames.length > 0 ? (
          <List dataSource={detail.linkedExecutionNames} renderItem={(item) => <List.Item>{item}</List.Item>} />
        ) : (
          <Empty description="No linked executions yet" />
        )}
      </Card>
    </Space>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRequirementDraftPayload(
  values: RequirementCreateFormValues | RequirementEditFormValues,
): CreateRequirementPayload {
  return {
    title: values.title.trim(),
    priority: values.priority,
    ownerName: values.ownerName.trim(),
    expectedReleaseAt: values.expectedReleaseAt.format('YYYY-MM-DD'),
    description: values.description.trim(),
    solutionSummary: values.solutionSummary.trim(),
    acceptanceCriteria: splitLines(values.acceptanceCriteriaText),
    impactScope: splitLines(values.impactScopeText),
    risks: splitLines(values.risksText),
  };
}

function canSubmitForReview(detail: RequirementDetail): boolean {
  return ['Draft', 'Understanding', 'Confirmed'].includes(detail.status);
}