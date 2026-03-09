import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, List, Row, Space, Statistic } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { pmApi } from '../services/api';

export function WorkspacePage() {
  const navigate = useNavigate();
  const summaryQuery = useQuery({ queryKey: ['workspace-summary'], queryFn: pmApi.getWorkspaceSummary });
  const executionQuery = useQuery({ queryKey: ['workspace-executions'], queryFn: pmApi.getExecutions });

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title="Workspace"
        description="Surface the most important items for today: owned executions, due items, blockers and report entry points."
        extra={
          <Button type="primary" onClick={() => navigate('/reports/daily')}>
            Open daily report
          </Button>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="Owned executions" value={summaryQuery.data?.myExecutions ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="Due today" value={summaryQuery.data?.dueToday ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="Blocked" value={summaryQuery.data?.blocked ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="Reports pending" value={summaryQuery.data?.reportsReady ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
      </Row>
      <Card title="Key executions in progress">
        <List
          loading={executionQuery.isLoading}
          dataSource={executionQuery.data ?? []}
          renderItem={(item) => (
            <List.Item extra={<StatusTag value={item.status} />}>
              <List.Item.Meta
                title={item.name}
                description={`${item.projectName} | ${item.ownerName} | ${item.planStart} ~ ${item.planEnd}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}