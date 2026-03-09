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
  { title: 'Title', dataIndex: 'title' },
  { title: 'Owner', dataIndex: 'ownerName', width: 140 },
  { title: 'Status', dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  { title: 'Due date', dataIndex: 'dueAt', width: 140 },
  {
    title: 'Report',
    dataIndex: 'excludeFromReport',
    width: 140,
    render: (value: boolean) => <Tag color={value ? 'default' : 'success'}>{value ? 'Excluded' : 'Included'}</Tag>,
  },
  {
    title: 'Actions',
    width: 260,
    render: (_, record) =>
      canUpdate ? (
        <Space>
          <Button size="small" onClick={() => onEdit(record)}>
            Edit
          </Button>
          <Button size="small" onClick={() => onToggleReport(record)}>
            {record.excludeFromReport ? 'Include' : 'Exclude'}
          </Button>
          <Button size="small" disabled={record.status === 'Done'} onClick={() => onMarkDone(record)}>
            Mark done
          </Button>
        </Space>
      ) : (
        <Typography.Text type="secondary">View only</Typography.Text>
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
      messageApi.success('Daily task created.');
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
      messageApi.success('Daily task updated.');
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
      messageApi.warning('Your current role cannot create daily tasks.');
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
      messageApi.warning('Your current role cannot edit daily tasks.');
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
      messageApi.warning('Your current role cannot create daily tasks.');
      return;
    }

    const values = await createForm.validateFields();
    createMutation.mutate(mapTaskPayload(values));
  };

  const handleUpdate = async () => {
    if (!canUpdateDailyTask) {
      messageApi.warning('Your current role cannot edit daily tasks.');
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
      messageApi.warning('Your current role cannot update daily tasks.');
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
      messageApi.warning('Your current role cannot update daily tasks.');
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
        title="Daily tasks"
        description="Track day-to-day items that should feed report generation, and quickly decide which ones are included in summaries."
        extra={
          canCreateDailyTask ? (
            <Button type="primary" onClick={openCreateModal}>
              Create daily task
            </Button>
          ) : null
        }
      />
      <Alert
        type="info"
        showIcon
        message={`Included in reports: ${summary.included} | Excluded: ${summary.excluded} | Done: ${summary.done}`}
        description="Changes here immediately affect the next generated daily report draft."
      />
      <Card title="Daily task list">
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
        title="Create daily task"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
        confirmLoading={createMutation.isPending}
      >
        <DailyTaskForm form={createForm} />
      </Modal>

      <Modal
        title="Edit daily task"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdate}
        okText="Save"
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
      <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Enter a task title' }]}>
        <Input placeholder="Example: Prepare requirement review notes" />
      </Form.Item>
      <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]}>
        <Input placeholder="Example: Wang Jun" />
      </Form.Item>
      <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
        <Select options={[{ value: 'NotStarted' }, { value: 'InProgress' }, { value: 'Blocked' }, { value: 'Done' }]} />
      </Form.Item>
      <Form.Item label="Due date" name="dueAt" rules={[{ required: true, message: 'Select a due date' }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Exclude from report" name="excludeFromReport" valuePropName="checked">
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