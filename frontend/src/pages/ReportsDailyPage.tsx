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
      messageApi.success('Daily report draft regenerated.');
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
      messageApi.warning('Your current role cannot regenerate daily reports.');
      return;
    }

    regenerateMutation.mutate();
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="Daily report"
        description="Build the draft from execution changes and daily tasks, then leave room for human edits."
        extra={
          <Space>
            {canViewDailyTasks ? <Button onClick={() => navigate('/daily-tasks')}>Manage daily tasks</Button> : null}
            {canGenerateDailyReport ? (
              <Button type="primary" onClick={handleRegenerate} loading={regenerateMutation.isPending}>
                Regenerate
              </Button>
            ) : null}
          </Space>
        }
      />
      <Card loading={reportQuery.isLoading}>
        <Typography.Text type="secondary">Generated at: {draft?.generatedAt ?? '-'}</Typography.Text>
      </Card>
      <Card title="Completed" loading={reportQuery.isLoading}>
        <List dataSource={draft?.completed ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="In progress" loading={reportQuery.isLoading}>
        <List dataSource={draft?.inProgress ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="Risks" loading={reportQuery.isLoading}>
        <Space wrap>
          {(draft?.risks ?? []).map((risk) => (
            <Tag key={risk} color="error">
              {risk}
            </Tag>
          ))}
        </Space>
      </Card>
      <Card title="Next steps" loading={reportQuery.isLoading}>
        <List dataSource={draft?.nextSteps ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      {canViewDailyTasks ? (
        <Card
          title="Daily tasks feeding this report"
          extra={<Typography.Text type="secondary">Excluded items: {excludedCount}</Typography.Text>}
          loading={dailyTasksQuery.isLoading}
        >
          <List
            dataSource={includedTasks}
            locale={{ emptyText: 'No included daily tasks right now' }}
            renderItem={(item) => (
              <List.Item extra={<StatusTag value={item.status} />}>
                <List.Item.Meta title={item.title} description={`${item.ownerName} | Due ${item.dueAt}`} />
              </List.Item>
            )}
          />
        </Card>
      ) : null}
    </Space>
  );
}