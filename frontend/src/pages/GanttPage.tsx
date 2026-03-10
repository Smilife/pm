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
  { title: '负责人', dataIndex: 'ownerName', width: 140 },
  { title: '执行名称', dataIndex: 'name' },
  { title: '所属项目', dataIndex: 'projectName', width: 220 },
  {
    title: '计划窗口',
    width: 220,
    render: (_, record) => `${record.planStart} ~ ${record.planEnd}`,
  },
  { title: '状态', dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  {
    title: '进度',
    width: 220,
    render: (_, record) => <ScheduleProgress actual={record.actualProgress} plan={record.planProgress} />,
  },
  {
    title: '冲突',
    dataIndex: 'overlapCount',
    width: 120,
    render: (value: number) => (value > 0 ? <Tag color="error">重叠 {value} 项</Tag> : <Tag color="success">正常</Tag>),
  },
];

const executionColumns: ColumnsType<ExecutionScheduleItem> = [
  { title: '子任务', dataIndex: 'name' },
  { title: '所属执行', dataIndex: 'executionName', width: 240 },
  { title: '所属项目', dataIndex: 'projectName', width: 220 },
  { title: '负责人', dataIndex: 'ownerName', width: 140 },
  {
    title: '继承时间窗',
    width: 220,
    render: (_, record) => `${record.planStart || '-'} ~ ${record.planEnd || '-'}`,
  },
  { title: '状态', dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  {
    title: '进度',
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
        title="甘特图"
        description="用于发现负责人排期冲突，并查看活跃执行背后的子任务拆解情况。"
        extra={
          <Segmented<ViewMode>
            options={[
              { label: '团队排期', value: 'team' },
              { label: '执行拆解', value: 'execution' },
            ]}
            value={view}
            onChange={(value) => setView(value)}
          />
        }
      />

      <Space size={16} wrap>
        <Card>
          <Statistic title="排期中的执行" value={teamQuery.data?.length ?? 0} loading={teamQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="存在冲突的负责人" value={ownerConflictCount} loading={teamQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="阻塞中的执行" value={blockedCount} loading={teamQuery.isLoading} />
        </Card>
        <Card>
          <Statistic title="当前视图子任务数" value={executionQuery.data?.length ?? 0} loading={executionQuery.isLoading} />
        </Card>
      </Space>

      {ownerConflictCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          message="检测到计划窗口重叠"
          description="请优先检查下方高亮负责人，尽快调整计划时间，避免冲突演变为交付风险。"
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="当前种子数据中未发现负责人排期重叠"
          description="随着执行数据继续补充，这个页面会自动标记新的排期冲突。"
        />
      )}

      {view === 'team' ? (
        <Card title="团队排期总览" extra={<Typography.Text type="secondary">表格按负责人理解即可，冲突会在每一行直接标记。</Typography.Text>}>
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
        <Card title="执行拆解视图" extra={<Typography.Text type="secondary">当前子任务默认继承父执行的计划时间窗口。</Typography.Text>}>
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
        <Typography.Text type="secondary">实际</Typography.Text>
        <Progress percent={actual} size="small" />
      </div>
      <div>
        <Typography.Text type="secondary">计划</Typography.Text>
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
