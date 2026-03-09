import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, List, Space, Statistic, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../store/authStore';
import { formatApiError, pmApi } from '../services/api';

export function ReportsWeeklyPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canGenerateWeeklyReport = permissions.includes('report.weekly.generate.self');
  const canViewExecutions = permissions.includes('execution.view.related');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const reportQuery = useQuery({ queryKey: ['weekly-report'], queryFn: pmApi.generateWeeklyReport });
  const regenerateMutation = useMutation({
    mutationFn: pmApi.generateWeeklyReport,
    onSuccess: (draft) => {
      queryClient.setQueryData(['weekly-report'], draft);
      messageApi.success('Weekly report regenerated.');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });
  const draft = reportQuery.data;
  const worklogCount = useMemo(() => draft?.worklogHighlights.length ?? 0, [draft]);

  const handleRegenerate = () => {
    if (!canGenerateWeeklyReport) {
      messageApi.warning('Your current role cannot regenerate weekly reports.');
      return;
    }

    regenerateMutation.mutate();
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="Weekly report"
        description="Summarize progress across executions, daily tasks and execution worklogs into a single weekly narrative."
        extra={
          <Space>
            {canViewExecutions ? <Button onClick={() => navigate('/executions')}>Manage executions</Button> : null}
            {canGenerateWeeklyReport ? (
              <Button type="primary" onClick={handleRegenerate} loading={regenerateMutation.isPending}>
                Regenerate
              </Button>
            ) : null}
          </Space>
        }
      />
      <Space wrap size={16}>
        <Card>
          <Statistic title="Total logged hours" value={draft?.totalHours ?? 0} suffix="h" loading={reportQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="Worklog highlights" value={worklogCount} loading={reportQuery.isLoading} />
        </Card>
      </Space>
      <Card loading={reportQuery.isLoading}>
        <Typography.Text type="secondary">Generated at: {draft?.generatedAt ?? '-'}</Typography.Text>
        <Typography.Paragraph style={{ marginTop: 12 }}>{draft?.summary ?? '-'}</Typography.Paragraph>
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
      <Card title="Next week" loading={reportQuery.isLoading}>
        <List dataSource={draft?.nextWeek ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="Worklog highlights" loading={reportQuery.isLoading}>
        <List dataSource={draft?.worklogHighlights ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
    </Space>
  );
}