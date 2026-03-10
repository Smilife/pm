import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import { DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';
import type {
  CreateExecutionPayload,
  CreateExecutionTaskPayload,
  CreateWorklogPayload,
  Execution,
  ExecutionDetail,
  ExecutionTask,
  Project,
  UpdateExecutionPayload,
  UpdateExecutionTaskPayload,
  UpdateWorklogPayload,
  Worklog,
} from '../services/types';

const { RangePicker } = DatePicker;

const executionStatusOptions = [
  { label: '未开始', value: 'NotStarted' },
  { label: '进行中', value: 'InProgress' },
  { label: '阻塞', value: 'Blocked' },
  { label: '待验证', value: 'ToVerify' },
  { label: '完成', value: 'Done' },
  { label: '关闭', value: 'Closed' },
];

const taskStatusOptions = [
  { label: '未开始', value: 'NotStarted' },
  { label: '进行中', value: 'InProgress' },
  { label: '阻塞', value: 'Blocked' },
  { label: '完成', value: 'Done' },
];

type CreateExecutionFormValues = {
  name: string;
  projectId: number;
  ownerName: string;
  status: ExecutionDetail['status'];
  planRange: [dayjs.Dayjs, dayjs.Dayjs];
};

type EditExecutionFormValues = {
  name: string;
  ownerName: string;
  status: ExecutionDetail['status'];
  planRange: [dayjs.Dayjs, dayjs.Dayjs];
  actualProgress: number;
  planProgress: number;
};

type TaskFormValues = {
  name: string;
  ownerName: string;
  status: ExecutionTask['status'];
  actualProgress: number;
};

type WorklogFormValues = {
  ownerName: string;
  workDate: dayjs.Dayjs;
  hours: number;
  summary: string;
};

const columns: ColumnsType<Execution> = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '执行名称', dataIndex: 'name' },
  { title: '所属项目', dataIndex: 'projectName', width: 200 },
  { title: '负责人', dataIndex: 'ownerName', width: 120 },
  { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
  { title: '计划时间', render: (_, record) => `${record.planStart} ~ ${record.planEnd}`, width: 220 },
  {
    title: '实际进度',
    dataIndex: 'actualProgress',
    width: 180,
    render: (value: number) => <Progress percent={value} size="small" />,
  },
  {
    title: '计划进度',
    dataIndex: 'planProgress',
    width: 180,
    render: (value: number) => <Progress percent={value} size="small" status="active" />,
  },
];

export function ExecutionsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? 'Wang Jun');
  const canManageExecutions = permissions.includes('execution.create.project');
  const canManageTasks = permissions.includes('execution.task.update.related');
  const canViewWorklogs = permissions.includes('worklog.view.related');
  const canCreateWorklogs = permissions.includes('worklog.create.self');
  const canEditWorklogs = permissions.includes('worklog.update.self');
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [worklogModalOpen, setWorklogModalOpen] = useState(false);
  const [editWorklogModalOpen, setEditWorklogModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ExecutionTask | null>(null);
  const [editingWorklog, setEditingWorklog] = useState<Worklog | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<CreateExecutionFormValues>();
  const [editForm] = Form.useForm<EditExecutionFormValues>();
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [editTaskForm] = Form.useForm<TaskFormValues>();
  const [worklogForm] = Form.useForm<WorklogFormValues>();
  const [editWorklogForm] = Form.useForm<WorklogFormValues>();
  const queryClient = useQueryClient();

  const executionsQuery = useQuery({ queryKey: ['executions'], queryFn: pmApi.getExecutions });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: pmApi.getProjects });
  const detailQuery = useQuery({
    queryKey: ['execution-detail', selectedExecutionId],
    queryFn: async () => {
      if (selectedExecutionId === null) {
        return null;
      }
      return pmApi.getExecutionDetail(selectedExecutionId);
    },
    enabled: selectedExecutionId !== null,
  });
  const tasksQuery = useQuery({
    queryKey: ['execution-tasks', selectedExecutionId],
    queryFn: async () => {
      if (selectedExecutionId === null) {
        return [];
      }
      return pmApi.getExecutionTasks(selectedExecutionId);
    },
    enabled: selectedExecutionId !== null,
  });
  const worklogsQuery = useQuery({
    queryKey: ['execution-worklogs', selectedExecutionId],
    queryFn: async () => {
      if (selectedExecutionId === null) {
        return [];
      }
      return pmApi.getExecutionWorklogs(selectedExecutionId);
    },
    enabled: selectedExecutionId !== null && canViewWorklogs,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateExecutionPayload) => pmApi.createExecution(payload),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['executions'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-report'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-team'] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-report'] }),
      ]);
      setCreateModalOpen(false);
      createForm.resetFields();
      setSelectedExecutionId(created.id);
      messageApi.success('执行已创建。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateExecutionPayload }) => pmApi.updateExecution(id, payload),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['executions'] }),
        queryClient.invalidateQueries({ queryKey: ['execution-detail', updated.id] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-report'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-team'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-execution'] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-report'] }),
      ]);
      setEditModalOpen(false);
      messageApi.success('执行已更新。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: CreateExecutionTaskPayload) => pmApi.createExecutionTask(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['execution-tasks', selectedExecutionId] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-execution'] }),
      ]);
      setTaskModalOpen(false);
      taskForm.resetFields();
      messageApi.success('子任务已创建。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateExecutionTaskPayload }) => pmApi.updateExecutionTask(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['execution-tasks', selectedExecutionId] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-execution'] }),
      ]);
      setEditTaskModalOpen(false);
      setEditingTask(null);
      editTaskForm.resetFields();
      messageApi.success('子任务已更新。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const createWorklogMutation = useMutation({
    mutationFn: (payload: CreateWorklogPayload) => pmApi.createWorklog(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['execution-worklogs', selectedExecutionId] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-report'] }),
      ]);
      setWorklogModalOpen(false);
      worklogForm.resetFields();
      messageApi.success('工作日志已新增。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const updateWorklogMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateWorklogPayload }) => pmApi.updateWorklog(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['execution-worklogs', selectedExecutionId] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-report'] }),
      ]);
      setEditWorklogModalOpen(false);
      setEditingWorklog(null);
      editWorklogForm.resetFields();
      messageApi.success('工作日志已更新。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const worklogHours = useMemo(
    () => (worklogsQuery.data ?? []).reduce((sum, item) => sum + item.hours, 0),
    [worklogsQuery.data],
  );

  const openCreateModal = () => {
    if (!canManageExecutions) {
      messageApi.warning('当前角色没有创建执行的权限。');
      return;
    }

    const defaultProject = projectsQuery.data?.[0];
    createForm.setFieldsValue({
      projectId: defaultProject?.id,
      ownerName: currentUserName,
      status: 'NotStarted',
      planRange: [dayjs(), dayjs().add(7, 'day')],
    });
    setCreateModalOpen(true);
  };

  const openEditModal = () => {
    if (!canManageExecutions) {
      messageApi.warning('当前角色没有编辑执行的权限。');
      return;
    }

    const detail = detailQuery.data;
    if (!detail) {
      return;
    }

    editForm.setFieldsValue({
      name: detail.name,
      ownerName: detail.ownerName,
      status: detail.status,
      planRange: [dayjs(detail.planStart), dayjs(detail.planEnd)],
      actualProgress: detail.actualProgress,
      planProgress: detail.planProgress,
    });
    setEditModalOpen(true);
  };

  const openTaskModal = () => {
    if (!canManageTasks) {
      messageApi.warning('当前角色没有管理子任务的权限。');
      return;
    }

    const detail = detailQuery.data;
    taskForm.setFieldsValue({
      ownerName: detail?.ownerName ?? currentUserName,
      status: 'NotStarted',
      actualProgress: 0,
    });
    setTaskModalOpen(true);
  };

  const openEditTaskModal = (task: ExecutionTask) => {
    if (!canManageTasks) {
      messageApi.warning('当前角色没有管理子任务的权限。');
      return;
    }

    setEditingTask(task);
    editTaskForm.setFieldsValue({
      name: task.name,
      ownerName: task.ownerName,
      status: task.status,
      actualProgress: task.actualProgress,
    });
    setEditTaskModalOpen(true);
  };

  const openWorklogModal = () => {
    if (!canCreateWorklogs) {
      messageApi.warning('当前角色没有新增工作日志的权限。');
      return;
    }

    worklogForm.setFieldsValue({
      ownerName: currentUserName,
      workDate: dayjs(),
      hours: 1,
    });
    setWorklogModalOpen(true);
  };

  const openEditWorklogModal = (item: Worklog) => {
    if (!canEditWorklogs) {
      messageApi.warning('当前角色没有编辑工作日志的权限。');
      return;
    }

    setEditingWorklog(item);
    editWorklogForm.setFieldsValue({
      ownerName: item.ownerName,
      workDate: dayjs(item.workDate),
      hours: item.hours,
      summary: item.summary,
    });
    setEditWorklogModalOpen(true);
  };

  const handleCreateExecution = async () => {
    if (!canManageExecutions) {
      messageApi.warning('当前角色没有创建执行的权限。');
      return;
    }

    const values = await createForm.validateFields();
    const project = projectsQuery.data?.find((item) => item.id === values.projectId);

    if (!project) {
      messageApi.error('未找到目标项目。');
      return;
    }

    createMutation.mutate({
      name: values.name.trim(),
      projectId: project.id,
      projectName: project.name,
      ownerName: values.ownerName.trim(),
      status: values.status,
      planStart: values.planRange[0].format('YYYY-MM-DD'),
      planEnd: values.planRange[1].format('YYYY-MM-DD'),
    });
  };

  const handleUpdateExecution = async () => {
    if (!canManageExecutions) {
      messageApi.warning('当前角色没有编辑执行的权限。');
      return;
    }

    if (selectedExecutionId === null) {
      return;
    }

    const values = await editForm.validateFields();
    updateMutation.mutate({
      id: selectedExecutionId,
      payload: {
        name: values.name.trim(),
        ownerName: values.ownerName.trim(),
        status: values.status,
        planStart: values.planRange[0].format('YYYY-MM-DD'),
        planEnd: values.planRange[1].format('YYYY-MM-DD'),
        actualProgress: values.actualProgress,
        planProgress: values.planProgress,
      },
    });
  };

  const handleCreateTask = async () => {
    if (!canManageTasks) {
      messageApi.warning('当前角色没有管理子任务的权限。');
      return;
    }

    if (selectedExecutionId === null) {
      return;
    }

    const values = await taskForm.validateFields();
    createTaskMutation.mutate({
      executionId: selectedExecutionId,
      name: values.name.trim(),
      ownerName: values.ownerName.trim(),
      status: values.status,
      actualProgress: values.actualProgress,
    });
  };

  const handleUpdateTask = async () => {
    if (!canManageTasks) {
      messageApi.warning('当前角色没有管理子任务的权限。');
      return;
    }

    if (!editingTask) {
      return;
    }

    const values = await editTaskForm.validateFields();
    updateTaskMutation.mutate({
      id: editingTask.id,
      payload: {
        name: values.name.trim(),
        ownerName: values.ownerName.trim(),
        status: values.status,
        actualProgress: values.actualProgress,
      },
    });
  };

  const handleCreateWorklog = async () => {
    if (!canCreateWorklogs) {
      messageApi.warning('当前角色没有新增工作日志的权限。');
      return;
    }

    if (selectedExecutionId === null) {
      return;
    }

    const values = await worklogForm.validateFields();
    createWorklogMutation.mutate({
      executionId: selectedExecutionId,
      ownerName: values.ownerName.trim(),
      workDate: values.workDate.format('YYYY-MM-DD'),
      hours: values.hours,
      summary: values.summary.trim(),
    });
  };

  const handleUpdateWorklog = async () => {
    if (!canEditWorklogs) {
      messageApi.warning('当前角色没有编辑工作日志的权限。');
      return;
    }

    if (!editingWorklog) {
      return;
    }

    const values = await editWorklogForm.validateFields();
    updateWorklogMutation.mutate({
      id: editingWorklog.id,
      payload: {
        executionId: editingWorklog.executionId,
        ownerName: values.ownerName.trim(),
        workDate: values.workDate.format('YYYY-MM-DD'),
        hours: values.hours,
        summary: values.summary.trim(),
      },
    });
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="执行"
        description="支持执行创建、编辑、子任务拆解和工时记录，数据会联动周报。"
        extra={
          canManageExecutions ? (
            <Button type="primary" onClick={openCreateModal}>
              新建执行
            </Button>
          ) : null
        }
      />
      <Card title="执行列表">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={executionsQuery.data ?? []}
          loading={executionsQuery.isLoading}
          pagination={false}
          scroll={{ x: 1080 }}
          onRow={(record) => ({
            onClick: () => setSelectedExecutionId(record.id),
          })}
        />
      </Card>

      <Drawer
        title={detailQuery.data?.name ?? '执行详情'}
        width={760}
        open={selectedExecutionId !== null}
        onClose={() => setSelectedExecutionId(null)}
        extra={
          detailQuery.data ? (
            <Space>
              {canManageExecutions ? <Button onClick={openEditModal}>编辑执行</Button> : null}
              {canManageTasks ? <Button onClick={openTaskModal}>新建子任务</Button> : null}
              {canCreateWorklogs ? <Button onClick={openWorklogModal}>新增工作日志</Button> : null}
              <StatusTag value={detailQuery.data.status} />
            </Space>
          ) : null
        }
      >
        {detailQuery.isLoading ? (
          <Card loading />
        ) : detailQuery.isError ? (
          <Alert type="error" showIcon message="获取执行详情失败" description={formatApiError(detailQuery.error)} />
        ) : detailQuery.data ? (
          <ExecutionDetailContent
            detail={detailQuery.data}
            tasks={tasksQuery.data ?? []}
            tasksLoading={tasksQuery.isLoading}
            onEditTask={openEditTaskModal}
            canEditTasks={canManageTasks}
            worklogs={canViewWorklogs ? worklogsQuery.data ?? [] : []}
            worklogsLoading={canViewWorklogs ? worklogsQuery.isLoading : false}
            worklogHours={worklogHours}
            onEditWorklog={openEditWorklogModal}
            canViewWorklogs={canViewWorklogs}
            canEditWorklogs={canEditWorklogs}
          />
        ) : (
          <Empty description="未找到执行详情" />
        )}
      </Drawer>

      <Modal title="新建执行" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreateExecution} okText="创建" confirmLoading={createMutation.isPending}>
        <CreateExecutionForm form={createForm} projects={projectsQuery.data ?? []} />
      </Modal>

      <Modal title="编辑执行" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={handleUpdateExecution} okText="保存" confirmLoading={updateMutation.isPending}>
        <EditExecutionForm form={editForm} />
      </Modal>

      <Modal title="新建子任务" open={taskModalOpen} onCancel={() => setTaskModalOpen(false)} onOk={handleCreateTask} okText="创建" confirmLoading={createTaskMutation.isPending}>
        <TaskForm form={taskForm} />
      </Modal>

      <Modal title="编辑子任务" open={editTaskModalOpen} onCancel={() => setEditTaskModalOpen(false)} onOk={handleUpdateTask} okText="保存" confirmLoading={updateTaskMutation.isPending}>
        <TaskForm form={editTaskForm} />
      </Modal>

      <Modal title="新增工作日志" open={worklogModalOpen} onCancel={() => setWorklogModalOpen(false)} onOk={handleCreateWorklog} okText="创建" confirmLoading={createWorklogMutation.isPending}>
        <WorklogForm form={worklogForm} />
      </Modal>

      <Modal title="编辑工作日志" open={editWorklogModalOpen} onCancel={() => setEditWorklogModalOpen(false)} onOk={handleUpdateWorklog} okText="保存" confirmLoading={updateWorklogMutation.isPending}>
        <WorklogForm form={editWorklogForm} />
      </Modal>
    </Space>
  );
}

function CreateExecutionForm({ form, projects }: { form: FormInstance<CreateExecutionFormValues>; projects: Project[] }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="执行名称" name="name" rules={[{ required: true, message: '请输入执行名称' }]}>
        <Input placeholder="例如：实现需求池基础接口" />
      </Form.Item>
      <Form.Item label="所属项目" name="projectId" rules={[{ required: true, message: '请选择项目' }]}>
        <Select options={projects.map((item) => ({ label: `${item.name} (${item.code})`, value: item.id }))} />
      </Form.Item>
      <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]}>
        <Input placeholder="例如：王军" />
      </Form.Item>
      <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
        <Select options={executionStatusOptions.filter((item) => item.value !== 'Done' && item.value !== 'Closed')} />
      </Form.Item>
      <Form.Item label="计划时间" name="planRange" rules={[{ required: true, message: '请选择计划时间范围' }]}>
        <RangePicker style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
}

function EditExecutionForm({ form }: { form: FormInstance<EditExecutionFormValues> }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="执行名称" name="name" rules={[{ required: true, message: '请输入执行名称' }]}>
        <Input placeholder="例如：实现需求池基础接口" />
      </Form.Item>
      <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]}>
        <Input placeholder="例如：王军" />
      </Form.Item>
      <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
        <Select options={executionStatusOptions} />
      </Form.Item>
      <Form.Item label="计划时间" name="planRange" rules={[{ required: true, message: '请选择计划时间范围' }]}>
        <RangePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="实际进度" name="actualProgress" rules={[{ required: true, message: '请输入实际进度' }]}>
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="计划进度" name="planProgress" rules={[{ required: true, message: '请输入计划进度' }]}>
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
}

function TaskForm({ form }: { form: FormInstance<TaskFormValues> }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="子任务名称" name="name" rules={[{ required: true, message: '请输入子任务名称' }]}>
        <Input placeholder="例如：补齐 API 异常处理" />
      </Form.Item>
      <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]}>
        <Input placeholder="例如：王军" />
      </Form.Item>
      <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
        <Select options={taskStatusOptions} />
      </Form.Item>
      <Form.Item label="实际进度" name="actualProgress" rules={[{ required: true, message: '请输入进度' }]}>
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
}

function WorklogForm({ form }: { form: FormInstance<WorklogFormValues> }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]}>
        <Input placeholder="例如：王军" />
      </Form.Item>
      <Form.Item label="工作日期" name="workDate" rules={[{ required: true, message: '请选择工作日期' }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="工时" name="hours" rules={[{ required: true, message: '请输入工时' }]}>
        <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="工作摘要" name="summary" rules={[{ required: true, message: '请填写工作摘要' }]}>
        <Input.TextArea rows={4} placeholder="总结这次日志记录中完成的工作。" />
      </Form.Item>
    </Form>
  );
}

function ExecutionDetailContent({
  detail,
  tasks,
  tasksLoading,
  onEditTask,
  canEditTasks,
  worklogs,
  worklogsLoading,
  worklogHours,
  onEditWorklog,
  canViewWorklogs,
  canEditWorklogs,
}: {
  detail: ExecutionDetail;
  tasks: ExecutionTask[];
  tasksLoading: boolean;
  onEditTask: (task: ExecutionTask) => void;
  canEditTasks: boolean;
  worklogs: Worklog[];
  worklogsLoading: boolean;
  worklogHours: number;
  onEditWorklog: (worklog: Worklog) => void;
  canViewWorklogs: boolean;
  canEditWorklogs: boolean;
}) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions
        size="small"
        column={2}
        items={[
          { key: 'project', label: '所属项目', children: detail.projectName },
          { key: 'owner', label: '负责人', children: detail.ownerName },
          { key: 'status', label: '状态', children: <StatusTag value={detail.status} /> },
          { key: 'window', label: '计划时间', children: `${detail.planStart} ~ ${detail.planEnd}` },
          { key: 'actual', label: '实际进度', children: `${detail.actualProgress}%` },
          { key: 'plan', label: '计划进度', children: `${detail.planProgress}%` },
        ]}
      />

      <Card title="进度快照">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text type="secondary">实际进度</Typography.Text>
            <Progress percent={detail.actualProgress} />
          </div>
          <div>
            <Typography.Text type="secondary">计划进度</Typography.Text>
            <Progress percent={detail.planProgress} status="active" />
          </div>
        </Space>
      </Card>

      <Card title="关联需求">
        {detail.requirementIds.length > 0 ? (
          <List dataSource={detail.requirementIds} renderItem={(item) => <List.Item>{`需求 #${item}`}</List.Item>} />
        ) : (
          <Empty description="暂无关联需求" />
        )}
      </Card>

      <Card title="子任务">
        <List
          loading={tasksLoading}
          dataSource={tasks}
          locale={{ emptyText: '暂无子任务' }}
          renderItem={(task) => (
            <List.Item
              extra={
                <Space>
                  {canEditTasks ? (
                    <Button size="small" onClick={() => onEditTask(task)}>
                      编辑
                    </Button>
                  ) : null}
                  <StatusTag value={task.status} />
                </Space>
              }
            >
              <List.Item.Meta title={task.name} description={`${task.ownerName} | 进度 ${task.actualProgress}%`} />
            </List.Item>
          )}
        />
      </Card>

      {canViewWorklogs ? (
        <Card title="工作日志" extra={<Typography.Text type="secondary">累计工时：{worklogHours.toFixed(1)} 小时</Typography.Text>}>
          <List
            loading={worklogsLoading}
            dataSource={worklogs}
            locale={{ emptyText: '暂无工作日志' }}
            renderItem={(item) => (
              <List.Item
                extra={
                  canEditWorklogs ? (
                    <Button size="small" onClick={() => onEditWorklog(item)}>
                      编辑
                    </Button>
                  ) : null
                }
              >
                <List.Item.Meta
                  title={`${item.workDate} | ${item.ownerName} | ${item.hours.toFixed(1)} 小时`}
                  description={item.summary}
                />
              </List.Item>
            )}
          />
        </Card>
      ) : null}
    </Space>
  );
}
