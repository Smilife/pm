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
      messageApi.success('周报已重新生成。');
    },
    onError: (error) => {
      messageApi.error(formatApiError(error));
    },
  });
  const draft = reportQuery.data;
  const worklogCount = useMemo(() => draft?.worklogHighlights.length ?? 0, [draft]);

  const handleRegenerate = () => {
    if (!canGenerateWeeklyReport) {
      messageApi.warning('当前角色没有重新生成周报的权限。');
      return;
    }

    regenerateMutation.mutate();
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      {contextHolder}
      <PageHeader
        title="周报"
        description="汇总执行进展、日常事项和工时日志，形成统一的周度产出说明。"
        extra={
          <Space>
            {canViewExecutions ? <Button onClick={() => navigate('/executions')}>查看执行</Button> : null}
            {canGenerateWeeklyReport ? (
              <Button type="primary" onClick={handleRegenerate} loading={regenerateMutation.isPending}>
                重新生成
              </Button>
            ) : null}
          </Space>
        }
      />
      <Space wrap size={16}>
        <Card>
          <Statistic title="总工时" value={draft?.totalHours ?? 0} suffix="h" loading={reportQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="工时亮点条数" value={worklogCount} loading={reportQuery.isLoading} />
        </Card>
      </Space>
      <Card loading={reportQuery.isLoading}>
        <Typography.Text type="secondary">生成时间：{draft?.generatedAt ?? '-'}</Typography.Text>
        <Typography.Paragraph style={{ marginTop: 12 }}>{draft?.summary ?? '-'}</Typography.Paragraph>
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
      <Card title="下周计划" loading={reportQuery.isLoading}>
        <List dataSource={draft?.nextWeek ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="工时亮点" loading={reportQuery.isLoading}>
        <List dataSource={draft?.worklogHighlights ?? []} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
    </Space>
  );
}
