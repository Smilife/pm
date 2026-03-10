import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { Alert, Button, Card, DatePicker, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';
import type { CreateDailyTaskPayload, DailyTask, UpdateDailyTaskPayload } from '../services/types';

type DailyTaskFormValues = {
  title: string;
  ownerName: string;
  status: DailyTask['status'];
  dueAt: Dayjs;
  excludeFromReport: boolean;
};

const columns = (
  onEdit: (item: DailyTask) => void,
  onToggleReport: (item: DailyTask) => void,
  onMarkDone: (item: DailyTask) => void,
  canUpdate: boolean,
): ColumnsType<DailyTask> => [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '事项', dataIndex: 'title' },
  { title: '负责人', dataIndex: 'ownerName', width: 140 },
  { title: '状态', dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  { title: '截止日期', dataIndex: 'dueAt', width: 140 },
  {
    title: '日报纳入',
    dataIndex: 'excludeFromReport',
    width: 140,
    render: (value: boolean) => <Tag color={value ? 'default' : 'success'}>{value ? '已排除' : '已纳入'}</Tag>,
  },
  {
    title: '操作',
    width: 260,
    render: (_, record) =>
      canUpdate ? (
        <Space>
          <Button size="small" onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" onClick={() => onToggleReport(record)}>
            {record.excludeFromReport ? '纳入日报' : '排除日报'}
          </Button>
          <Button size="small" disabled={record.status === 'Done'} onClick={() => onMarkDone(record)}>
            标记完成
          </Button>
        </Space>
      ) : (
        <Typography.Text type="secondary">仅查看</Typography.Text>
      ),
  },
];

export function DailyTasksPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? 'Wang Jun');
  const canCreateDailyTask = permissions.includes('daily_task.create.self');
  const canUpdateDailyTask = permissions.includes('daily_task.update.self');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<DailyTaskFormValues>();
  const [editForm] = Form.useForm<DailyTaskFormValues>();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({ queryKey: ['daily-tasks'], queryFn: pmApi.getDailyTasks });

  const createMutation = useMutation({
    mutationFn: (payload: CreateDailyTaskPayload) => pmApi.createDailyTask(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-report'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
      ]);
      setCreateModalOpen(false);
      createForm.resetFields();
      messageApi.success('日常事项已创建。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateDailyTaskPayload }) => pmApi.updateDailyTask(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-report'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
      ]);
      setEditModalOpen(false);
      setEditingTask(null);
      editForm.resetFields();
      messageApi.success('日常事项已更新。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const summary = useMemo(() => {
    const items = tasksQuery.data ?? [];
    return {
      included: items.filter((item) => !item.excludeFromReport).length,
      excluded: items.filter((item) => item.excludeFromReport).length,
      done: items.filter((item) => item.status === 'Done').length,
    };
  }, [tasksQuery.data]);

  const openCreateModal = () => {
    if (!canCreateDailyTask) {
      messageApi.warning('当前角色没有创建日常事项权限。');
      return;
    }

    createForm.setFieldsValue({
      ownerName: currentUserName,
      status: 'NotStarted',
      dueAt: dayjs(),
      excludeFromReport: false,
    });
    setCreateModalOpen(true);
  };

  const openEditModal = (item: DailyTask) => {
    if (!canUpdateDailyTask) {
      messageApi.warning('当前角色没有编辑日常事项权限。');
      return;
    }

    setEditingTask(item);
    editForm.setFieldsValue({
      title: item.title,
      ownerName: item.ownerName,
      status: item.status,
      dueAt: dayjs(item.dueAt),
      excludeFromReport: item.excludeFromReport,
    });
    setEditModalOpen(true);
  };

  const handleCreate = async () => {
    if (!canCreateDailyTask) {
      messageApi.warning('当前角色没有创建日常事项权限。');
      return;
    }

    const values = await createForm.validateFields();
    createMutation.mutate(mapTaskPayload(values));
  };

  const handleUpdate = async () => {
    if (!canUpdateDailyTask) {
      messageApi.warning('当前角色没有编辑日常事项权限。');
      return;
    }

    if (!editingTask) {
      return;
    }

    const values = await editForm.validateFields();
    updateMutation.mutate({ id: editingTask.id, payload: mapTaskPayload(values) });
  };

  const handleToggleReport = (item: DailyTask) => {
    if (!canUpdateDailyTask) {
      messageApi.warning('当前角色没有更新日常事项权限。');
      return;
    }

    updateMutation.mutate({
      id: item.id,
      payload: {
        title: item.title,
        ownerName: item.ownerName,
        status: item.status,
        dueAt: item.dueAt,
        excludeFromReport: !item.excludeFromReport,
      },
    });
  };

  const handleMarkDone = (item: DailyTask) => {
    if (!canUpdateDailyTask) {
      messageApi.warning('当前角色没有更新日常事项权限。');
      return;
    }

    updateMutation.mutate({
      id: item.id,
      payload: {
        title: item.title,
        ownerName: item.ownerName,
        status: 'Done',
        dueAt: item.dueAt,
        excludeFromReport: item.excludeFromReport,
      },
    });
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="日常事项"
        description="管理需要进入日报和周报的日常事项，并快速决定哪些内容要纳入汇报。"
        extra={
          canCreateDailyTask ? (
            <Button type="primary" onClick={openCreateModal}>
              新建日常事项
            </Button>
          ) : null
        }
      />
      <Alert
        type="info"
        showIcon
        message={`已纳入日报：${summary.included} | 已排除：${summary.excluded} | 已完成：${summary.done}`}
        description="这里的改动会直接影响下一次生成的日报草稿。"
      />
      <Card title="日常事项列表">
        <Table
          rowKey="id"
          columns={columns(openEditModal, handleToggleReport, handleMarkDone, canUpdateDailyTask)}
          dataSource={tasksQuery.data ?? []}
          loading={tasksQuery.isLoading}
          pagination={false}
          scroll={{ x: 1080 }}
        />
      </Card>

      <Modal
        title="新建日常事项"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        confirmLoading={createMutation.isPending}
      >
        <DailyTaskForm form={createForm} />
      </Modal>

      <Modal
        title="编辑日常事项"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdate}
        okText="保存"
        confirmLoading={updateMutation.isPending}
      >
        <DailyTaskForm form={editForm} />
      </Modal>
    </Space>
  );
}

function DailyTaskForm({ form }: { form: ReturnType<typeof Form.useForm<DailyTaskFormValues>>[0] }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="事项名称" name="title" rules={[{ required: true, message: '请输入事项名称' }]}>
        <Input placeholder="例如：整理项目周会纪要" />
      </Form.Item>
      <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]}>
        <Input placeholder="例如：王军" />
      </Form.Item>
      <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
        <Select
          options={[
            { label: '未开始', value: 'NotStarted' },
            { label: '进行中', value: 'InProgress' },
            { label: '阻塞', value: 'Blocked' },
            { label: '完成', value: 'Done' },
          ]}
        />
      </Form.Item>
      <Form.Item label="截止日期" name="dueAt" rules={[{ required: true, message: '请选择截止日期' }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="排除出日报" name="excludeFromReport" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}

function mapTaskPayload(values: DailyTaskFormValues): CreateDailyTaskPayload {
  return {
    title: values.title.trim(),
    ownerName: values.ownerName.trim(),
    status: values.status,
    dueAt: values.dueAt.format('YYYY-MM-DD'),
    excludeFromReport: values.excludeFromReport,
  };
}
