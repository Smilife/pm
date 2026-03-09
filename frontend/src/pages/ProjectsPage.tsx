import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';
import type { CreateProjectPayload, Project } from '../services/types';

const columns: ColumnsType<Project> = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: 'Project', dataIndex: 'name' },
  { title: 'Code', dataIndex: 'code', width: 120 },
  { title: 'Owner', dataIndex: 'ownerName', width: 120 },
  { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
  { title: 'Executions', dataIndex: 'executionCount', width: 100 },
  { title: 'Risks', dataIndex: 'riskCount', width: 100 },
];

export function ProjectsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? 'Wang Jun');
  const canCreateProject = permissions.includes('project.create.org');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CreateProjectPayload>();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['projects'], queryFn: pmApi.getProjects });
  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectPayload) => pmApi.createProject(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateModalOpen(false);
      form.resetFields();
      messageApi.success('Project created.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const openCreateModal = () => {
    if (!canCreateProject) {
      messageApi.warning('Your current role cannot create projects.');
      return;
    }

    form.setFieldsValue({ status: 'Active', ownerName: currentUserName });
    setCreateModalOpen(true);
  };

  const handleCreateProject = async () => {
    if (!canCreateProject) {
      messageApi.warning('Your current role cannot create projects.');
      return;
    }

    const values = await form.validateFields();
    createMutation.mutate({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      ownerName: values.ownerName.trim(),
      status: values.status,
    });
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="Projects"
        description="Keep this page quiet and managerial: health, ownership and overall project signals."
        extra={
          canCreateProject ? (
            <Button type="primary" onClick={openCreateModal}>
              Create project
            </Button>
          ) : null
        }
      />
      <Card title="Project list">
        <Table rowKey="id" columns={columns} dataSource={query.data ?? []} loading={query.isLoading} pagination={false} />
      </Card>
      <Modal
        title="Create project"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateProject}
        okText="Create"
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Project name" name="name" rules={[{ required: true, message: 'Enter a project name' }]}>
            <Input placeholder="Example: Project Management Platform V1" />
          </Form.Item>
          <Form.Item label="Project code" name="code" rules={[{ required: true, message: 'Enter a project code' }]}>
            <Input placeholder="Example: PM-V1" />
          </Form.Item>
          <Form.Item label="Owner" name="ownerName" rules={[{ required: true, message: 'Enter an owner' }]}>
            <Input placeholder="Example: Wang Jun" />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
            <Select options={[{ value: 'Active' }, { value: 'Risk' }, { value: 'Done' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}