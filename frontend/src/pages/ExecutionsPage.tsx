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
  { title: 'Execution', dataIndex: 'name' },
  { title: 'Project', dataIndex: 'projectName', width: 200 },
  { title: 'Owner', dataIndex: 'ownerName', width: 120 },
  { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
  { title: 'Plan window', render: (_, record) => `${record.planStart} ~ ${record.planEnd}`, width: 220 },
  {
    title: 'Actual progress',
    dataIndex: 'actualProgress',
    width: 180,
    render: (value: number) => <Progress percent={value} size="small" />,
  },
  {
    title: 'Plan progress',
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
      messageApi.success('Execution created.');
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
      messageApi.success('Execution updated.');
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
      messageApi.success('Child task created.');
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
      messageApi.success('Child task updated.');
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
      messageApi.success('Worklog added.');
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
      messageApi.success('Worklog updated.');
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
      messageApi.warning('Your current role cannot create executions.');
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
      messageApi.warning('Your current role cannot edit executions.');
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
      messageApi.warning('Your current role cannot manage child tasks.');
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
      messageApi.warning('Your current role cannot manage child tasks.');
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
      messageApi.warning('Your current role cannot add worklogs.');
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
      messageApi.warning('Your current role cannot edit worklogs.');
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
      messageApi.warning('Your current role cannot create executions.');
      return;
    }

    const values = await createForm.validateFields();
    const project = projectsQuery.data?.find((item) => item.id === values.projectId);

    if (!project) {
      messageApi.error('Target project was not found.');
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
      messageApi.warning('Your current role cannot edit executions.');
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
      messageApi.warning('Your current role cannot manage child tasks.');
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
      messageApi.warning('Your current role cannot manage child tasks.');
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
      messageApi.warning('Your current role cannot add worklogs.');
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
      messageApi.warning('Your current role cannot edit worklogs.');
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
        title="Executions"
        description="This page now supports creation, editing, task breakdown and worklog capture for weekly reporting."
        extra={
          canManageExecutions ? (
            <Button type="primary" onClick={openCreateModal}>
              Create execution
            </Button>
          ) : null
        }
      />
      <Card title="Execution list">
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
        title={detailQuery.data?.name ?? 'Execution detail'}
        width={760}
        open={selectedExecutionId !== null}
        onClose={() => setSelectedExecutionId(null)}
        extra={
          detailQuery.data ? (
            <Space>
              {canManageExecutions ? <Button onClick={openEditModal}>Edit execution</Button> : null}
              {canManageTasks ? <Button onClick={openTaskModal}>Create child task</Button> : null}
              {canCreateWorklogs ? <Button onClick={openWorklogModal}>Add worklog</Button> : null}
              <StatusTag value={detailQuery.data.status} />
            </Space>
          ) : null
        }
      >
        {detailQuery.isLoading ? (
          <Card loading />
        ) : detailQuery.isError ? (
          <Alert type="error" showIcon message="Execution detail request failed" description={formatApiError(detailQuery.error)} />
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
          <Empty description="Execution detail not found" />
        )}
      </Drawer>

      <Modal title="Create execution" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreateExecution} okText="Create" confirmLoading={createMutation.isPending}>
        <CreateExecutionForm form={createForm} projects={projectsQuery.data ?? []} />
      </Modal>

      <Modal title="Edit execution" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={handleUpdateExecution} okText="Save" confirmLoading={updateMutation.isPending}>
        <EditExecutionForm form={editForm} />
      </Modal>

      <Modal title="Create child task" open={taskModalOpen} onCancel={() => setTaskModalOpen(false)} onOk={handleCreateTask} okText="Create" confirmLoading={createTaskMutation.isPending}>
        <TaskForm form={taskForm} />
      </Modal>

      <Modal title="Edit child task" open={editTaskModalOpen} onCancel={() => setEditTaskModalOpen(false)} onOk={handleUpdateTask} okText="Save" confirmLoading={updateTaskMutation.isPending}>
        <TaskForm form={editTaskForm} />
      </Modal>

      <Modal title="Add worklog" open={worklogModalOpen} onCancel={() => setWorklogModalOpen(false)} onOk={handleCreateWorklog} okText="Create" confirmLoading={createWorklogMutation.isPending}>
        <WorklogForm form={worklogForm} />
      </Modal>

      <Modal title="Edit worklog" open={editWorklogModalOpen} onCancel={() => setEditWorklogModalOpen(false)} onOk={handleUpdateWorklog} okText="Save" confirmLoading={updateWorklogMutation.isPending}>
        <WorklogForm form={editWorklogForm} />
      </Modal>
    </Space>
  );
}

function CreateExecutionForm({ form, projects }: { form: FormInstance<CreateExecutionFormValues>; projects: Project[] }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Execution name" name="name" rules={[{ required: true, message: 'Enter an execution name' }]}>
        <Input placeholder="Example: Implement requirement pool base APIs" />
      </Form.Item>
      <Form.Item label="Project" name="projectId" rules={[{ required: true, message: 'Select a project' }]}>
        <Select options={projects.map((item) => ({ label: `${item.name} (${item.code})`, value: item.id }))} />
      </Form.Item>
      <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]}>
        <Input placeholder="Example: Wang Jun" />
      </Form.Item>
      <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
        <Select options={[{ value: 'NotStarted' }, { value: 'InProgress' }, { value: 'Blocked' }, { value: 'ToVerify' }]} />
      </Form.Item>
      <Form.Item label="Plan range" name="planRange" rules={[{ required: true, message: 'Select a plan range' }]}>
        <RangePicker style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
}

function EditExecutionForm({ form }: { form: FormInstance<EditExecutionFormValues> }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Execution name" name="name" rules={[{ required: true, message: 'Enter an execution name' }]}>
        <Input placeholder="Example: Implement requirement pool base APIs" />
      </Form.Item>
      <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]}>
        <Input placeholder="Example: Wang Jun" />
      </Form.Item>
      <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
        <Select options={[{ value: 'NotStarted' }, { value: 'InProgress' }, { value: 'Blocked' }, { value: 'ToVerify' }, { value: 'Done' }, { value: 'Closed' }]} />
      </Form.Item>
      <Form.Item label="Plan range" name="planRange" rules={[{ required: true, message: 'Select a plan range' }]}>
        <RangePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Actual progress" name="actualProgress" rules={[{ required: true, message: 'Enter actual progress' }]}>
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Plan progress" name="planProgress" rules={[{ required: true, message: 'Enter plan progress' }]}>
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
}

function TaskForm({ form }: { form: FormInstance<TaskFormValues> }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Task name" name="name" rules={[{ required: true, message: 'Enter a child task name' }]}>
        <Input placeholder="Example: Implement API error handling" />
      </Form.Item>
      <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]}>
        <Input placeholder="Example: Wang Jun" />
      </Form.Item>
      <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
        <Select options={[{ value: 'NotStarted' }, { value: 'InProgress' }, { value: 'Blocked' }, { value: 'Done' }]} />
      </Form.Item>
      <Form.Item label="Actual progress" name="actualProgress" rules={[{ required: true, message: 'Enter progress' }]}>
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
}

function WorklogForm({ form }: { form: FormInstance<WorklogFormValues> }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]}>
        <Input placeholder="Example: Wang Jun" />
      </Form.Item>
      <Form.Item label="Work date" name="workDate" rules={[{ required: true, message: 'Select a work date' }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Hours" name="hours" rules={[{ required: true, message: 'Enter hours worked' }]}>
        <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Summary" name="summary" rules={[{ required: true, message: 'Describe the work completed' }]}>
        <Input.TextArea rows={4} placeholder="Summarize what was done during this worklog entry." />
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
          { key: 'project', label: 'Project', children: detail.projectName },
          { key: 'owner', label: 'Owner', children: detail.ownerName },
          { key: 'status', label: 'Status', children: <StatusTag value={detail.status} /> },
          { key: 'window', label: 'Plan window', children: `${detail.planStart} ~ ${detail.planEnd}` },
          { key: 'actual', label: 'Actual progress', children: `${detail.actualProgress}%` },
          { key: 'plan', label: 'Plan progress', children: `${detail.planProgress}%` },
        ]}
      />

      <Card title="Progress snapshot">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text type="secondary">Actual progress</Typography.Text>
            <Progress percent={detail.actualProgress} />
          </div>
          <div>
            <Typography.Text type="secondary">Plan progress</Typography.Text>
            <Progress percent={detail.planProgress} status="active" />
          </div>
        </Space>
      </Card>

      <Card title="Linked requirements">
        {detail.requirementIds.length > 0 ? (
          <List dataSource={detail.requirementIds} renderItem={(item) => <List.Item>Requirement #{item}</List.Item>} />
        ) : (
          <Empty description="No linked requirements" />
        )}
      </Card>

      <Card title="Child tasks">
        <List
          loading={tasksLoading}
          dataSource={tasks}
          locale={{ emptyText: 'No child tasks yet' }}
          renderItem={(task) => (
            <List.Item
              extra={
                <Space>
                  {canEditTasks ? (
                    <Button size="small" onClick={() => onEditTask(task)}>
                      Edit
                    </Button>
                  ) : null}
                  <StatusTag value={task.status} />
                </Space>
              }
            >
              <List.Item.Meta title={task.name} description={`${task.ownerName} | Progress ${task.actualProgress}%`} />
            </List.Item>
          )}
        />
      </Card>

      {canViewWorklogs ? (
        <Card title="Worklogs" extra={<Typography.Text type="secondary">Total logged: {worklogHours.toFixed(1)}h</Typography.Text>}>
          <List
            loading={worklogsLoading}
            dataSource={worklogs}
            locale={{ emptyText: 'No worklogs yet' }}
            renderItem={(item) => (
              <List.Item
                extra={
                  canEditWorklogs ? (
                    <Button size="small" onClick={() => onEditWorklog(item)}>
                      Edit
                    </Button>
                  ) : null
                }
              >
                <List.Item.Meta
                  title={`${item.workDate} | ${item.ownerName} | ${item.hours.toFixed(1)}h`}
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