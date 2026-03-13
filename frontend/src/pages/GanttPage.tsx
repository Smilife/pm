import { Fragment, useMemo } from 'react';
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
type TimelineRange = {
  start: Dayjs;
  end: Dayjs;
  totalDays: number;
};

type SummaryCardItem = {
  title: string;
  value: number;
  loading: boolean;
};

type ProjectExecutionGroup = {
  project: ProjectScheduleItem;
  executions: TeamScheduleItem[];
};

type TimelineDay = {
  key: string;
  dayLabel: string;
  weekLabel: string;
  monthKey: string;
  monthLabel: string;
  isWeekend: boolean;
  isToday: boolean;
};

type TimelineMonthSegment = {
  key: string;
  label: string;
  span: number;
};

const WEEKDAY_LABELS = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d'] as const;

const text = {
  pageTitle: '\u7518\u7279\u56fe',
  pageDescription: '\u4ece\u9879\u76ee\u3001\u56e2\u961f\u548c\u6267\u884c\u4e09\u4e2a\u5c42\u7ea7\u89c2\u5bdf\u6392\u671f\u7a97\u53e3\u3001\u98ce\u9669\u8282\u70b9\u4e0e\u4efb\u52a1\u62c6\u89e3\u3002',
  projectView: '\u9879\u76ee\u7518\u7279',
  teamView: '\u56e2\u961f\u6392\u671f',
  executionView: '\u6267\u884c\u62c6\u89e3',
  projectCardTitle: '\u9879\u76ee\u7518\u7279\u56fe',
  projectCardHint: '\u5de6\u4fa7\u770b\u5c42\u7ea7\uff0c\u53f3\u4fa7\u770b\u65f6\u95f4\u8f74\uff0c\u9879\u76ee\u6761\u548c\u6267\u884c\u6761\u4f1a\u5728\u540c\u4e00\u6761\u65e5\u5386\u8f74\u4e0a\u5bf9\u9f50\u3002',
  teamCardTitle: '\u56e2\u961f\u6392\u671f\u603b\u89c8',
  teamCardHint: '\u8868\u683c\u6309\u8d1f\u8d23\u4eba\u7406\u89e3\u5373\u53ef\uff0c\u51b2\u7a81\u4f1a\u5728\u6bcf\u4e00\u884c\u76f4\u63a5\u6807\u8bb0\u3002',
  executionCardTitle: '\u6267\u884c\u62c6\u89e3\u89c6\u56fe',
  executionCardHint: '\u5f53\u524d\u5b50\u4efb\u52a1\u9ed8\u8ba4\u7ee7\u627f\u7236\u6267\u884c\u7684\u8ba1\u5212\u65f6\u95f4\u7a97\u53e3\u3002',
  projectCount: '\u9879\u76ee\u6570',
  riskProjectCount: '\u98ce\u9669\u9879\u76ee',
  dueSoonCount: '\u4e34\u8fd1\u8282\u70b9\u9879\u76ee',
  overdueCount: '\u5df2\u903e\u671f\u9879\u76ee',
  scheduledExecutionCount: '\u6392\u671f\u6267\u884c\u6570',
  conflictOwnerCount: '\u51b2\u7a81\u8d1f\u8d23\u4eba',
  blockedExecutionCount: '\u963b\u585e\u6267\u884c',
  coveredProjectCount: '\u6d89\u53ca\u9879\u76ee',
  taskCount: '\u5b50\u4efb\u52a1\u6570',
  taskInProgressCount: '\u8fdb\u884c\u4e2d\u5b50\u4efb\u52a1',
  taskDoneCount: '\u5df2\u5b8c\u6210\u5b50\u4efb\u52a1',
  linkedExecutionCount: '\u5173\u8054\u6267\u884c\u6570',
  projectAlertRiskTitle: '\u9879\u76ee\u5c42\u5b58\u5728\u9700\u8981\u4f18\u5148\u5173\u6ce8\u7684\u4ea4\u4ed8\u98ce\u9669',
  projectAlertRiskDescription: '\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u4ece\u9879\u76ee\u6761\u770b\u5230\u603b\u5468\u671f\uff0c\u518d\u4ece\u4e0b\u65b9\u6267\u884c\u6761\u5bf9\u7167\u8d1f\u8d23\u4eba\u548c\u5177\u4f53\u65f6\u6bb5\u3002',
  projectAlertStableTitle: '\u9879\u76ee\u5c42\u65f6\u95f4\u5173\u7cfb\u5df2\u7ecf\u6e05\u6670\u5c55\u5f00',
  projectAlertStableDescription: '\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u5bf9\u6bd4\u6bcf\u4e2a\u9879\u76ee\u4e0b\u7684\u6267\u884c\u3001\u4eba\u5458\u548c\u65f6\u95f4\u6761\u3002',
  teamAlertConflictTitle: '\u68c0\u6d4b\u5230\u8d1f\u8d23\u4eba\u6392\u671f\u91cd\u53e0',
  teamAlertConflictDescription: '\u8bf7\u4f18\u5148\u8c03\u6574\u540c\u4e00\u4eba\u5728\u540c\u4e00\u65f6\u95f4\u7a97\u5185\u7684\u591a\u4e2a\u6267\u884c\u5b89\u6392\u3002',
  teamAlertStableTitle: '\u5f53\u524d\u672a\u53d1\u73b0\u56e2\u961f\u7ea7\u6392\u671f\u51b2\u7a81',
  teamAlertStableDescription: '\u53ef\u4ee5\u7ed3\u5408\u963b\u585e\u72b6\u6001\u548c\u8fdb\u5ea6\u504f\u5dee\u6301\u7eed\u5173\u6ce8\u3002',
  executionAlertTitle: '\u6267\u884c\u62c6\u89e3\u89c6\u56fe\u7528\u4e8e\u8ddf\u8e2a\u6700\u7ec6\u9897\u7c92\u5ea6\u7684\u63a8\u8fdb\u60c5\u51b5',
  executionAlertDescription: '\u8fd9\u4e00\u5c42\u4e3b\u8981\u7528\u6765\u5bf9\u7167\u9879\u76ee\u7518\u7279\u4e2d\u7684\u6267\u884c\u6761\u3002',
  hierarchy: '\u9879\u76ee / \u6267\u884c',
  owner: '\u8d1f\u8d23\u4eba',
  status: '\u72b6\u6001',
  progress: '\u8fdb\u5ea6',
  actual: '\u5b9e\u9645',
  plan: '\u8ba1\u5212',
  overlap: '\u51b2\u7a81',
  overlapNormal: '\u6b63\u5e38',
  overlapPrefix: '\u91cd\u53e0',
  execution: '\u6267\u884c',
  project: '\u9879\u76ee',
  childTask: '\u5b50\u4efb\u52a1',
  linkedExecution: '\u6240\u5c5e\u6267\u884c',
  linkedProject: '\u6240\u5c5e\u9879\u76ee',
  inheritWindow: '\u7ee7\u627f\u65f6\u95f4\u7a97',
  planWindow: '\u8ba1\u5212\u7a97\u53e3',
  projectOwner: '\u9879\u76ee\u8d1f\u8d23\u4eba',
  latestActivity: '\u6700\u8fd1\u6d3b\u52a8',
  summaryHint: '\u6c47\u603b\u65f6\u95f4\u7a97',
  rowTypeProject: '\u9879\u76ee',
  rowTypeExecution: '\u6267\u884c',
  riskAndBug: '\u98ce\u9669 / \u7f3a\u9677',
  deviation: '\u8fdb\u5ea6\u504f\u5dee',
  timelineEmpty: '\u6682\u65e0\u6392\u671f',
  emptyProjectGantt: '\u6682\u65e0\u53ef\u5c55\u793a\u7684\u9879\u76ee\u6392\u671f',
  noCode: '\u672a\u8bbe\u7f6e\u7f16\u7801',
  noActivity: '\u6682\u65e0\u66f4\u65b0',
  noSchedule: '\u672a\u6392\u671f',
  noExecutions: '\u6682\u65e0\u6267\u884c\u6392\u671f',
  noExecutionsHint: '\u8fd9\u4e2a\u9879\u76ee\u8fd8\u6ca1\u6709\u62c6\u51fa\u6267\u884c\uff0c\u6240\u4ee5\u5f53\u524d\u53ea\u80fd\u770b\u5230\u9879\u76ee\u603b\u5468\u671f\u3002',
  healthy: '\u5065\u5eb7',
  watch: '\u5173\u6ce8',
  risk: '\u98ce\u9669',
  done: '\u5df2\u5b8c\u6210',
  blocked: '\u6709\u963b\u585e',
  active: '\u8fdb\u884c\u4e2d',
  loadingProjectGantt: '\u6b63\u5728\u52a0\u8f7d\u9879\u76ee\u7518\u7279\u6570\u636e...',
} as const;

const teamColumns: ColumnsType<TeamScheduleItem & { overlapCount: number }> = [
  { title: text.owner, dataIndex: 'ownerName', width: 140 },
  { title: text.execution, dataIndex: 'name' },
  { title: text.linkedProject, dataIndex: 'projectName', width: 220 },
  {
    title: text.planWindow,
    width: 220,
    render: (_, record) => formatWindow(record.planStart, record.planEnd),
  },
  { title: text.status, dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  {
    title: text.progress,
    width: 220,
    render: (_, record) => <ScheduleProgress actual={record.actualProgress} plan={record.planProgress} />,
  },
  {
    title: text.overlap,
    dataIndex: 'overlapCount',
    width: 120,
    render: (value: number) =>
      value > 0 ? <Tag color="error">{`${text.overlapPrefix} ${value} ${'\u9879'}`}</Tag> : <Tag color="success">{text.overlapNormal}</Tag>,
  },
];

const executionColumns: ColumnsType<ExecutionScheduleItem> = [
  { title: text.childTask, dataIndex: 'name' },
  { title: text.linkedExecution, dataIndex: 'executionName', width: 240 },
  { title: text.linkedProject, dataIndex: 'projectName', width: 220 },
  { title: text.owner, dataIndex: 'ownerName', width: 140 },
  {
    title: text.inheritWindow,
    width: 220,
    render: (_, record) => formatWindow(record.planStart, record.planEnd),
  },
  { title: text.status, dataIndex: 'status', width: 140, render: (value: string) => <StatusTag value={value} /> },
  {
    title: text.progress,
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
  const scheduleRows = teamQuery.data ?? [];
  const teamRows = useMemo(() => withOverlapCount(scheduleRows), [scheduleRows]);
  const projectGroups = useMemo(() => buildProjectExecutionGroups(projectRows, scheduleRows), [projectRows, scheduleRows]);
  const projectRange = useMemo(() => getProjectTimelineRange(projectGroups), [projectGroups]);
  const ownerConflictCount = useMemo(
    () => new Set(teamRows.filter((item) => item.overlapCount > 0).map((item) => item.ownerName)).size,
    [teamRows],
  );
  const blockedExecutionCount = useMemo(() => scheduleRows.filter((item) => item.status === 'Blocked').length, [scheduleRows]);
  const projectRiskCount = useMemo(() => projectRows.filter((item) => item.health === 'risk').length, [projectRows]);
  const dueSoonProjectCount = useMemo(() => projectRows.filter((item) => item.dueSoonCount > 0).length, [projectRows]);
  const overdueProjectCount = useMemo(() => projectRows.filter((item) => item.overdueCount > 0).length, [projectRows]);
  const coveredProjectCount = useMemo(() => new Set(scheduleRows.map((item) => item.projectName).filter(Boolean)).size, [scheduleRows]);
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
    projectCount: projectGroups.length,
    projectRiskCount,
    dueSoonProjectCount,
    overdueProjectCount,
    scheduledExecutionCount: teamRows.length,
    ownerConflictCount,
    blockedExecutionCount,
    coveredProjectCount,
    taskCount: executionQuery.data?.length ?? 0,
    executionInProgressCount,
    executionDoneCount,
    linkedExecutionCount,
    projectLoading: projectQuery.isLoading || teamQuery.isLoading,
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
        title={text.pageTitle}
        description={text.pageDescription}
        extra={
          <Segmented<ViewMode>
            options={[
              { label: text.projectView, value: 'project' },
              { label: text.teamView, value: 'team' },
              { label: text.executionView, value: 'execution' },
            ]}
            value={view}
            onChange={(value) => handleViewChange(value)}
          />
        }
      />

      <Space size={16} wrap>
        {summaryCards.map((item) => (
          <Card key={item.title}>
            <Statistic title={item.title} value={item.value} loading={item.loading} />
          </Card>
        ))}
      </Space>

      {renderViewAlert(view, ownerConflictCount, blockedExecutionCount, projectRiskCount, overdueProjectCount, dueSoonProjectCount)}

      {view === 'project' ? (
        <Card title={text.projectCardTitle} extra={<Typography.Text type="secondary">{text.projectCardHint}</Typography.Text>}>
          <ProjectGanttBoard groups={projectGroups} range={projectRange} loading={projectQuery.isLoading || teamQuery.isLoading} />
        </Card>
      ) : null}

      {view === 'team' ? (
        <Card title={text.teamCardTitle} extra={<Typography.Text type="secondary">{text.teamCardHint}</Typography.Text>}>
          <Table rowKey="id" columns={teamColumns} dataSource={teamRows} loading={teamQuery.isLoading} pagination={false} scroll={{ x: 1200 }} />
        </Card>
      ) : null}

      {view === 'execution' ? (
        <Card title={text.executionCardTitle} extra={<Typography.Text type="secondary">{text.executionCardHint}</Typography.Text>}>
          <Table rowKey="id" columns={executionColumns} dataSource={executionQuery.data ?? []} loading={executionQuery.isLoading} pagination={false} scroll={{ x: 1200 }} />
        </Card>
      ) : null}
    </Space>
  );
}
function ProjectGanttBoard({
  groups,
  range,
  loading,
}: {
  groups: ProjectExecutionGroup[];
  range: TimelineRange | null;
  loading: boolean;
}) {
  const days = useMemo(() => buildTimelineDays(range), [range]);
  const monthSegments = useMemo(() => buildTimelineMonthSegments(days), [days]);
  const timelineWidth = useMemo(() => getTimelineWidth(range), [range]);
  const boardColumns = useMemo(() => buildBoardColumns(timelineWidth), [timelineWidth]);
  const dayColumns = useMemo(() => buildDayColumns(days.length), [days.length]);

  if (loading) {
    return <Typography.Text type="secondary">{text.loadingProjectGantt}</Typography.Text>;
  }

  if (groups.length === 0) {
    return <Typography.Text type="secondary">{text.emptyProjectGantt}</Typography.Text>;
  }

  return (
    <div className="gantt-board">
      <div className="gantt-board__viewport">
        <div className="gantt-board__row gantt-board__row--header" style={{ gridTemplateColumns: boardColumns }}>
          <div className="gantt-board__head">{text.hierarchy}</div>
          <div className="gantt-board__head">{text.owner}</div>
          <div className="gantt-board__head">{text.status}</div>
          <div className="gantt-board__head">{text.progress}</div>
          <div className="gantt-board__head gantt-board__head--timeline">
            <TimelineAxis days={days} monthSegments={monthSegments} dayColumns={dayColumns} />
          </div>
        </div>

        {groups.map((group) => (
          <Fragment key={group.project.id}>
            <ProjectTimelineRow group={group} range={range} days={days} dayColumns={dayColumns} boardColumns={boardColumns} />
            {group.executions.length > 0
              ? group.executions.map((execution) => (
                  <ExecutionTimelineRow
                    key={execution.id}
                    execution={execution}
                    range={range}
                    days={days}
                    dayColumns={dayColumns}
                    boardColumns={boardColumns}
                  />
                ))
              : <EmptyExecutionRow boardColumns={boardColumns} days={days} dayColumns={dayColumns} />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function TimelineAxis({
  days,
  monthSegments,
  dayColumns,
}: {
  days: TimelineDay[];
  monthSegments: TimelineMonthSegment[];
  dayColumns: string;
}) {
  return (
    <div className="gantt-axis">
      <div className="gantt-axis__months">
        {monthSegments.map((segment) => (
          <div key={segment.key} className="gantt-axis__month" style={{ flex: segment.span }}>
            {segment.label}
          </div>
        ))}
      </div>
      <div className="gantt-axis__days" style={{ gridTemplateColumns: dayColumns }}>
        {days.map((day) => (
          <div
            key={day.key}
            className={[
              'gantt-axis__day',
              day.isWeekend ? 'gantt-axis__day--weekend' : '',
              day.isToday ? 'gantt-axis__day--today' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <Typography.Text strong>{day.dayLabel}</Typography.Text>
            <Typography.Text type="secondary">{day.weekLabel}</Typography.Text>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectTimelineRow({
  group,
  range,
  days,
  dayColumns,
  boardColumns,
}: {
  group: ProjectExecutionGroup;
  range: TimelineRange | null;
  days: TimelineDay[];
  dayColumns: string;
  boardColumns: string;
}) {
  const subtitle = `${group.project.code || text.noCode} \u00b7 ${text.projectOwner}\uff1a${group.project.ownerName || '-'} \u00b7 ${text.execution} ${group.executions.length}`;
  const progressHint = `${text.riskAndBug}\uff1a${group.project.riskCount} / ${group.project.openBugCount}`;

  return (
    <div className="gantt-board__row gantt-board__row--project" style={{ gridTemplateColumns: boardColumns }}>
      <div className="gantt-board__cell gantt-board__cell--project">
        <div className="gantt-hierarchy">
          <Space size={[8, 8]} wrap>
            <Tag color="geekblue">{text.rowTypeProject}</Tag>
            <Typography.Text strong>{group.project.name}</Typography.Text>
            <ProjectHealthTag health={group.project.health} />
            <ProjectMilestoneTag project={group.project} />
          </Space>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
      </div>

      <div className="gantt-board__cell gantt-board__cell--project">
        <Typography.Text strong>{group.project.ownerName || '-'}</Typography.Text>
      </div>

      <div className="gantt-board__cell gantt-board__cell--project">
        <Space direction="vertical" size={4}>
          <ProjectMilestoneTag project={group.project} />
          <Typography.Text type="secondary">{`${text.latestActivity}\uff1a${group.project.lastActivityAt || text.noActivity}`}</Typography.Text>
        </Space>
      </div>

      <div className="gantt-board__cell gantt-board__cell--project">
        <div className="gantt-progress-cell">
          <Typography.Text strong>{`${group.project.averageProgress}%`}</Typography.Text>
          <Progress percent={group.project.averageProgress} size="small" />
          <Typography.Text type="secondary">{progressHint}</Typography.Text>
        </div>
      </div>

      <div className="gantt-board__cell gantt-board__cell--timeline gantt-board__cell--project">
        <TimelineLane
          start={group.project.planStart}
          end={group.project.planEnd}
          range={range}
          days={days}
          dayColumns={dayColumns}
          tone={group.project.health}
          variant="project"
          label={formatWindow(group.project.planStart, group.project.planEnd)}
          subtitle={`${text.summaryHint} \u00b7 ${text.blocked} ${group.project.blockedExecutionCount}`}
        />
      </div>
    </div>
  );
}

function ExecutionTimelineRow({
  execution,
  range,
  days,
  dayColumns,
  boardColumns,
}: {
  execution: TeamScheduleItem;
  range: TimelineRange | null;
  days: TimelineDay[];
  dayColumns: string;
  boardColumns: string;
}) {
  const deviation = execution.actualProgress - execution.planProgress;
  const deviationPrefix = deviation >= 0 ? '+' : '';

  return (
    <div className="gantt-board__row" style={{ gridTemplateColumns: boardColumns }}>
      <div className="gantt-board__cell">
        <div className="gantt-hierarchy gantt-hierarchy--child">
          <Space size={[8, 8]} wrap>
            <span className="gantt-hierarchy__indent" />
            <Tag>{text.rowTypeExecution}</Tag>
            <Typography.Text strong>{execution.name}</Typography.Text>
          </Space>
          <Typography.Text type="secondary">{`${text.linkedProject}\uff1a${execution.projectName || '-'} \u00b7 ${text.planWindow}\uff1a${formatWindow(execution.planStart, execution.planEnd)}`}</Typography.Text>
        </div>
      </div>

      <div className="gantt-board__cell">
        <Typography.Text>{execution.ownerName || '-'}</Typography.Text>
      </div>

      <div className="gantt-board__cell">
        <StatusTag value={execution.status} />
      </div>

      <div className="gantt-board__cell">
        <div className="gantt-progress-cell">
          <Typography.Text strong>{`${execution.actualProgress}%`}</Typography.Text>
          <Progress percent={execution.actualProgress} size="small" />
          <Typography.Text type="secondary">{`${text.deviation}\uff1a${deviationPrefix}${deviation}%`}</Typography.Text>
        </div>
      </div>

      <div className="gantt-board__cell gantt-board__cell--timeline">
        <TimelineLane
          start={execution.planStart}
          end={execution.planEnd}
          range={range}
          days={days}
          dayColumns={dayColumns}
          tone={getExecutionTone(execution.status)}
          variant="execution"
          label={formatWindow(execution.planStart, execution.planEnd)}
          subtitle={`${text.actual}\uff1a${execution.actualProgress}% \u00b7 ${text.plan}\uff1a${execution.planProgress}%`}
        />
      </div>
    </div>
  );
}

function EmptyExecutionRow({
  boardColumns,
  days,
  dayColumns,
}: {
  boardColumns: string;
  days: TimelineDay[];
  dayColumns: string;
}) {
  return (
    <div className="gantt-board__row" style={{ gridTemplateColumns: boardColumns }}>
      <div className="gantt-board__cell">
        <div className="gantt-hierarchy gantt-hierarchy--child">
          <Space size={[8, 8]} wrap>
            <span className="gantt-hierarchy__indent" />
            <Tag>{text.rowTypeExecution}</Tag>
            <Typography.Text strong>{text.noExecutions}</Typography.Text>
          </Space>
          <Typography.Text type="secondary">{text.noExecutionsHint}</Typography.Text>
        </div>
      </div>
      <div className="gantt-board__cell">
        <Typography.Text type="secondary">-</Typography.Text>
      </div>
      <div className="gantt-board__cell">
        <Tag>{text.timelineEmpty}</Tag>
      </div>
      <div className="gantt-board__cell">
        <Typography.Text type="secondary">{text.noSchedule}</Typography.Text>
      </div>
      <div className="gantt-board__cell gantt-board__cell--timeline">
        <TimelineLane
          start=""
          end=""
          range={null}
          days={days}
          dayColumns={dayColumns}
          tone="watch"
          variant="execution"
          label={text.noSchedule}
          subtitle={text.noExecutionsHint}
        />
      </div>
    </div>
  );
}
function TimelineLane({
  start,
  end,
  range,
  days,
  dayColumns,
  tone,
  variant,
  label,
  subtitle,
}: {
  start: string;
  end: string;
  range: TimelineRange | null;
  days: TimelineDay[];
  dayColumns: string;
  tone: 'healthy' | 'watch' | 'risk';
  variant: 'project' | 'execution';
  label: string;
  subtitle: string;
}) {
  const metrics = getTimelineMetrics(start, end, range);

  return (
    <div className="gantt-lane">
      <div className="gantt-lane__grid" style={{ gridTemplateColumns: dayColumns }}>
        {days.map((day) => (
          <div
            key={day.key}
            className={[
              'gantt-lane__day',
              day.isWeekend ? 'gantt-lane__day--weekend' : '',
              day.isToday ? 'gantt-lane__day--today' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
      <div className="gantt-lane__content">
        <div className="gantt-lane__bar-wrap">
          {metrics ? (
            <div
              className={[
                'gantt-lane__bar',
                `gantt-lane__bar--${tone}`,
                `gantt-lane__bar--${variant}`,
              ].join(' ')}
              style={{ left: `${metrics.left}%`, width: `${metrics.width}%` }}
            />
          ) : (
            <div className="gantt-lane__empty" />
          )}
        </div>
        <div className="gantt-lane__meta">
          <Typography.Text>{label}</Typography.Text>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
      </div>
    </div>
  );
}

function renderViewAlert(
  view: ViewMode,
  ownerConflictCount: number,
  blockedExecutionCount: number,
  projectRiskCount: number,
  overdueProjectCount: number,
  dueSoonProjectCount: number,
) {
  if (view === 'project') {
    if (projectRiskCount > 0 || overdueProjectCount > 0) {
      return <Alert type="warning" showIcon message={text.projectAlertRiskTitle} description={text.projectAlertRiskDescription} />;
    }

    return (
      <Alert
        type="success"
        showIcon
        message={text.projectAlertStableTitle}
        description={`${text.projectAlertStableDescription} ${text.dueSoonCount} ${dueSoonProjectCount}`}
      />
    );
  }

  if (view === 'team') {
    if (ownerConflictCount > 0) {
      return <Alert type="warning" showIcon message={text.teamAlertConflictTitle} description={text.teamAlertConflictDescription} />;
    }

    return (
      <Alert
        type="success"
        showIcon
        message={text.teamAlertStableTitle}
        description={`${text.teamAlertStableDescription} ${text.blockedExecutionCount} ${blockedExecutionCount}`}
      />
    );
  }

  return <Alert type="info" showIcon message={text.executionAlertTitle} description={text.executionAlertDescription} />;
}

function buildSummaryCards(input: {
  view: ViewMode;
  projectCount: number;
  projectRiskCount: number;
  dueSoonProjectCount: number;
  overdueProjectCount: number;
  scheduledExecutionCount: number;
  ownerConflictCount: number;
  blockedExecutionCount: number;
  coveredProjectCount: number;
  taskCount: number;
  executionInProgressCount: number;
  executionDoneCount: number;
  linkedExecutionCount: number;
  projectLoading: boolean;
  teamLoading: boolean;
  executionLoading: boolean;
}): SummaryCardItem[] {
  if (input.view === 'project') {
    return [
      { title: text.projectCount, value: input.projectCount, loading: input.projectLoading },
      { title: text.riskProjectCount, value: input.projectRiskCount, loading: input.projectLoading },
      { title: text.dueSoonCount, value: input.dueSoonProjectCount, loading: input.projectLoading },
      { title: text.overdueCount, value: input.overdueProjectCount, loading: input.projectLoading },
    ];
  }

  if (input.view === 'team') {
    return [
      { title: text.scheduledExecutionCount, value: input.scheduledExecutionCount, loading: input.teamLoading },
      { title: text.conflictOwnerCount, value: input.ownerConflictCount, loading: input.teamLoading },
      { title: text.blockedExecutionCount, value: input.blockedExecutionCount, loading: input.teamLoading },
      { title: text.coveredProjectCount, value: input.coveredProjectCount, loading: input.teamLoading },
    ];
  }

  return [
    { title: text.taskCount, value: input.taskCount, loading: input.executionLoading },
    { title: text.taskInProgressCount, value: input.executionInProgressCount, loading: input.executionLoading },
    { title: text.taskDoneCount, value: input.executionDoneCount, loading: input.executionLoading },
    { title: text.linkedExecutionCount, value: input.linkedExecutionCount, loading: input.executionLoading },
  ];
}

function ProjectHealthTag({ health }: { health: ProjectScheduleItem['health'] }) {
  const config: Record<ProjectScheduleItem['health'], { color: string; label: string }> = {
    healthy: { color: 'success', label: text.healthy },
    watch: { color: 'warning', label: text.watch },
    risk: { color: 'error', label: text.risk },
  };

  const item = config[health];
  return <Tag color={item.color}>{item.label}</Tag>;
}

function ProjectMilestoneTag({ project }: { project: ProjectScheduleItem }) {
  if (project.status === 'Done') {
    return <Tag color="success">{text.done}</Tag>;
  }

  if (project.blockedExecutionCount > 0 || project.overdueCount > 0) {
    return <Tag color="error">{text.blocked}</Tag>;
  }

  if (project.dueSoonCount > 0 || project.health === 'watch') {
    return <Tag color="warning">{text.watch}</Tag>;
  }

  return <Tag color="success">{text.active}</Tag>;
}

function ScheduleProgress({ actual, plan }: { actual: number; plan: number }) {
  return (
    <Space direction="vertical" size={4} style={{ width: 180 }}>
      <div>
        <Typography.Text type="secondary">{text.actual}</Typography.Text>
        <Progress percent={actual} size="small" />
      </div>
      <div>
        <Typography.Text type="secondary">{text.plan}</Typography.Text>
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
    return text.noSchedule;
  }

  return `${start} ~ ${end}`;
}

function buildProjectExecutionGroups(projects: ProjectScheduleItem[], executions: TeamScheduleItem[]): ProjectExecutionGroup[] {
  return projects
    .map((project) => ({
      project,
      executions: executions
        .filter((execution) => execution.projectId === project.id || execution.projectName === project.name)
        .sort((left, right) => {
          const leftStart = left.planStart || '9999-12-31';
          const rightStart = right.planStart || '9999-12-31';
          if (leftStart !== rightStart) {
            return leftStart.localeCompare(rightStart);
          }

          return left.ownerName.localeCompare(right.ownerName);
        }),
    }))
    .sort((left, right) => {
      const leftStart = left.project.planStart || '9999-12-31';
      const rightStart = right.project.planStart || '9999-12-31';
      if (leftStart !== rightStart) {
        return leftStart.localeCompare(rightStart);
      }

      return left.project.name.localeCompare(right.project.name);
    });
}

function getProjectTimelineRange(groups: ProjectExecutionGroup[]): TimelineRange | null {
  const values = groups.flatMap((group) => [
    group.project.planStart,
    group.project.planEnd,
    ...group.executions.flatMap((execution) => [execution.planStart, execution.planEnd]),
  ]);
  const parsed = values.map((value) => dayjs(value)).filter((value) => value.isValid());

  if (parsed.length === 0) {
    return null;
  }

  const start = parsed.reduce((min, current) => (current.isBefore(min) ? current : min));
  let end = parsed.reduce((max, current) => (current.isAfter(max) ? current : max));
  if (end.isSame(start, 'day')) {
    end = end.add(1, 'day');
  }

  return {
    start,
    end,
    totalDays: Math.max(end.diff(start, 'day'), 1) + 1,
  };
}

function buildTimelineDays(range: TimelineRange | null): TimelineDay[] {
  if (!range) {
    return [];
  }

  return Array.from({ length: range.totalDays }, (_, index) => {
    const date = range.start.add(index, 'day');
    return {
      key: date.format('YYYY-MM-DD'),
      dayLabel: date.format('DD'),
      weekLabel: WEEKDAY_LABELS[date.day()],
      monthKey: date.format('YYYY-MM'),
      monthLabel: `${date.format('YYYY')}\u5e74${date.format('M')}\u6708`,
      isWeekend: date.day() === 0 || date.day() === 6,
      isToday: date.isSame(dayjs(), 'day'),
    };
  });
}

function buildTimelineMonthSegments(days: TimelineDay[]): TimelineMonthSegment[] {
  const segments: TimelineMonthSegment[] = [];

  days.forEach((day) => {
    const last = segments[segments.length - 1];
    if (last && last.key === day.monthKey) {
      last.span += 1;
      return;
    }

    segments.push({
      key: day.monthKey,
      label: day.monthLabel,
      span: 1,
    });
  });

  return segments;
}

function buildDayColumns(dayCount: number): string {
  return `repeat(${Math.max(dayCount, 1)}, minmax(0, 1fr))`;
}

function getTimelineWidth(range: TimelineRange | null): number {
  return Math.max((range?.totalDays ?? 0) * 44, 720);
}

function buildBoardColumns(timelineWidth: number): string {
  return `320px 140px 150px 160px ${timelineWidth}px`;
}

function getTimelineMetrics(startValue: string, endValue: string, range: TimelineRange | null): { left: number; width: number } | null {
  if (!range || !startValue || !endValue) {
    return null;
  }

  const start = dayjs(startValue);
  const end = dayjs(endValue);
  if (!start.isValid() || !end.isValid()) {
    return null;
  }

  const offsetDays = Math.max(start.diff(range.start, 'day'), 0);
  const spanDays = Math.max(end.diff(start, 'day'), 0) + 1;

  return {
    left: (offsetDays / range.totalDays) * 100,
    width: Math.max((spanDays / range.totalDays) * 100, 4),
  };
}

function getExecutionTone(status: TeamScheduleItem['status']): 'healthy' | 'watch' | 'risk' {
  if (status === 'Blocked') {
    return 'risk';
  }

  if (status === 'NotStarted' || status === 'ToVerify') {
    return 'watch';
  }

  return 'healthy';
}

function isClosedStatus(status: string): boolean {
  return status === 'Done' || status === 'Closed';
}
