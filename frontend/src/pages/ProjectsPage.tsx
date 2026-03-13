import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';
import type { CreateProjectPayload, Project } from '../services/types';

const columns: ColumnsType<Project> = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '项目名称', dataIndex: 'name' },
  { title: '项目编码', dataIndex: 'code', width: 120 },
  { title: '负责人', dataIndex: 'ownerName', width: 120 },
  { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
  { title: '执行数', dataIndex: 'executionCount', width: 100 },
  { title: '风险数', dataIndex: 'riskCount', width: 100 },
];

export function ProjectsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const currentUserName = useAuthStore((state) => state.user?.name ?? 'Wang Jun');
  const navigate = useNavigate();
  const canCreateProject = permissions.includes('project.create.org');
  const canViewSchedule = permissions.includes('schedule.view.related');
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
      messageApi.success('项目已创建。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });

  const openCreateModal = () => {
    if (!canCreateProject) {
      messageApi.warning('当前角色没有创建项目的权限。');
      return;
    }

    form.setFieldsValue({ status: 'Active', ownerName: currentUserName });
    setCreateModalOpen(true);
  };

  const handleCreateProject = async () => {
    if (!canCreateProject) {
      messageApi.warning('当前角色没有创建项目的权限。');
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
        title="项目"
        description="用于查看项目健康度、交付规模和项目级排期。"
        extra={
          <Space>
            {canViewSchedule ? (
              <Button onClick={() => navigate('/gantt?view=project')}>项目甘特图</Button>
            ) : null}
            {canCreateProject ? (
              <Button type="primary" onClick={openCreateModal}>
                新建项目
              </Button>
            ) : null}
          </Space>
        }
      />
      <Card title="项目列表">
        <Table rowKey="id" columns={columns} dataSource={query.data ?? []} loading={query.isLoading} pagination={false} />
      </Card>
      <Modal
        title="新建项目"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateProject}
        okText="创建"
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="项目名称" name="name" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：团队项目管理平台 V1" />
          </Form.Item>
          <Form.Item label="项目编码" name="code" rules={[{ required: true, message: '请输入项目编码' }]}>
            <Input placeholder="例如：PM-V1" />
          </Form.Item>
          <Form.Item label="负责人" name="ownerName" rules={[{ required: true, message: '请输入负责人' }]}>
            <Input placeholder="例如：王军" />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { label: '进行中', value: 'Active' },
                { label: '风险', value: 'Risk' },
                { label: '完成', value: 'Done' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
