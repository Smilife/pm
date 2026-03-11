import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Button,
  Card,
  DatePicker,
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
  Upload,
  message,
} from 'antd';
import type { FormInstance, UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { formatApiError, pmApi } from '../services/api';
import type {
  CreateRequirementPayload,
  Project,
  Requirement,
  RequirementAttachment,
  RequirementDetail,
  RequirementGenerateExecutionPayload,
  RequirementReviewPayload,
  RequirementStatus,
  UpdateRequirementPayload,
} from '../services/types';
import { useAuthStore } from '../store/authStore';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS: Array<{ label: string; value: RequirementStatus }> = [
  { label: '\u8349\u7a3f', value: 'Draft' },
  { label: '\u9700\u6c42\u6f84\u6e05', value: 'Understanding' },
  { label: '\u5df2\u786e\u8ba4', value: 'Confirmed' },
  { label: '\u5f85\u8bc4\u5ba1', value: 'ToReview' },
  { label: '\u5df2\u8bc4\u5ba1', value: 'Reviewed' },
  { label: '\u5df2\u6392\u671f', value: 'Scheduled' },
  { label: '\u5f00\u53d1\u4e2d', value: 'InDevelopment' },
];
const PRIORITY_OPTIONS = ['P0', 'P1', 'P2'].map((value) => ({ label: value, value })) as Array<{
  label: 'P0' | 'P1' | 'P2';
  value: 'P0' | 'P1' | 'P2';
}>;
const CHECK_LABELS: Record<string, string> = {
  title: '\u9700\u6c42\u6807\u9898',
  description: '\u9700\u6c42\u80cc\u666f',
  owner: '\u8d1f\u8d23\u4eba',
  release: '\u76ee\u6807\u65e5\u671f',
  solution: '\u65b9\u6848\u6458\u8981',
  acceptance: '\u9a8c\u6536\u6807\u51c6',
  impact: '\u5f71\u54cd\u8303\u56f4',
  risk: '\u98ce\u9669\u4e0e\u4f9d\u8d56',
};

type RequirementFormValues = {
  title: string;
  status: RequirementStatus;
  priority: 'P0' | 'P1' | 'P2';
  ownerName: string;
  expectedReleaseAt: Dayjs | null;
  description: string;
  solutionSummary: string;
  acceptanceText: string;
  impactText: string;
  riskText: string;
};

export function RequirementsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? '');
  const canManage = permissions.includes('requirement.create.project');
  const canReview = permissions.includes('requirement.review.create.project');
  const canGenerate = permissions.includes('requirement.execution.generate.project');
  const [selectedRequirementId, setSelectedRequirementId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequirementStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<RequirementFormValues>();
  const [editForm] = Form.useForm<RequirementFormValues>();
  const [reviewForm] = Form.useForm<RequirementReviewPayload>();
  const [generateForm] = Form.useForm<{ projectId: number; planRange: [Dayjs, Dayjs] }>();
  const queryClient = useQueryClient();
  const deferredKeyword = useDeferredValue(keyword);

  const requirementsQuery = useQuery({ queryKey: ['requirements'], queryFn: pmApi.getRequirements });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: pmApi.getProjects });
  const detailQuery = useQuery({
    queryKey: ['requirement-detail', selectedRequirementId],
    queryFn: () => (selectedRequirementId ? pmApi.getRequirementDetail(selectedRequirementId) : Promise.resolve(null)),
    enabled: selectedRequirementId !== null,
  });

  const filteredRequirements = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    return (requirementsQuery.data ?? []).filter((item) => {
      const matchesKeyword =
        normalizedKeyword === '' ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.ownerName.toLowerCase().includes(normalizedKeyword) ||
        String(item.id).includes(normalizedKeyword);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [deferredKeyword, requirementsQuery.data, statusFilter]);

  const selectedRows = useMemo(() => {
    const items = requirementsQuery.data ?? [];
    return items.filter((item) => selectedRowKeys.includes(item.id));
  }, [requirementsQuery.data, selectedRowKeys]);

  const refreshRequirement = async (id: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requirements'] }),
      queryClient.invalidateQueries({ queryKey: ['requirement-detail', id] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateRequirementPayload) => pmApi.createRequirement(payload),
    onSuccess: async (created) => {
      await refreshRequirement(created.id);
      setCreateOpen(false);
      setSelectedRequirementId(created.id);
      messageApi.success('\u8349\u7a3f\u5df2\u4fdd\u5b58\uff0c\u53ef\u4ee5\u7ee7\u7eed\u8865\u5145\u56fe\u7247\u6216\u8bed\u97f3\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRequirementPayload }) => pmApi.updateRequirement(id, payload),
    onSuccess: async (updated) => {
      await refreshRequirement(updated.id);
      setEditOpen(false);
      messageApi.success('\u9700\u6c42\u5df2\u66f4\u65b0\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => pmApi.uploadRequirementAttachment(id, file),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['requirement-detail', variables.id] });
      messageApi.success('\u9644\u4ef6\u4e0a\u4f20\u6210\u529f\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const submitReviewMutation = useMutation({
    mutationFn: (id: number) => pmApi.submitRequirementForReview(id),
    onSuccess: async (updated) => {
      await refreshRequirement(updated.id);
      messageApi.success('\u9700\u6c42\u5df2\u63d0\u4ea4\u8bc4\u5ba1\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RequirementReviewPayload }) => pmApi.createRequirementReview(id, payload),
    onSuccess: async (_, variables) => {
      await refreshRequirement(variables.id);
      reviewForm.setFieldsValue({ reviewerName: currentUserName, result: 'approved', comment: '' });
      messageApi.success('\u8bc4\u5ba1\u8bb0\u5f55\u5df2\u4fdd\u5b58\u3002');
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const generateMutation = useMutation({
    mutationFn: (payload: RequirementGenerateExecutionPayload) => pmApi.batchGenerateExecutions(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['executions'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
      setGenerateOpen(false);
      setSelectedRowKeys([]);
      messageApi.success(`\u5df2\u751f\u6210 ${result.items.length} \u6761\u6267\u884c\uff0c\u8df3\u8fc7 ${result.skippedRequirementIds.length} \u6761\u3002`);
    },
    onError: (error) => messageApi.error(formatApiError(error)),
  });

  const uploadProps: UploadProps = {
    accept: 'image/*,audio/*',
    showUploadList: false,
    customRequest: async ({ file, onError, onSuccess }) => {
      if (!(file instanceof File) || !detailQuery.data) {
        onError?.(new Error('\u65e0\u6cd5\u8bc6\u522b\u4e0a\u4f20\u6587\u4ef6\u3002'));
        return;
      }
      try {
        await uploadMutation.mutateAsync({ id: detailQuery.data.id, file });
        onSuccess?.({});
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('upload_failed'));
      }
    },
  };

  const columns: ColumnsType<Requirement> = [
    { title: 'ID', dataIndex: 'id', width: 90 },
    { title: '\u9700\u6c42\u6807\u9898', dataIndex: 'title', render: (value: string) => <Typography.Text strong>{formatTitle(value)}</Typography.Text> },
    { title: '\u72b6\u6001', dataIndex: 'status', width: 110, render: (value: string) => <StatusTag value={value} /> },
    { title: '\u4f18\u5148\u7ea7', dataIndex: 'priority', width: 90 },
    { title: '\u8d1f\u8d23\u4eba', dataIndex: 'ownerName', width: 140, render: (value: string) => value || '\u5f85\u6307\u6d3e' },
    { title: '\u76ee\u6807\u65e5\u671f', dataIndex: 'expectedReleaseAt', width: 140, render: (value: string) => value || '\u5f85\u8865\u5145' },
  ];

  return (
    <Space direction="vertical" size={24} className="page-stack">
      {contextHolder}
      <PageHeader
        title={'\u9700\u6c42\u6c60'}
        description={'\u8349\u7a3f\u9636\u6bb5\u53ef\u4ee5\u5148\u5feb\u901f\u8bb0\u5f55\u60f3\u6cd5\uff0c\u4fdd\u5b58\u540e\u518d\u9010\u6b65\u8865\u9f50\u4fe1\u606f\u5e76\u4e0a\u4f20\u56fe\u7247\u6216\u8bed\u97f3\u3002'}
        extra={<Space>{canGenerate ? <Button disabled={selectedRows.length === 0} onClick={() => setGenerateOpen(true)}>{'\u6279\u91cf\u751f\u6210\u6267\u884c'}</Button> : null}{canManage ? <Button type="primary" onClick={() => { createForm.setFieldsValue(defaultValues(currentUserName)); setCreateOpen(true); }}>{'\u8bb0\u5f55\u60f3\u6cd5'}</Button> : null}</Space>}
      />
      <Card>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message={'\u8349\u7a3f\u53ef\u4ee5\u5148\u7a7a\u7740'} description={'\u6807\u9898\u3001\u80cc\u666f\u3001\u9a8c\u6536\u6807\u51c6\u3001\u98ce\u9669\u7b49\u4fe1\u606f\u4e0d\u5fc5\u4e00\u4e0a\u6765\u5168\u90e8\u586b\u5b8c\uff1b\u63d0\u4ea4\u8bc4\u5ba1\u524d\u7cfb\u7edf\u4f1a\u5f3a\u6821\u9a8c\u5b8c\u6574\u6027\u3002'} />
          <div className="page-toolbar">
            <Space wrap>
              <Input.Search allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={'\u641c\u7d22\u6807\u9898 / \u8d1f\u8d23\u4eba / ID'} style={{ width: 280 }} />
              <Select value={statusFilter} onChange={(value) => setStatusFilter(value)} options={[{ label: '\u5168\u90e8\u72b6\u6001', value: 'all' }, ...STATUS_OPTIONS]} style={{ width: 180 }} />
              <Button onClick={() => { setKeyword(''); setStatusFilter('all'); }}>{'\u6e05\u7a7a\u7b5b\u9009'}</Button>
            </Space>
            <Typography.Text type="secondary">{`\u5f53\u524d ${filteredRequirements.length} \u6761`}</Typography.Text>
          </div>
          <Table rowKey="id" columns={columns} dataSource={filteredRequirements} loading={requirementsQuery.isLoading} pagination={false} locale={{ emptyText: <Empty description={'\u6682\u65e0\u9700\u6c42'} /> }} rowSelection={canGenerate ? { selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys.map((item) => Number(item))) } : undefined} onRow={(record) => ({ className: selectedRequirementId === record.id ? 'pm-row pm-row--active' : 'pm-row', onClick: () => { setSelectedRequirementId(record.id); reviewForm.setFieldsValue({ reviewerName: currentUserName, result: 'approved', comment: '' }); } })} />
        </Space>
      </Card>
      <Drawer width={720} open={selectedRequirementId !== null} onClose={() => setSelectedRequirementId(null)} title={detailQuery.data ? formatTitle(detailQuery.data.title) : '\u9700\u6c42\u8be6\u60c5'} extra={detailQuery.data ? <Space>{canManage ? <Button onClick={() => { editForm.setFieldsValue(toFormValues(detailQuery.data!)); setEditOpen(true); }}>{'\u7f16\u8f91\u8349\u7a3f'}</Button> : null}{canReview && ['Draft', 'Understanding', 'Confirmed'].includes(detailQuery.data.status) ? <Button type="primary" loading={submitReviewMutation.isPending} onClick={() => submitReviewMutation.mutate(detailQuery.data!.id)}>{'\u63d0\u4ea4\u8bc4\u5ba1'}</Button> : null}</Space> : null}>
        {detailQuery.isLoading ? <Card loading /> : detailQuery.data ? <RequirementDetailView detail={detailQuery.data} canManage={canManage} canReview={canReview} reviewForm={reviewForm} reviewSubmitting={reviewMutation.isPending} uploadProps={uploadProps} onSubmitReview={() => reviewForm.validateFields().then((payload) => reviewMutation.mutate({ id: detailQuery.data!.id, payload }))} /> : <Empty description={'\u8bf7\u9009\u62e9\u4e00\u6761\u9700\u6c42'} />}
      </Drawer>
      <Modal title={'\u8bb0\u5f55\u65b0\u60f3\u6cd5'} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.validateFields().then((values) => createMutation.mutate(toCreatePayload(values)))} okText={'\u4fdd\u5b58\u8349\u7a3f'} confirmLoading={createMutation.isPending} destroyOnClose>
        <RequirementEditor form={createForm} mode="create" />
      </Modal>
      <Modal title={'\u7f16\u8f91\u9700\u6c42'} open={editOpen} onCancel={() => setEditOpen(false)} onOk={() => detailQuery.data && editForm.validateFields().then((values) => updateMutation.mutate({ id: detailQuery.data!.id, payload: toUpdatePayload(values) }))} okText={'\u4fdd\u5b58\u66f4\u65b0'} confirmLoading={updateMutation.isPending} destroyOnClose>
        <RequirementEditor form={editForm} mode="edit" />
      </Modal>
      <Modal title={'\u6279\u91cf\u751f\u6210\u6267\u884c'} open={generateOpen} onCancel={() => setGenerateOpen(false)} onOk={() => generateForm.validateFields().then((values) => { const project = (projectsQuery.data ?? []).find((item) => item.id === values.projectId); generateMutation.mutate({ requirementIds: selectedRows.map((item) => item.id), projectId: values.projectId, projectName: project?.name ?? 'Unassigned project', planStart: values.planRange[0].format('YYYY-MM-DD'), planEnd: values.planRange[1].format('YYYY-MM-DD') }); })} okText={'\u751f\u6210\u6267\u884c'} confirmLoading={generateMutation.isPending} destroyOnClose>
        <Form form={generateForm} layout="vertical">
          <Form.Item label={'\u9879\u76ee'} name="projectId" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u9879\u76ee' }]}><Select options={(projectsQuery.data ?? []).map((item: Project) => ({ label: `${item.name} (${item.code})`, value: item.id }))} /></Form.Item>
          <Form.Item label={'\u8ba1\u5212\u65f6\u95f4'} name="planRange" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u8ba1\u5212\u65f6\u95f4' }]}><RangePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function RequirementEditor({ form, mode }: { form: FormInstance<RequirementFormValues>; mode: 'create' | 'edit' }) {
  return (
    <Form form={form} layout="vertical">
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={mode === 'create' ? '\u5148\u8bb0\u4e0b\u60f3\u6cd5' : '\u7ee7\u7eed\u5b8c\u5584\u8fd9\u6761\u9700\u6c42'} description={'\u8349\u7a3f\u9636\u6bb5\u652f\u6301\u5206\u6b65\u586b\u5199\uff0c\u4fdd\u5b58\u540e\u53ef\u5728\u8be6\u60c5\u9875\u4e0a\u4f20\u56fe\u7247\u548c\u8bed\u97f3\u3002'} />
      <Form.Item label={'\u9700\u6c42\u6807\u9898'} name="title"><Input placeholder={'\u4f8b\u5982\uff1a\u652f\u6301\u9700\u6c42\u8349\u7a3f\u4e0a\u4f20\u8bed\u97f3\u9644\u4ef6'} /></Form.Item>
      {mode === 'edit' ? <Form.Item label={'\u72b6\u6001'} name="status"><Select options={STATUS_OPTIONS} /></Form.Item> : null}
      <Space size={16} style={{ width: '100%' }} wrap>
        <Form.Item label={'\u4f18\u5148\u7ea7'} name="priority" style={{ flex: 1, minWidth: 160 }}><Select options={PRIORITY_OPTIONS} /></Form.Item>
        <Form.Item label={'\u8d1f\u8d23\u4eba'} name="ownerName" style={{ flex: 1, minWidth: 160 }}><Input /></Form.Item>
        <Form.Item label={'\u76ee\u6807\u65e5\u671f'} name="expectedReleaseAt" style={{ flex: 1, minWidth: 160 }}><DatePicker style={{ width: '100%' }} /></Form.Item>
      </Space>
      <Form.Item label={'\u9700\u6c42\u80cc\u666f'} name="description"><Input.TextArea rows={3} /></Form.Item>
      <Form.Item label={'\u65b9\u6848\u6458\u8981'} name="solutionSummary"><Input.TextArea rows={3} /></Form.Item>
      <Form.Item label={'\u9a8c\u6536\u6807\u51c6'} name="acceptanceText" extra={'\u6bcf\u884c\u4e00\u6761'}><Input.TextArea rows={3} /></Form.Item>
      <Form.Item label={'\u5f71\u54cd\u8303\u56f4'} name="impactText" extra={'\u6bcf\u884c\u4e00\u6761'}><Input.TextArea rows={3} /></Form.Item>
      <Form.Item label={'\u98ce\u9669\u4e0e\u4f9d\u8d56'} name="riskText" extra={'\u6bcf\u884c\u4e00\u6761'}><Input.TextArea rows={3} /></Form.Item>
    </Form>
  );
}

function RequirementDetailView({ detail, canManage, canReview, reviewForm, reviewSubmitting, uploadProps, onSubmitReview }: { detail: RequirementDetail; canManage: boolean; canReview: boolean; reviewForm: FormInstance<RequirementReviewPayload>; reviewSubmitting: boolean; uploadProps: UploadProps; onSubmitReview: () => void; }) {
  const failedChecks = detail.maturityChecks.filter((item) => !item.passed);
  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Descriptions size="small" column={2} items={[{ key: 'status', label: '\u72b6\u6001', children: <StatusTag value={detail.status} /> }, { key: 'owner', label: '\u8d1f\u8d23\u4eba', children: detail.ownerName || '\u5f85\u6307\u6d3e' }, { key: 'date', label: '\u76ee\u6807\u65e5\u671f', children: detail.expectedReleaseAt || '\u5f85\u8865\u5145' }, { key: 'count', label: '\u5173\u8054\u6267\u884c', children: detail.linkedExecutionCount }]} />
    <Card title={'\u9700\u6c42\u8bf4\u660e'}><Typography.Paragraph>{detail.description || '\u6682\u65e0\u9700\u6c42\u80cc\u666f\u3002'}</Typography.Paragraph><Typography.Text strong>{'\u65b9\u6848\u6458\u8981'}</Typography.Text><Typography.Paragraph style={{ marginBottom: 0 }}>{detail.solutionSummary || '\u6682\u65e0\u65b9\u6848\u6458\u8981\u3002'}</Typography.Paragraph></Card>
    <Card title={'\u8bc4\u5ba1\u524d\u68c0\u67e5'}>{failedChecks.length > 0 ? <Alert type="warning" showIcon message={'\u8fd8\u6709\u4fe1\u606f\u672a\u8865\u9f50'} description={failedChecks.map((item) => CHECK_LABELS[item.key] ?? item.label).join('\u3001')} style={{ marginBottom: 16 }} /> : <Alert type="success" showIcon message={'\u5df2\u6ee1\u8db3\u63d0\u4ea4\u8bc4\u5ba1\u6761\u4ef6'} style={{ marginBottom: 16 }} />}<Space wrap>{detail.maturityChecks.map((item) => <Tag key={item.key} color={item.passed ? 'success' : 'warning'}>{CHECK_LABELS[item.key] ?? item.label}</Tag>)}</Space></Card>
    <Card title={'\u9644\u4ef6'} extra={canManage ? <Upload {...uploadProps}><Button>{'\u4e0a\u4f20\u56fe\u7247\u6216\u8bed\u97f3'}</Button></Upload> : null}>{detail.attachments.length > 0 ? <List dataSource={detail.attachments} renderItem={(item) => <List.Item><AttachmentItem item={item} /></List.Item>} /> : <Empty description={'\u8fd8\u6ca1\u6709\u9644\u4ef6'} />}</Card>
    <Card title={'\u9a8c\u6536\u6807\u51c6'}>{detail.acceptanceCriteria.length > 0 ? <List dataSource={detail.acceptanceCriteria} renderItem={(item) => <List.Item>{item}</List.Item>} /> : <Empty description={'\u6682\u65e0\u9a8c\u6536\u6807\u51c6'} />}</Card>
    <Card title={'\u5f71\u54cd\u8303\u56f4\u4e0e\u98ce\u9669'}><Typography.Text strong>{'\u5f71\u54cd\u8303\u56f4'}</Typography.Text>{detail.impactScope.length > 0 ? <List dataSource={detail.impactScope} renderItem={(item) => <List.Item>{item}</List.Item>} /> : <Empty description={'\u6682\u65e0\u5f71\u54cd\u8303\u56f4'} />}<Typography.Text strong>{'\u98ce\u9669\u4e0e\u4f9d\u8d56'}</Typography.Text>{detail.risks.length > 0 ? <List dataSource={detail.risks} renderItem={(item) => <List.Item>{item}</List.Item>} /> : <Empty description={'\u6682\u65e0\u98ce\u9669\u8bb0\u5f55'} />}</Card>
    <Card title={'\u8bc4\u5ba1\u8bb0\u5f55'}>{detail.reviews.length > 0 ? <List dataSource={detail.reviews} renderItem={(item) => <List.Item><Space direction="vertical" size={2}><Typography.Text strong>{item.reviewerName}</Typography.Text><Typography.Text type="secondary">{item.reviewedAt}</Typography.Text><Typography.Paragraph style={{ marginBottom: 0 }}>{item.comment}</Typography.Paragraph></Space></List.Item>} /> : <Empty description={'\u6682\u65e0\u8bc4\u5ba1\u8bb0\u5f55'} />}</Card>
    {canReview ? <Card title={'\u65b0\u589e\u8bc4\u5ba1\u8bb0\u5f55'}><Form form={reviewForm} layout="vertical"><Form.Item label={'\u8bc4\u5ba1\u4eba'} name="reviewerName" rules={[{ required: true, message: '\u8bf7\u8f93\u5165\u8bc4\u5ba1\u4eba' }]}><Input /></Form.Item><Form.Item label={'\u8bc4\u5ba1\u7ed3\u8bba'} name="result" rules={[{ required: true, message: '\u8bf7\u9009\u62e9\u7ed3\u8bba' }]}><Select options={[{ label: '\u901a\u8fc7', value: 'approved' }, { label: '\u9a73\u56de', value: 'rejected' }, { label: '\u5ef6\u540e', value: 'delayed' }, { label: '\u8865\u5145\u4fe1\u606f', value: 'supplement_required' }]} /></Form.Item><Form.Item label={'\u8bc4\u5ba1\u610f\u89c1'} name="comment" rules={[{ required: true, message: '\u8bf7\u586b\u5199\u8bc4\u5ba1\u610f\u89c1' }]}><Input.TextArea rows={3} /></Form.Item><Button type="primary" loading={reviewSubmitting} onClick={onSubmitReview}>{'\u4fdd\u5b58\u8bc4\u5ba1\u8bb0\u5f55'}</Button></Form></Card> : null}
  </Space>;
}

function AttachmentItem({ item }: { item: RequirementAttachment }) {
  return <Space direction="vertical" size={8} style={{ width: '100%' }}><Space><Tag color={item.fileType === 'image' ? 'blue' : item.fileType === 'audio' ? 'purple' : 'default'}>{item.fileType === 'image' ? '\u56fe\u7247' : item.fileType === 'audio' ? '\u8bed\u97f3' : '\u9644\u4ef6'}</Tag><Typography.Text strong>{item.fileName}</Typography.Text></Space>{item.fileType === 'image' ? <img alt={item.fileName} src={item.url} className="requirement-attachment-card__image" /> : null}{item.fileType === 'audio' ? <audio controls src={item.url} style={{ width: '100%' }} /> : null}<Typography.Link href={item.url} target="_blank" rel="noreferrer">{'\u67e5\u770b\u539f\u6587\u4ef6'}</Typography.Link></Space>;
}

function defaultValues(currentUserName: string): RequirementFormValues {
  return { title: '', status: 'Draft', priority: 'P1', ownerName: currentUserName, expectedReleaseAt: null, description: '', solutionSummary: '', acceptanceText: '', impactText: '', riskText: '' };
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function toFormValues(detail: RequirementDetail): RequirementFormValues {
  return { title: isUntitled(detail.title) ? '' : detail.title, status: detail.status, priority: detail.priority, ownerName: detail.ownerName, expectedReleaseAt: detail.expectedReleaseAt ? dayjs(detail.expectedReleaseAt) : null, description: detail.description, solutionSummary: detail.solutionSummary, acceptanceText: detail.acceptanceCriteria.join('\n'), impactText: detail.impactScope.join('\n'), riskText: detail.risks.join('\n') };
}

function toCreatePayload(values: RequirementFormValues): CreateRequirementPayload {
  return { title: values.title.trim(), priority: values.priority, ownerName: values.ownerName.trim(), expectedReleaseAt: values.expectedReleaseAt ? values.expectedReleaseAt.format('YYYY-MM-DD') : '', description: values.description.trim(), solutionSummary: values.solutionSummary.trim(), acceptanceCriteria: splitLines(values.acceptanceText), impactScope: splitLines(values.impactText), risks: splitLines(values.riskText) };
}

function toUpdatePayload(values: RequirementFormValues): UpdateRequirementPayload {
  return { ...toCreatePayload(values), status: values.status };
}

function isUntitled(value: string): boolean {
  return value.trim() === '' || value.trim().toLowerCase() === 'untitled draft';
}

function formatTitle(value: string): string {
  return isUntitled(value) ? '\u672a\u547d\u540d\u8349\u7a3f' : value;
}