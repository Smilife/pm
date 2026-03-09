import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Progress, Segmented, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { pmApi } from '../services/api';
import type { ExecutionScheduleItem, TeamScheduleItem } from '../services/types';

type ViewMode = 'team' | 'execution';

const teamColumns: ColumnsType<TeamScheduleItem & { overlapCount: number }> = [
  { title: 'Owner', dataIndex: 'ownerName', width: 140 },
  { title: 'Execution', dataIndex: 'name' },
  { title: 'Project', dataIndex: 'projectName', width: 220 },
  {
    title: 'Window',
    width: 220,
    render: (_, record) => `${record.planStart} ~ ${record.planEnd}`,
  },
  { title: 'Status', dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  {
    title: 'Progress',
    width: 220,
    render: (_, record) => <ScheduleProgress actual={record.actualProgress} plan={record.planProgress} />,
  },
  {
    title: 'Conflicts',
    dataIndex: 'overlapCount',
    width: 120,
    render: (value: number) => (value > 0 ? <Tag color="error">{value} overlap(s)</Tag> : <Tag color="success">Clear</Tag>),
  },
];

const executionColumns: ColumnsType<ExecutionScheduleItem> = [
  { title: 'Task', dataIndex: 'name' },
  { title: 'Execution', dataIndex: 'executionName', width: 240 },
  { title: 'Project', dataIndex: 'projectName', width: 220 },
  { title: 'Owner', dataIndex: 'ownerName', width: 140 },
  {
    title: 'Inherited window',
    width: 220,
    render: (_, record) => `${record.planStart || '-'} ~ ${record.planEnd || '-'}`,
  },
  { title: 'Status', dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  {
    title: 'Progress',
    dataIndex: 'actualProgress',
    width: 180,
    render: (value: number) => <Progress percent={value} size="small" />,
  },
];

export function GanttPage() {
  const [view, setView] = useState<ViewMode>('team');
  const teamQuery = useQuery({ queryKey: ['schedule-team'], queryFn: pmApi.getTeamSchedule });
  const executionQuery = useQuery({ queryKey: ['schedule-execution'], queryFn: pmApi.getExecutionSchedule });

  const teamRows = useMemo(() => withOverlapCount(teamQuery.data ?? []), [teamQuery.data]);
  const ownerConflictCount = useMemo(
    () => new Set(teamRows.filter((item) => item.overlapCount > 0).map((item) => item.ownerName)).size,
    [teamRows],
  );
  const blockedCount = useMemo(
    () => (teamQuery.data ?? []).filter((item) => item.status === 'Blocked').length,
    [teamQuery.data],
  );

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title="Gantt"
        description="Use this page to spot schedule overlaps by owner and review the child-task breakdown behind active executions."
        extra={
          <Segmented<ViewMode>
            options={[
              { label: 'Team schedule', value: 'team' },
              { label: 'Execution breakdown', value: 'execution' },
            ]}
            value={view}
            onChange={(value) => setView(value)}
          />
        }
      />

      <Space size={16} wrap>
        <Card>
          <Statistic title="Scheduled executions" value={teamQuery.data?.length ?? 0} loading={teamQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="Owners with conflicts" value={ownerConflictCount} loading={teamQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="Blocked executions" value={blockedCount} loading={teamQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="Child tasks in view" value={executionQuery.data?.length ?? 0} loading={executionQuery.isLoading} />
        </Card>
      </Space>

      {ownerConflictCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          message="Overlapping schedule windows detected"
          description="Review the highlighted owners below and rebalance plan windows before conflicts turn into delivery risk."
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="No overlapping owner windows detected in the current seed data"
          description="This page will highlight scheduling conflicts automatically as more execution data is added."
        />
      )}

      {view === 'team' ? (
        <Card title="Team schedule overview" extra={<Typography.Text type="secondary">Rows are grouped by owner mentally; conflicts are flagged per row.</Typography.Text>}>
          <Table
            rowKey="id"
            columns={teamColumns}
            dataSource={teamRows}
            loading={teamQuery.isLoading}
            pagination={false}
            scroll={{ x: 1200 }}
          />
        </Card>
      ) : (
        <Card title="Execution breakdown view" extra={<Typography.Text type="secondary">Child tasks inherit the parent execution schedule window for now.</Typography.Text>}>
          <Table
            rowKey="id"
            columns={executionColumns}
            dataSource={executionQuery.data ?? []}
            loading={executionQuery.isLoading}
            pagination={false}
            scroll={{ x: 1200 }}
          />
        </Card>
      )}
    </Space>
  );
}

function ScheduleProgress({ actual, plan }: { actual: number; plan: number }) {
  return (
    <Space direction="vertical" size={4} style={{ width: 180 }}>
      <div>
        <Typography.Text type="secondary">Actual</Typography.Text>
        <Progress percent={actual} size="small" />
      </div>
      <div>
        <Typography.Text type="secondary">Plan</Typography.Text>
        <Progress percent={plan} size="small" status="active" />
      </div>
    </Space>
  );
}

function withOverlapCount(items: TeamScheduleItem[]): Array<TeamScheduleItem & { overlapCount: number }> {
  return items.map((item) => ({
    ...item,
    overlapCount: items.filter((candidate) => hasOverlap(item, candidate)).length,
  }));
}

function hasOverlap(current: TeamScheduleItem, candidate: TeamScheduleItem): boolean {
  if (current.id === candidate.id || current.ownerName !== candidate.ownerName) {
    return false;
  }

  const currentStart = dayjs(current.planStart);
  const currentEnd = dayjs(current.planEnd);
  const candidateStart = dayjs(candidate.planStart);
  const candidateEnd = dayjs(candidate.planEnd);

  if (!currentStart.isValid() || !currentEnd.isValid() || !candidateStart.isValid() || !candidateEnd.isValid()) {
    return false;
  }

  return currentStart.isSame(candidateEnd) || candidateStart.isSame(currentEnd) || (currentStart.isBefore(candidateEnd) && candidateStart.isBefore(currentEnd));
}