import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Progress, Segmented, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { pmApi } from '../services/api';
import type { ExecutionScheduleItem, ProjectScheduleItem, TeamScheduleItem } from '../services/types';

type ViewMode = 'project' | 'team' | 'execution';
type ProjectHealth = ProjectScheduleItem['health'];
type TimelineRange = {
  start: Dayjs;
  end: Dayjs;
  totalDays: number;
};

type SummaryCardItem = {
  title: string;
  value: number;
  suffix?: string;
  loading: boolean;
};

const teamColumns: ColumnsType<TeamScheduleItem & { overlapCount: number }> = [
  { title: '负责人', dataIndex: 'ownerName', width: 140 },
  { title: '执行名称', dataIndex: 'name' },
  { title: '所属项目', dataIndex: 'projectName', width: 220 },
  {
    title: '计划窗口',
    width: 220,
    render: (_, record) => formatWindow(record.planStart, record.planEnd),
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
    render: (_, record) => formatWindow(record.planStart, record.planEnd),
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
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseView(searchParams.get('view'));
  const projectQuery = useQuery({ queryKey: ['schedule-project'], queryFn: pmApi.getProjectSchedule });
  const teamQuery = useQuery({ queryKey: ['schedule-team'], queryFn: pmApi.getTeamSchedule });
  const executionQuery = useQuery({ queryKey: ['schedule-execution'], queryFn: pmApi.getExecutionSchedule });

  const projectRows = projectQuery.data ?? [];
  const teamRows = useMemo(() => withOverlapCount(teamQuery.data ?? []), [teamQuery.data]);
  const projectRange = useMemo(() => getProjectTimelineRange(projectRows), [projectRows]);
  const ownerConflictCount = useMemo(
    () => new Set(teamRows.filter((item) => item.overlapCount > 0).map((item) => item.ownerName)).size,
    [teamRows],
  );
  const blockedExecutionCount = useMemo(
    () => (teamQuery.data ?? []).filter((item) => item.status === 'Blocked').length,
    [teamQuery.data],
  );
  const projectRiskCount = useMemo(
    () => projectRows.filter((item) => item.health === 'risk').length,
    [projectRows],
  );
  const dueSoonProjectCount = useMemo(
    () => projectRows.filter((item) => item.dueSoonCount > 0).length,
    [projectRows],
  );
  const overdueProjectCount = useMemo(
    () => projectRows.filter((item) => item.overdueCount > 0).length,
    [projectRows],
  );
  const coveredProjectCount = useMemo(
    () => new Set((teamQuery.data ?? []).map((item) => item.projectName).filter(Boolean)).size,
    [teamQuery.data],
  );
  const executionInProgressCount = useMemo(
    () => (executionQuery.data ?? []).filter((item) => item.status === 'InProgress').length,
    [executionQuery.data],
  );
  const executionDoneCount = useMemo(
    () => (executionQuery.data ?? []).filter((item) => isClosedStatus(item.status)).length,
    [executionQuery.data],
  );
  const linkedExecutionCount = useMemo(
    () => new Set((executionQuery.data ?? []).map((item) => item.executionId)).size,
    [executionQuery.data],
  );

  const summaryCards = buildSummaryCards({
    view,
    projectRows,
    projectRiskCount,
    dueSoonProjectCount,
    overdueProjectCount,
    teamRows,
    ownerConflictCount,
    blockedExecutionCount,
    coveredProjectCount,
    executionRows: executionQuery.data ?? [],
    executionInProgressCount,
    executionDoneCount,
    linkedExecutionCount,
    projectLoading: projectQuery.isLoading,
    teamLoading: teamQuery.isLoading,
    executionLoading: executionQuery.isLoading,
  });

  const handleViewChange = (nextView: ViewMode) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('view', nextView);
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title="甘特图"
        description="从项目、团队和执行三个层级观察排期窗口、风险节点与任务拆解。"
        extra={
          <Segmented<ViewMode>
            options={[
              { label: '项目甘特', value: 'project' },
              { label: '团队排期', value: 'team' },
              { label: '执行拆解', value: 'execution' },
            ]}
            value={view}
            onChange={(value) => handleViewChange(value)}
          />
        }
      />

      <Space size={16} wrap>
        {summaryCards.map((item) => (
          <Card key={item.title}>
            <Statistic title={item.title} value={item.value} suffix={item.suffix} loading={item.loading} />
          </Card>
        ))}
      </Space>

      {renderViewAlert(view, {
        projectRiskCount,
        dueSoonProjectCount,
        overdueProjectCount,
        ownerConflictCount,
        blockedExecutionCount,
        executionInProgressCount,
        executionDoneCount,
      })}

      {view === 'project' ? (
        <Card title="项目甘特图" extra={<Typography.Text type="secondary">按项目时间窗查看整体交付节奏和风险节点。</Typography.Text>}>
          <Table
            rowKey="id"
            columns={buildProjectColumns(projectRange)}
            dataSource={projectRows}
            loading={projectQuery.isLoading}
            pagination={false}
            scroll={{ x: 1480 }}
          />
        </Card>
      ) : null}

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
      ) : null}

      {view === 'execution' ? (
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
      ) : null}
    </Space>
  );
}

function buildProjectColumns(range: TimelineRange | null): ColumnsType<ProjectScheduleItem> {
  return [
    {
      title: '项目',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.code || '未设置编码'}</Typography.Text>
        </Space>
      ),
    },
    { title: '负责人', dataIndex: 'ownerName', width: 140 },
    {
      title: '健康度',
      dataIndex: 'health',
      width: 120,
      render: (_: ProjectHealth, record) => <ProjectHealthTag health={record.health} />,
    },
    {
      title: '项目时间窗',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{formatWindow(record.planStart, record.planEnd)}</Typography.Text>
          <Typography.Text type="secondary">最近活动：{record.lastActivityAt || '暂无更新'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '时间条',
      width: 320,
      render: (_, record) => <ProjectTimelineBar record={record} range={range} />,
    },
    {
      title: '交付摘要',
      width: 300,
      render: (_, record) => (
        <Space direction="vertical" size={8}>
          <Space size={[8, 8]} wrap>
            <Tag color="processing">执行 {record.executionCount}</Tag>
            <Tag color={record.blockedExecutionCount > 0 ? 'error' : 'success'}>阻塞 {record.blockedExecutionCount}</Tag>
            <Tag color={record.openBugCount > 0 ? 'warning' : 'success'}>缺陷 {record.openBugCount}</Tag>
          </Space>
          <Space size={[6, 6]} wrap>
            {record.executionNames.length > 0 ? (
              record.executionNames.map((name) => <Tag key={name}>{name}</Tag>)
            ) : (
              <Typography.Text type="secondary">尚未拆解执行</Typography.Text>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: '节点状态',
      width: 140,
      render: (_, record) => <ProjectMilestoneTag record={record} />,
    },
    {
      title: '平均进度',
      width: 180,
      render: (_, record) => <Progress percent={record.averageProgress} size="small" />,
    },
  ];
}

function renderViewAlert(
  view: ViewMode,
  metrics: {
    projectRiskCount: number;
    dueSoonProjectCount: number;
    overdueProjectCount: number;
    ownerConflictCount: number;
    blockedExecutionCount: number;
    executionInProgressCount: number;
    executionDoneCount: number;
  },
) {
  if (view === 'project') {
    if (metrics.projectRiskCount > 0 || metrics.overdueProjectCount > 0) {
      return (
        <Alert
          type="warning"
          showIcon
          message="项目层发现需要优先关注的排期风险"
          description={`当前有 ${metrics.projectRiskCount} 个风险项目，${metrics.overdueProjectCount} 个项目已出现逾期节点，建议优先处理。`}
        />
      );
    }

    return (
      <Alert
        type="success"
        showIcon
        message="项目层排期整体平稳"
        description={`当前有 ${metrics.dueSoonProjectCount} 个项目进入临近节点窗口，可继续按计划推进。`}
      />
    );
  }

  if (view === 'team') {
    if (metrics.ownerConflictCount > 0) {
      return (
        <Alert
          type="warning"
          showIcon
          message="检测到负责人排期重叠"
          description={`当前有 ${metrics.ownerConflictCount} 位负责人存在时间窗冲突，建议尽快调整计划时间。`}
        />
      );
    }

    return (
      <Alert
        type="success"
        showIcon
        message="当前未发现团队级排期冲突"
        description={`阻塞中的执行共 ${metrics.blockedExecutionCount} 项，仍建议结合状态列持续关注。`}
      />
    );
  }

  return (
    <Alert
      type="info"
      showIcon
      message="执行拆解视图用于追踪最细颗粒度的推进情况"
      description={`当前有 ${metrics.executionInProgressCount} 个子任务进行中，${metrics.executionDoneCount} 个子任务已完成。`}
    />
  );
}

function buildSummaryCards(input: {
  view: ViewMode;
  projectRows: ProjectScheduleItem[];
  projectRiskCount: number;
  dueSoonProjectCount: number;
  overdueProjectCount: number;
  teamRows: Array<TeamScheduleItem & { overlapCount: number }>;
  ownerConflictCount: number;
  blockedExecutionCount: number;
  coveredProjectCount: number;
  executionRows: ExecutionScheduleItem[];
  executionInProgressCount: number;
  executionDoneCount: number;
  linkedExecutionCount: number;
  projectLoading: boolean;
  teamLoading: boolean;
  executionLoading: boolean;
}): SummaryCardItem[] {
  if (input.view === 'project') {
    return [
      { title: '项目数', value: input.projectRows.length, loading: input.projectLoading },
      { title: '风险项目', value: input.projectRiskCount, loading: input.projectLoading },
      { title: '临近节点项目', value: input.dueSoonProjectCount, loading: input.projectLoading },
      { title: '已逾期项目', value: input.overdueProjectCount, loading: input.projectLoading },
    ];
  }

  if (input.view === 'team') {
    return [
      { title: '排期执行数', value: input.teamRows.length, loading: input.teamLoading },
      { title: '冲突负责人', value: input.ownerConflictCount, loading: input.teamLoading },
      { title: '阻塞执行', value: input.blockedExecutionCount, loading: input.teamLoading },
      { title: '涉及项目', value: input.coveredProjectCount, loading: input.teamLoading },
    ];
  }

  return [
    { title: '子任务数', value: input.executionRows.length, loading: input.executionLoading },
    { title: '进行中子任务', value: input.executionInProgressCount, loading: input.executionLoading },
    { title: '已完成子任务', value: input.executionDoneCount, loading: input.executionLoading },
    { title: '关联执行数', value: input.linkedExecutionCount, loading: input.executionLoading },
  ];
}

function ProjectHealthTag({ health }: { health: ProjectHealth }) {
  const config: Record<ProjectHealth, { color: string; label: string }> = {
    healthy: { color: 'success', label: '健康' },
    watch: { color: 'warning', label: '关注' },
    risk: { color: 'error', label: '风险' },
  };

  const item = config[health];
  return <Tag color={item.color}>{item.label}</Tag>;
}

function ProjectMilestoneTag({ record }: { record: ProjectScheduleItem }) {
  if (record.executionCount === 0) {
    return <Tag>待拆解</Tag>;
  }

  if (!record.planStart || !record.planEnd) {
    return <Tag>未排期</Tag>;
  }

  if (record.status === 'Done') {
    return <Tag color="success">已完成</Tag>;
  }

  if (record.overdueCount > 0) {
    return <Tag color="error">已逾期</Tag>;
  }

  if (record.dueSoonCount > 0) {
    return <Tag color="warning">临近节点</Tag>;
  }

  if (record.blockedExecutionCount > 0) {
    return <Tag color="volcano">有阻塞</Tag>;
  }

  return <Tag color="processing">排期中</Tag>;
}

function ProjectTimelineBar({ record, range }: { record: ProjectScheduleItem; range: TimelineRange | null }) {
  const metrics = getTimelineMetrics(record, range);

  if (!metrics) {
    return <Typography.Text type="secondary">未形成可视化时间窗</Typography.Text>;
  }

  return (
    <div className="gantt-timeline">
      <div className="gantt-timeline__labels">
        <span>{range?.start.format('MM-DD')}</span>
        <span>{range?.end.format('MM-DD')}</span>
      </div>
      <div className="gantt-timeline__track">
        <div
          className={`gantt-timeline__bar gantt-timeline__bar--${record.health}`}
          style={{ left: `${metrics.left}%`, width: `${metrics.width}%` }}
        />
      </div>
      <Typography.Text type="secondary">{formatWindow(record.planStart, record.planEnd)}</Typography.Text>
    </div>
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

function parseView(rawValue: string | null): ViewMode {
  if (rawValue === 'team' || rawValue === 'execution' || rawValue === 'project') {
    return rawValue;
  }

  return 'project';
}

function formatWindow(start: string, end: string): string {
  if (!start || !end) {
    return '未排期';
  }

  return `${start} ~ ${end}`;
}

function getProjectTimelineRange(items: ProjectScheduleItem[]): TimelineRange | null {
  const starts = items
    .map((item) => dayjs(item.planStart))
    .filter((value) => value.isValid());
  const ends = items
    .map((item) => dayjs(item.planEnd))
    .filter((value) => value.isValid());

  if (starts.length === 0 || ends.length === 0) {
    return null;
  }

  const start = starts.reduce((min, current) => (current.isBefore(min) ? current : min));
  let end = ends.reduce((max, current) => (current.isAfter(max) ? current : max));
  if (end.isSame(start, 'day')) {
    end = end.add(1, 'day');
  }

  return {
    start,
    end,
    totalDays: Math.max(end.diff(start, 'day'), 1) + 1,
  };
}

function getTimelineMetrics(record: ProjectScheduleItem, range: TimelineRange | null): { left: number; width: number } | null {
  if (!range || !record.planStart || !record.planEnd) {
    return null;
  }

  const start = dayjs(record.planStart);
  const end = dayjs(record.planEnd);
  if (!start.isValid() || !end.isValid()) {
    return null;
  }

  const offsetDays = Math.max(start.diff(range.start, 'day'), 0);
  const spanDays = Math.max(end.diff(start, 'day'), 0) + 1;

  return {
    left: (offsetDays / range.totalDays) * 100,
    width: Math.max((spanDays / range.totalDays) * 100, 8),
  };
}

function isClosedStatus(status: string): boolean {
  return status === 'Done' || status === 'Closed';
}
