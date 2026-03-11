import { useDeferredValue, useMemo, useState } from 'react';
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
  approved: '已通过',
  rejected: '已驳回',
  delayed: '延后处理',
  supplement_required: '需要补充信息',
};

const reviewResultColorMap: Record<ReviewResult, string> = {
  approved: 'success',
  rejected: 'error',
  delayed: 'warning',
  supplement_required: 'processing',
};

const requirementStatusOptions = [
  { label: '草稿', value: 'Draft' },
  { label: '需求澄清', value: 'Understanding' },
  { label: '已确认', value: 'Confirmed' },
  { label: '待评审', value: 'ToReview' },
  { label: '已评审', value: 'Reviewed' },
  { label: '已排期', value: 'Scheduled' },
  { label: '开发中', value: 'InDevelopment' },
];

const priorityOptions = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
];

const maturityCheckLabelMap: Record<string, string> = {
  acceptance: '已补充验收标准',
  solution: '已补充方案摘要',
  impact: '已明确影响范围',
  risk: '已记录风险与依赖',
  owner: '已指派负责人',
};

const stageLabelMap: Record<string, string> = {
  Drafting: '草稿整理',
  Understanding: '需求澄清',
  Confirmed: '已确认',
  'Pending review': '待评审',
  Reviewed: '已评审',
  Scheduled: '已排期',
  'In development': '开发中',
  草稿整理: '草稿整理',
  需求澄清: '需求澄清',
  已确认: '已确认',
  待评审: '待评审',
  已评审: '已评审',
  已排期: '已排期',
  开发中: '开发中',
};

const columns: ColumnsType<Requirement> = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  {
    title: '需求名称',
    dataIndex: 'title',
    render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
  },
  { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
  { title: '优先级', dataIndex: 'priority', width: 90 },
  { title: '负责人', dataIndex: 'ownerName', width: 140 },
  { title: '目标版本', dataIndex: 'expectedReleaseAt', width: 140 },
  { title: '关联执行数', dataIndex: 'linkedExecutionCount', width: 140 },
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
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<Requirement['status'] | 'all'>('all');
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [reviewForm] = Form.useForm<RequirementReviewPayload>();
  const [generateForm] = Form.useForm();
  const [createForm] = Form.useForm<RequirementCreateFormValues>();
  const [editForm] = Form.useForm<RequirementEditFormValues>();
  const queryClient = useQueryClient();
  const deferredSearchKeyword = useDeferredValue(searchKeyword);

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

  const filteredRequirements = useMemo(() => {
    const normalizedKeyword = deferredSearchKeyword.trim().toLowerCase();
    return (requirementsQuery.data ?? []).filter((item) => {
      const matchesKeyword =
        normalizedKeyword === '' ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.ownerName.toLowerCase().includes(normalizedKeyword) ||
        String(item.id).includes(normalizedKeyword);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [deferredSearchKeyword, requirementsQuery.data, statusFilter]);

  const hasRequirementFilters = deferredSearchKeyword.trim() !== '' || statusFilter !== 'all';

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
      messageApi.success('需求已创建。');
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
      messageApi.success('需求已更新。');
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
      messageApi.success('需求已提交评审。');
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
      messageApi.success('评审记录已保存，需求状态已同步更新。');
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
        messageApi.warning(`已生成 ${createdCount} 条执行，另有 ${skippedCount} 条因状态不符合规则被跳过。`);
        return;
      }
      messageApi.success(`已生成 ${createdCount} 条执行。`);
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const openGenerateModal = (ids?: number[]) => {
    if (!canGenerateExecutions) {
      messageApi.warning('当前角色没有生成执行的权限。');
      return;
    }

    const requirementIds = ids && ids.length > 0 ? ids : selectedRowKeys;
    if (requirementIds.length === 0) {
      messageApi.info('请先选择至少一条需求。');
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
      messageApi.warning('当前角色没有创建需求的权限。');
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
      messageApi.warning('当前角色没有编辑需求的权限。');
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
      messageApi.warning('当前角色没有创建需求的权限。');
      return;
    }

    const values = await createForm.validateFields();
    createMutation.mutate(toRequirementDraftPayload(values));
  };

  const handleUpdateRequirement = async () => {
    if (!canManageRequirements) {
      messageApi.warning('当前角色没有编辑需求的权限。');
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
      messageApi.warning('当前角色没有新增评审记录的权限。');
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
      messageApi.warning('当前角色没有提交评审的权限。');
      return;
    }

    if (selectedRequirementId === null) {
      return;
    }

    submitForReviewMutation.mutate(selectedRequirementId);
  };

  const handleGenerateExecutions = async () => {
    if (!canGenerateExecutions) {
      messageApi.warning('当前角色没有生成执行的权限。');
      return;
    }

    const values = await generateForm.validateFields();
    const project = projectsQuery.data?.find((item) => item.id === values.projectId);

    if (!project) {
      messageApi.error('未找到目标项目。');
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
        title="需求池"
        description="支持需求创建、编辑、送审、评审记录和批量生成执行。"
        extra={
          canGenerateExecutions || canManageRequirements ? (
            <Space>
              {canGenerateExecutions ? (
                <Button onClick={() => openGenerateModal()} disabled={selectedRowKeys.length === 0}>
                  批量生成执行
                </Button>
              ) : null}
              {canManageRequirements ? (
                <Button type="primary" onClick={openCreateModal}>
                  新建需求
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      />
      <Card title="需求列表" extra={<Typography.Text type="secondary">已选 {selectedRowKeys.length} 条</Typography.Text>}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="page-toolbar">
            <Space wrap>
              <Input.Search
                allowClear
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="按需求标题、负责人或 ID 搜索"
                style={{ width: 280 }}
              />
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                style={{ width: 180 }}
                options={[{ label: '全部状态', value: 'all' }, ...requirementStatusOptions]}
              />
              {hasRequirementFilters ? <Button onClick={() => { setSearchKeyword(''); setStatusFilter('all'); }}>清空筛选</Button> : null}
            </Space>
            <Typography.Text type="secondary">显示 {filteredRequirements.length} / {requirementsQuery.data?.length ?? 0} 条</Typography.Text>
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredRequirements}
            loading={requirementsQuery.isLoading}
            pagination={false}
            locale={{ emptyText: hasRequirementFilters ? '没有匹配的需求' : '暂无需求' }}
            rowClassName={(record) => record.id === selectedRequirementId ? 'pm-row pm-row--active' : 'pm-row'}
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
        </Space>
      </Card>
      <Drawer
        title={detailQuery.data?.title ?? '需求详情'}
        width={720}
        open={selectedRequirementId !== null}
        onClose={() => setSelectedRequirementId(null)}
        extra={
          detailQuery.data ? (
            <Space>
              {canManageRequirements ? <Button onClick={openEditModal}>编辑</Button> : null}
              {canReviewRequirements ? (
                <Button
                  type="primary"
                  onClick={handleSubmitForReview}
                  disabled={!canSubmitReview}
                  loading={submitForReviewMutation.isPending}
                >
                  提交评审
                </Button>
              ) : null}
              {canGenerateExecutions ? (
                <Button onClick={() => openGenerateModal(selectedRequirementId !== null ? [selectedRequirementId] : [])}>
                  生成执行
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
          <Alert type="error" showIcon message="获取需求详情失败" description={formatApiError(detailQuery.error)} />
        ) : detailQuery.data ? (
          <RequirementDetailContent
            detail={detailQuery.data}
            onSubmitReview={handleSubmitReview}
            reviewForm={reviewForm}
            reviewSubmitting={reviewMutation.isPending}
            canReviewRequirements={canReviewRequirements}
          />
        ) : (
          <Empty description="未找到需求详情" />
        )}
      </Drawer>

      <Modal
        title="新建需求"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateRequirement}
        okText="创建"
        confirmLoading={createMutation.isPending}
        width={760}
      >
        <RequirementEditorForm form={createForm} mode="create" />
      </Modal>

      <Modal
        title="编辑需求"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdateRequirement}
        okText="保存"
        confirmLoading={updateMutation.isPending}
        width={760}
      >
        <RequirementEditorForm form={editForm} mode="edit" />
      </Modal>

      <Modal
        title="批量生成执行"
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        onOk={handleGenerateExecutions}
        okText="生成"
        confirmLoading={generateMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={`本次将处理 ${selectedRows.length} 条需求`}
            description={selectedRows.map((item) => item.title).join('，') || '当前未选择需求'}
          />
          <Form form={generateForm} layout="vertical">
            <Form.Item label="目标项目" name="projectId" rules={[{ required: true, message: '请选择目标项目' }]}>
              <Select
                placeholder="请选择项目"
                options={(projectsQuery.data ?? []).map((item: Project) => ({
                  label: `${item.name} (${item.code})`,
                  value: item.id,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="计划时间"
              name="planRange"
              rules={[{ required: true, message: '请选择计划开始和结束日期' }]}
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
      <Form.Item label="需求标题" name="title" rules={[{ required: true, message: '请输入需求标题' }]}>
        <Input placeholder="例如：需求评审与批量生成执行" />
      </Form.Item>
      {mode === 'edit' ? (
        <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
          <Select options={requirementStatusOptions} />
        </Form.Item>
      ) : null}
      <Space size={16} style={{ width: '100%' }}>
        <Form.Item label="优先级" name="priority" rules={[{ required: true, message: '请选择优先级' }]} style={{ flex: 1 }}>
          <Select options={priorityOptions} />
        </Form.Item>
        <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]} style={{ flex: 1 }}>
          <Input placeholder="例如：王军" />
        </Form.Item>
        <Form.Item
          label="目标版本"
          name="expectedReleaseAt"
          rules={[{ required: true, message: '请选择目标版本日期' }]}
          style={{ flex: 1 }}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Space>
      <Form.Item label="需求描述" name="description" rules={[{ required: true, message: '请填写需求描述' }]}>
        <Input.TextArea rows={3} placeholder="描述业务问题和期望结果。" />
      </Form.Item>
      <Form.Item label="方案摘要" name="solutionSummary" rules={[{ required: true, message: '请填写方案摘要' }]}>
        <Input.TextArea rows={3} placeholder="描述计划采用的解决方案。" />
      </Form.Item>
      <Form.Item
        label="验收标准"
        name="acceptanceCriteriaText"
        rules={[{ required: true, message: '请至少填写一条验收标准' }]}
        extra="每行填写一项。"
      >
        <Input.TextArea rows={4} placeholder={'验收点 1\n验收点 2'} />
      </Form.Item>
      <Form.Item
        label="影响范围"
        name="impactScopeText"
        rules={[{ required: true, message: '请至少填写一条影响范围' }]}
        extra="每行填写一项。"
      >
        <Input.TextArea rows={3} placeholder={'需求池\n执行管理'} />
      </Form.Item>
      <Form.Item
        label="风险与依赖"
        name="risksText"
        rules={[{ required: true, message: '请至少填写一条风险或依赖' }]}
        extra="每行填写一项。"
      >
        <Input.TextArea rows={3} placeholder="例如：依赖评审质量与排期确认" />
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
          { key: 'status', label: '状态', children: <StatusTag value={detail.status} /> },
          { key: 'stage', label: '当前阶段', children: formatRequirementStage(detail.currentStage) },
          { key: 'priority', label: '优先级', children: detail.priority },
          { key: 'owner', label: '负责人', children: detail.ownerName },
          { key: 'release', label: '目标版本', children: detail.expectedReleaseAt },
          { key: 'executionCount', label: '关联执行数', children: detail.linkedExecutionCount },
        ]}
      />

      <Card title="需求描述">
        <Typography.Paragraph>{detail.description}</Typography.Paragraph>
        <Typography.Text strong>方案摘要</Typography.Text>
        <Typography.Paragraph style={{ marginBottom: 0 }}>{detail.solutionSummary}</Typography.Paragraph>
      </Card>

      <Card title="成熟度检查">
        {failedChecks.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="仍有评审前置项未补齐"
            description={failedChecks.map((item) => formatMaturityCheckLabel(item.key, item.label)).join('、')}
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Alert
            type="success"
            showIcon
            message="成熟度检查已通过，可以继续评审或生成执行。"
            style={{ marginBottom: 16 }}
          />
        )}
        <Space wrap>
          {detail.maturityChecks.map((item) => (
            <Tag key={item.key} color={item.passed ? 'success' : 'warning'}>
              {formatMaturityCheckLabel(item.key, item.label)}
            </Tag>
          ))}
        </Space>
      </Card>

      <Card title="验收标准">
        <List dataSource={detail.acceptanceCriteria} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>

      <Card title="影响范围与风险">
        <Typography.Text strong>影响范围</Typography.Text>
        <List dataSource={detail.impactScope} renderItem={(item) => <List.Item>{item}</List.Item>} />
        <Divider />
        <Typography.Text strong>风险与依赖</Typography.Text>
        <List dataSource={detail.risks} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>

      <Card title="评审记录">
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
                  <Typography.Paragraph style={{ marginBottom: 0 }}>{item.comment}</Typography.Paragraph>
                </Space>
              ),
            }))}
          />
        ) : (
          <Empty description="暂无评审记录" />
        )}
      </Card>

      {canReviewRequirements ? (
        <Card title="新增评审记录">
          <Form form={reviewForm} layout="vertical">
            <Form.Item label="评审人" name="reviewerName" rules={[{ required: true, message: '请输入评审人姓名' }]}>
              <Input placeholder="例如：王军" />
            </Form.Item>
            <Form.Item label="评审结论" name="result" rules={[{ required: true, message: '请选择评审结论' }]}>
              <Radio.Group optionType="button" buttonStyle="solid">
                <Radio.Button value="approved">通过</Radio.Button>
                <Radio.Button value="rejected">驳回</Radio.Button>
                <Radio.Button value="delayed">延后</Radio.Button>
                <Radio.Button value="supplement_required">补充信息</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="评审意见" name="comment" rules={[{ required: true, message: '请填写评审意见' }]}>
              <Input.TextArea rows={4} placeholder="记录决策、待补充问题和下一步动作。" />
            </Form.Item>
            <Button type="primary" loading={reviewSubmitting} onClick={onSubmitReview}>
              保存评审记录
            </Button>
          </Form>
        </Card>
      ) : null}

      <Card title="关联执行">
        {detail.linkedExecutionNames.length > 0 ? (
          <List dataSource={detail.linkedExecutionNames} renderItem={(item) => <List.Item>{item}</List.Item>} />
        ) : (
          <Empty description="暂无关联执行" />
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

function formatRequirementStage(value: string): string {
  return stageLabelMap[value] ?? value;
}

function formatMaturityCheckLabel(key: string, label: string): string {
  return maturityCheckLabelMap[key] ?? label;
}
