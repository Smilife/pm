import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, List, Row, Space, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { useAuthStore } from '../store/authStore';
import { pmApi } from '../services/api';

export function WorkspacePage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.permissions);
  const canViewBugs = permissions.includes('bug.view.related');
  const summaryQuery = useQuery({ queryKey: ['workspace-summary'], queryFn: pmApi.getWorkspaceSummary });
  const executionQuery = useQuery({ queryKey: ['workspace-executions'], queryFn: pmApi.getExecutions });
  const bugsQuery = useQuery({ queryKey: ['workspace-bugs'], queryFn: pmApi.getBugs, enabled: canViewBugs });
  const openBugs = useMemo(
    () => (bugsQuery.data ?? []).filter((item) => !['Resolved', 'Closed'].includes(item.status)).slice(0, 5),
    [bugsQuery.data],
  );

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title="工作台"
        description="聚合今天最重要的工作项，包括我负责的执行、今日到期事项、阻塞项和报表入口。"
        extra={
          <Space>
            {canViewBugs ? <Button onClick={() => navigate('/bugs')}>查看缺陷</Button> : null}
            <Button type="primary" onClick={() => navigate('/reports/daily')}>
              打开日报
            </Button>
          </Space>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="我负责的执行" value={summaryQuery.data?.myExecutions ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="今日到期" value={summaryQuery.data?.dueToday ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="阻塞项" value={summaryQuery.data?.blocked ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="待生成报表" value={summaryQuery.data?.reportsReady ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={canViewBugs ? 14 : 24}>
          <Card title="重点执行项">
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
        </Col>
        {canViewBugs ? (
          <Col xs={24} xl={10}>
            <Card title="需要关注的缺陷" extra={<Typography.Text type="secondary">共 {openBugs.length} 条</Typography.Text>}>
              <List
                loading={bugsQuery.isLoading}
                dataSource={openBugs}
                locale={{ emptyText: '当前没有需要重点关注的未关闭缺陷。' }}
                renderItem={(item) => (
                  <List.Item extra={<StatusTag value={item.status} />}>
                    <List.Item.Meta title={item.title} description={`${item.linkName} | ${item.ownerName} | ${item.priority}`} />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        ) : null}
      </Row>
    </Space>
  );
}
