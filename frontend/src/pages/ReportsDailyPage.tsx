import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, List, Space, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';

export function ReportsDailyPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canGenerateDailyReport = permissions.includes('report.daily.generate.self');
  const canViewDailyTasks = permissions.includes('daily_task.view.self');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const reportQuery = useQuery({ queryKey: ['daily-report'], queryFn: pmApi.generateDailyReport });
  const dailyTasksQuery = useQuery({
    queryKey: ['daily-tasks'],
    queryFn: pmApi.getDailyTasks,
    enabled: canViewDailyTasks,
  });
  const regenerateMutation = useMutation({
    mutationFn: pmApi.generateDailyReport,
    onSuccess: (draft) => {
      queryClient.setQueryData(['daily-report'], draft);
      messageApi.success('日报草稿已重新生成。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });
  const draft = reportQuery.data;
  const includedTasks = useMemo(
    () => (dailyTasksQuery.data ?? []).filter((item) => !item.excludeFromReport),
    [dailyTasksQuery.data],
  );
  const excludedCount = useMemo(
    () => (dailyTasksQuery.data ?? []).filter((item) => item.excludeFromReport).length,
    [dailyTasksQuery.data],
  );

  const handleRegenerate = () => {
    if (!canGenerateDailyReport) {
      messageApi.warning('当前角色没有重新生成日报的权限。');
      return;
    }

    regenerateMutation.mutate();
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="日报"
        description="根据执行进展和日常事项生成日报草稿，同时保留人工补充空间。"
        extra={
          <Space>
            {canViewDailyTasks ? <Button onClick={() => navigate('/daily-tasks')}>管理日常事项</Button> : null}
            {canGenerateDailyReport ? (
              <Button type="primary" onClick={handleRegenerate} loading={regenerateMutation.isPending}>
                重新生成
              </Button>
            ) : null}
          </Space>
        }
      />
      <Card loading={reportQuery.isLoading}>
        <Typography.Text type="secondary">生成时间：{draft?.generatedAt ?? '-'}</Typography.Text>
      </Card>
      <Card title="已完成" loading={reportQuery.isLoading}>
        <List dataSource={draft?.completed ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="进行中" loading={reportQuery.isLoading}>
        <List dataSource={draft?.inProgress ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="风险项" loading={reportQuery.isLoading}>
        <Space wrap>
          {(draft?.risks ?? []).map((risk) => (
            <Tag key={risk} color="error">
              {risk}
            </Tag>
          ))}
        </Space>
      </Card>
      <Card title="下一步计划" loading={reportQuery.isLoading}>
        <List dataSource={draft?.nextSteps ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      {canViewDailyTasks ? (
        <Card
          title="纳入本次日报的日常事项"
          extra={<Typography.Text type="secondary">已排除：{excludedCount}</Typography.Text>}
          loading={dailyTasksQuery.isLoading}
        >
          <List
            dataSource={includedTasks}
            locale={{ emptyText: '当前没有纳入日报的日常事项。' }}
            renderItem={(item) => (
              <List.Item extra={<StatusTag value={item.status} />}>
                <List.Item.Meta title={item.title} description={`${item.ownerName} | 截止 ${item.dueAt}`} />
              </List.Item>
            )}
          />
        </Card>
      ) : null}
    </Space>
  );
}
