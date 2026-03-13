import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Progress, Segmented, Space, Table, Tag, Typography } from 'antd';
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


type TeamScheduleRow = TeamScheduleItem & { overlapCount: number };

type ProjectExecutionGroup = {
  project: ProjectScheduleItem;
  executions: TeamScheduleRow[];
};

type OwnerExecutionGroup = {
  ownerName: string;
  executions: TeamScheduleRow[];
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
  pageDescription: '\u805a\u7126\u9879\u76ee\u8fdb\u5ea6\u4e0e\u65f6\u95f4\u5173\u7cfb\uff0c\u53ef\u6309\u9879\u76ee\u3001\u56e2\u961f\u548c\u6267\u884c\u4e09\u4e2a\u89c6\u89d2\u67e5\u770b\u6392\u671f\u3002',
  projectView: '\u9879\u76ee\u7518\u7279',
  teamView: '\u56e2\u961f\u7518\u7279',
  executionView: '\u6267\u884c\u62c6\u89e3',
  projectCardTitle: '\u9879\u76ee\u7518\u7279\u56fe',
  projectCardHint: '\u9ed8\u8ba4\u7a81\u51fa\u9879\u76ee\u4e3b\u6761\uff0c\u6267\u884c\u660e\u7ec6\u53ef\u6309\u9700\u5c55\u5f00\uff0c\u907f\u514d\u4e00\u6b21\u628a\u6240\u6709\u4fe1\u606f\u6324\u5728\u4e00\u8d77\u3002',
  teamCardTitle: '\u56e2\u961f\u6574\u4f53\u7518\u7279\u56fe',
  teamCardHint: '\u4ee5\u8d1f\u8d23\u4eba\u4e3a\u5206\u7ec4\u67e5\u770b\u56e2\u961f\u6574\u4f53\u6392\u671f\uff0c\u4e0d\u91cd\u8981\u7684\u4eba\u5458\u660e\u7ec6\u4e5f\u53ef\u4ee5\u6298\u53e0\u3002',
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
  projectAlertRiskDescription: '\u73b0\u5728\u53ef\u4ee5\u5148\u770b\u9879\u76ee\u4e3b\u6761\uff0c\u6709\u95ee\u9898\u7684\u9879\u76ee\u518d\u5c55\u5f00\u6267\u884c\u660e\u7ec6\u8ddf\u5230\u4eba\u548c\u65f6\u6bb5\u3002',
  projectAlertStableTitle: '\u9879\u76ee\u5c42\u65f6\u95f4\u5173\u7cfb\u5df2\u7ecf\u6e05\u6670\u5c55\u5f00',
  projectAlertStableDescription: '\u4fdd\u6301\u6298\u53e0\u975e\u5173\u952e\u660e\u7ec6\uff0c\u5c55\u5f00\u91cd\u70b9\u9879\u76ee\u65f6\u53ef\u4ee5\u66f4\u5feb\u770b\u5230\u4eba\u4e0e\u65f6\u95f4\u7684\u5bf9\u5e94\u3002',
  teamAlertConflictTitle: '\u68c0\u6d4b\u5230\u8d1f\u8d23\u4eba\u6392\u671f\u91cd\u53e0',
  teamAlertConflictDescription: '\u8bf7\u4f18\u5148\u5c55\u5f00\u51b2\u7a81\u8d1f\u8d23\u4eba\uff0c\u67e5\u770b\u540c\u4e00\u65f6\u95f4\u7a97\u5185\u7684\u591a\u4e2a\u6267\u884c\u5b89\u6392\u3002',
  teamAlertStableTitle: '\u5f53\u524d\u672a\u53d1\u73b0\u56e2\u961f\u7ea7\u6392\u671f\u51b2\u7a81',
  teamAlertStableDescription: '\u4fdd\u6301\u56e2\u961f\u89c6\u89d2\u7684\u6298\u53e0\u67e5\u770b\uff0c\u9700\u8981\u65f6\u518d\u5c55\u5f00\u8d1f\u8d23\u4eba\u660e\u7ec6\u3002',
  executionAlertTitle: '\u6267\u884c\u62c6\u89e3\u89c6\u56fe\u7528\u4e8e\u8ddf\u8e2a\u6700\u7ec6\u9897\u7c92\u5ea6\u7684\u63a8\u8fdb\u60c5\u51b5',
  executionAlertDescription: '\u8fd9\u4e00\u5c42\u4e3b\u8981\u7528\u6765\u5bf9\u7167\u9879\u76ee\u7518\u7279\u4e2d\u7684\u6267\u884c\u6761\u3002',
  hierarchy: '\u9879\u76ee / \u6267\u884c',
  owner: '\u8d1f\u8d23\u4eba',
  linkedProject: '\u6240\u5c5e\u9879\u76ee',
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
  inheritWindow: '\u7ee7\u627f\u65f6\u95f4\u7a97',
  planWindow: '\u8ba1\u5212\u7a97\u53e3',
  projectOwner: '\u9879\u76ee\u8d1f\u8d23\u4eba',
  latestActivity: '\u6700\u8fd1\u6d3b\u52a8',
  summaryHint: '\u6c47\u603b\u65f6\u95f4\u7a97',
  rowTypeProject: '\u9879\u76ee',
  rowTypeExecution: '\u6267\u884c',
  rowTypeOwner: '\u8d1f\u8d23\u4eba',
  riskAndBug: '\u98ce\u9669 / \u7f3a\u9677',
  deviation: '\u8fdb\u5ea6\u504f\u5dee',
  timelineEmpty: '\u6682\u65e0\u6392\u671f',
  executionCount: '\u6267\u884c\u6570',
  hiddenExecutionCount: '\u5df2\u6298\u53e0\u6267\u884c',
  expand: '\u5c55\u5f00',
  collapse: '\u6536\u8d77',
  emptyProjectGantt: '\u6682\u65e0\u53ef\u5c55\u793a\u7684\u9879\u76ee\u6392\u671f',
  emptyTeamGantt: '\u6682\u65e0\u53ef\u5c55\u793a\u7684\u56e2\u961f\u6392\u671f',
  noCode: '\u672a\u8bbe\u7f6e\u7f16\u7801',
  noActivity: '\u6682\u65e0\u66f4\u65b0',
  noSchedule: '\u672a\u6392\u671f',
  noExecutions: '\u6682\u65e0\u6267\u884c\u6392\u671f',
  noExecutionsHint: '\u8fd9\u4e2a\u5206\u7ec4\u6682\u65f6\u6ca1\u6709\u9700\u8981\u5c55\u793a\u7684\u6267\u884c\u660e\u7ec6\u3002',
  healthy: '\u5065\u5eb7',
  watch: '\u5173\u6ce8',
  risk: '\u98ce\u9669',
  done: '\u5df2\u5b8c\u6210',
  blocked: '\u6709\u963b\u585e',
  active: '\u8fdb\u884c\u4e2d',
  loadingProjectGantt: '\u6b63\u5728\u52a0\u8f7d\u9879\u76ee\u7518\u7279\u6570\u636e...',
} as const;

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
  const projectGroups = useMemo(() => buildProjectExecutionGroups(projectRows, teamRows), [projectRows, teamRows]);
  const ownerGroups = useMemo(() => buildOwnerExecutionGroups(teamRows), [teamRows]);
  const projectRange = useMemo(() => getProjectTimelineRange(projectGroups), [projectGroups]);
  const teamRange = useMemo(() => getOwnerTimelineRange(ownerGroups), [ownerGroups]);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [expandedOwners, setExpandedOwners] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedProjects((previous) => {
      const next: Record<number, boolean> = {};
      projectGroups.forEach((group, index) => {
        next[group.project.id] = previous[group.project.id] ?? shouldExpandProject(group.project, index);
      });
      return next;
    });
  }, [projectGroups]);

  useEffect(() => {
    setExpandedOwners((previous) => {
      const next: Record<string, boolean> = {};
      ownerGroups.forEach((group, index) => {
        next[group.ownerName] = previous[group.ownerName] ?? shouldExpandOwner(group, index);
      });
      return next;
    });
  }, [ownerGroups]);

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


      {view === 'project' ? (
        <Card title={text.projectCardTitle} styles={{ body: { padding: 0 } }}>
          <ProjectGanttBoard
            groups={projectGroups}
            range={projectRange}
            loading={projectQuery.isLoading || teamQuery.isLoading}
            expandedState={expandedProjects}
            onToggle={(projectId) =>
              setExpandedProjects((previous) => ({
                ...previous,
                [projectId]: !previous[projectId],
              }))
            }
          />
        </Card>
      ) : null}

      {view === 'team' ? (
        <Card title={text.teamCardTitle} styles={{ body: { padding: 0 } }}>
          <TeamGanttBoard
            groups={ownerGroups}
            range={teamRange}
            loading={teamQuery.isLoading}
            expandedState={expandedOwners}
            onToggle={(ownerName) =>
              setExpandedOwners((previous) => ({
                ...previous,
                [ownerName]: !previous[ownerName],
              }))
            }
          />
        </Card>
      ) : null}

      {view === 'execution' ? (
        <Card title={text.executionCardTitle}>
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
  expandedState,
  onToggle,
}: {
  groups: ProjectExecutionGroup[];
  range: TimelineRange | null;
  loading: boolean;
  expandedState: Record<number, boolean>;
  onToggle: (projectId: number) => void;
}) {
  const days = useMemo(() => buildTimelineDays(range), [range]);
  const monthSegments = useMemo(() => buildTimelineMonthSegments(days), [days]);
  const timelineWidth = useMemo(() => getTimelineWidth(range), [range]);
  const boardColumns = useMemo(() => buildBoardColumns(timelineWidth), [timelineWidth]);
  const dayColumns = useMemo(() => buildDayColumns(days.length), [days.length]);

  if (loading) {
    return <Typography.Text type="secondary" style={{ padding: 16, display: 'block' }}>{text.loadingProjectGantt}</Typography.Text>;
  }

  if (groups.length === 0) {
    return <Typography.Text type="secondary" style={{ padding: 16, display: 'block' }}>{text.emptyProjectGantt}</Typography.Text>;
  }

  return (
    <div className="gantt-board">
      <div className="gantt-board__viewport">
        <div className="gantt-board__row gantt-board__row--header" style={{ gridTemplateColumns: boardColumns }}>
          <div className="gantt-board__head">{text.hierarchy}</div>
          <div className="gantt-board__head">{text.owner}</div>
          <div className="gantt-board__head">{text.progress}</div>
          <div className="gantt-board__head gantt-board__head--timeline">
            <TimelineAxis days={days} monthSegments={monthSegments} dayColumns={dayColumns} />
          </div>
        </div>

        {groups.map((group) => {
          const expanded = expandedState[group.project.id] ?? true;
          return (
            <Fragment key={group.project.id}>
              <ProjectTimelineRow
                group={group}
                range={range}
                days={days}
                dayColumns={dayColumns}
                boardColumns={boardColumns}
                expanded={expanded}
                onToggle={() => onToggle(group.project.id)}
              />
              {expanded
                ? group.executions.map((execution) => (
                    <ProjectExecutionRow
                      key={execution.id}
                      execution={execution}
                      range={range}
                      days={days}
                      dayColumns={dayColumns}
                      boardColumns={boardColumns}
                    />
                  ))
                : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function TeamGanttBoard({
  groups,
  range,
  loading,
  expandedState,
  onToggle,
}: {
  groups: OwnerExecutionGroup[];
  range: TimelineRange | null;
  loading: boolean;
  expandedState: Record<string, boolean>;
  onToggle: (ownerName: string) => void;
}) {
  const days = useMemo(() => buildTimelineDays(range), [range]);
  const monthSegments = useMemo(() => buildTimelineMonthSegments(days), [days]);
  const timelineWidth = useMemo(() => getTimelineWidth(range), [range]);
  const boardColumns = useMemo(() => buildBoardColumns(timelineWidth), [timelineWidth]);
  const dayColumns = useMemo(() => buildDayColumns(days.length), [days.length]);

  if (loading) {
    return <Typography.Text type="secondary" style={{ padding: 16, display: 'block' }}>{text.loadingProjectGantt}</Typography.Text>;
  }

  if (groups.length === 0) {
    return <Typography.Text type="secondary" style={{ padding: 16, display: 'block' }}>{text.emptyTeamGantt}</Typography.Text>;
  }

  return (
    <div className="gantt-board">
      <div className="gantt-board__viewport">
        <div className="gantt-board__row gantt-board__row--header" style={{ gridTemplateColumns: boardColumns }}>
          <div className="gantt-board__head">{text.hierarchy}</div>
          <div className="gantt-board__head">{text.linkedProject}</div>
          <div className="gantt-board__head">{text.progress}</div>
          <div className="gantt-board__head gantt-board__head--timeline">
            <TimelineAxis days={days} monthSegments={monthSegments} dayColumns={dayColumns} />
          </div>
        </div>

        {groups.map((group) => {
          const expanded = expandedState[group.ownerName] ?? true;
          return (
            <Fragment key={group.ownerName}>
              <OwnerTimelineRow
                group={group}
                range={range}
                days={days}
                dayColumns={dayColumns}
                boardColumns={boardColumns}
                expanded={expanded}
                onToggle={() => onToggle(group.ownerName)}
              />
              {expanded
                ? group.executions.map((execution) => (
                    <OwnerExecutionRow
                      key={execution.id}
                      execution={execution}
                      range={range}
                      days={days}
                      dayColumns={dayColumns}
                      boardColumns={boardColumns}
                    />
                  ))
                : null}
            </Fragment>
          );
        })}
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
            ].filter(Boolean).join(' ')}
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
  expanded,
  onToggle,
}: {
  group: ProjectExecutionGroup;
  range: TimelineRange | null;
  days: TimelineDay[];
  dayColumns: string;
  boardColumns: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const subtitle = `${group.project.code || text.noCode} \u00b7 ${text.executionCount} ${group.executions.length}`;
  const timelineSubtitle =
    group.project.blockedExecutionCount > 0
      ? `${text.progress}\uff1a${group.project.averageProgress}% \u00b7 ${text.blocked} ${group.project.blockedExecutionCount}`
      : `${text.progress}\uff1a${group.project.averageProgress}%`;

  return (
    <div className="gantt-board__row gantt-board__row--project" style={{ gridTemplateColumns: boardColumns }}>
      <div className="gantt-board__cell gantt-board__cell--project">
        <div className="gantt-hierarchy">
          <Space size={[8, 8]} wrap className="gantt-hierarchy__header">
            <Button type="text" size="small" onClick={onToggle}>{expanded ? text.collapse : text.expand}</Button>
            <Typography.Text strong>{group.project.name}</Typography.Text>
            <ProjectHealthTag health={group.project.health} />
          </Space>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
          {!expanded ? <Typography.Text type="secondary">{`${text.hiddenExecutionCount}\uff1a${group.executions.length}`}</Typography.Text> : null}
        </div>
      </div>
      <div className="gantt-board__cell gantt-board__cell--project">
        <Typography.Text strong>{group.project.ownerName || '-'}</Typography.Text>
      </div>
      <div className="gantt-board__cell gantt-board__cell--project">
        <div className="gantt-progress-cell">
          <Typography.Text strong>{`${group.project.averageProgress}%`}</Typography.Text>
          <Progress percent={group.project.averageProgress} size="small" />
          <Typography.Text type="secondary">{`${text.executionCount}\uff1a${group.executions.length}`}</Typography.Text>
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
          subtitle={timelineSubtitle}
        />
      </div>
    </div>
  );
}
function ProjectExecutionRow({
  execution,
  range,
  days,
  dayColumns,
  boardColumns,
}: {
  execution: TeamScheduleRow;
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
            <Typography.Text strong>{execution.name}</Typography.Text>
            <StatusTag value={execution.status} />
          </Space>
        </div>
      </div>
      <div className="gantt-board__cell">
        <Typography.Text>{execution.ownerName || '-'}</Typography.Text>
      </div>
      <div className="gantt-board__cell">
        <div className="gantt-progress-cell">
          <Typography.Text strong>{`${execution.actualProgress}%`}</Typography.Text>
          <Progress percent={execution.actualProgress} size="small" />
          <Typography.Text type="secondary">{`${text.plan}\uff1a${execution.planProgress}%`}</Typography.Text>
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
          subtitle={`${text.deviation}\uff1a${deviationPrefix}${deviation}%`}
        />
      </div>
    </div>
  );
}
function OwnerTimelineRow({
  group,
  range,
  days,
  dayColumns,
  boardColumns,
  expanded,
  onToggle,
}: {
  group: OwnerExecutionGroup;
  range: TimelineRange | null;
  days: TimelineDay[];
  dayColumns: string;
  boardColumns: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const window = getExecutionWindow(group.executions);
  const averageActual = Math.round(group.executions.reduce((sum, item) => sum + item.actualProgress, 0) / Math.max(group.executions.length, 1));
  const overlapCount = group.executions.filter((item) => item.overlapCount > 0).length;
  const projectNames = group.executions
    .map((item) => item.projectName)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  const projectLabel = projectNames.length <= 1 ? projectNames[0] || '-' : `${projectNames.length} ${text.projectCount}`;
  const timelineSubtitle = overlapCount > 0 ? `${text.overlap}\uff1a${overlapCount} \u00b7 ${text.progress}\uff1a${averageActual}%` : `${text.progress}\uff1a${averageActual}%`;

  return (
    <div className="gantt-board__row gantt-board__row--owner" style={{ gridTemplateColumns: boardColumns }}>
      <div className="gantt-board__cell gantt-board__cell--owner">
        <div className="gantt-hierarchy">
          <Space size={[8, 8]} wrap className="gantt-hierarchy__header">
            <Button type="text" size="small" onClick={onToggle}>{expanded ? text.collapse : text.expand}</Button>
            <Typography.Text strong>{group.ownerName || '-'}</Typography.Text>
            {overlapCount > 0 ? <Tag color="error">{`${text.overlapPrefix} ${overlapCount}`}</Tag> : null}
          </Space>
          <Typography.Text type="secondary">{`${text.executionCount}\uff1a${group.executions.length}`}</Typography.Text>
          {!expanded ? <Typography.Text type="secondary">{`${text.hiddenExecutionCount}\uff1a${group.executions.length}`}</Typography.Text> : null}
        </div>
      </div>
      <div className="gantt-board__cell gantt-board__cell--owner">
        <Typography.Text>{projectLabel}</Typography.Text>
      </div>
      <div className="gantt-board__cell gantt-board__cell--owner">
        <div className="gantt-progress-cell">
          <Typography.Text strong>{`${averageActual}%`}</Typography.Text>
          <Progress percent={averageActual} size="small" />
          <Typography.Text type="secondary">{`${text.executionCount}\uff1a${group.executions.length}`}</Typography.Text>
        </div>
      </div>
      <div className="gantt-board__cell gantt-board__cell--timeline gantt-board__cell--owner">
        <TimelineLane
          start={window.start}
          end={window.end}
          range={range}
          days={days}
          dayColumns={dayColumns}
          tone={overlapCount > 0 ? 'watch' : 'healthy'}
          variant="project"
          label={formatWindow(window.start, window.end)}
          subtitle={timelineSubtitle}
        />
      </div>
    </div>
  );
}
function OwnerExecutionRow({
  execution,
  range,
  days,
  dayColumns,
  boardColumns,
}: {
  execution: TeamScheduleRow;
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
            <Typography.Text strong>{execution.name}</Typography.Text>
            <StatusTag value={execution.status} />
          </Space>
        </div>
      </div>
      <div className="gantt-board__cell">
        <Typography.Text>{execution.projectName || '-'}</Typography.Text>
      </div>
      <div className="gantt-board__cell">
        <div className="gantt-progress-cell">
          <Typography.Text strong>{`${execution.actualProgress}%`}</Typography.Text>
          <Progress percent={execution.actualProgress} size="small" />
          <Typography.Text type="secondary">{`${text.plan}\uff1a${execution.planProgress}%`}</Typography.Text>
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
          subtitle={`${text.deviation}\uff1a${deviationPrefix}${deviation}%`}
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
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>
      <div className="gantt-lane__content">
        <div className="gantt-lane__bar-wrap">
          {metrics ? (
            <div
              className={['gantt-lane__bar', `gantt-lane__bar--${tone}`, `gantt-lane__bar--${variant}`].join(' ')}
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

function ProjectHealthTag({ health }: { health: ProjectScheduleItem['health'] }) {
  const config: Record<ProjectScheduleItem['health'], { color: string; label: string }> = {
    healthy: { color: 'success', label: text.healthy },
    watch: { color: 'warning', label: text.watch },
    risk: { color: 'error', label: text.risk },
  };

  const item = config[health];
  return <Tag color={item.color}>{item.label}</Tag>;
}

function withOverlapCount(items: TeamScheduleItem[]): TeamScheduleRow[] {
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

function buildProjectExecutionGroups(projects: ProjectScheduleItem[], executions: TeamScheduleRow[]): ProjectExecutionGroup[] {
  return projects
    .map((project) => ({
      project,
      executions: executions
        .filter((execution) => execution.projectId === project.id || execution.projectName === project.name)
        .sort((left, right) => sortByWindow(left.planStart, right.planStart, left.ownerName, right.ownerName)),
    }))
    .sort((left, right) => sortByWindow(left.project.planStart, right.project.planStart, left.project.name, right.project.name));
}

function buildOwnerExecutionGroups(executions: TeamScheduleRow[]): OwnerExecutionGroup[] {
  const grouped = new Map<string, TeamScheduleRow[]>();
  executions.forEach((execution) => {
    const ownerName = execution.ownerName || '-';
    const existing = grouped.get(ownerName) ?? [];
    existing.push(execution);
    grouped.set(ownerName, existing);
  });

  return Array.from(grouped.entries())
    .map(([ownerName, items]) => ({
      ownerName,
      executions: items.sort((left, right) => sortByWindow(left.planStart, right.planStart, left.name, right.name)),
    }))
    .sort((left, right) => sortByWindow(getExecutionWindow(left.executions).start, getExecutionWindow(right.executions).start, left.ownerName, right.ownerName));
}

function sortByWindow(leftStart: string, rightStart: string, leftFallback: string, rightFallback: string): number {
  const normalizedLeft = leftStart || '9999-12-31';
  const normalizedRight = rightStart || '9999-12-31';
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft.localeCompare(normalizedRight);
  }
  return leftFallback.localeCompare(rightFallback);
}

function getProjectTimelineRange(groups: ProjectExecutionGroup[]): TimelineRange | null {
  const values = groups.flatMap((group) => [
    group.project.planStart,
    group.project.planEnd,
    ...group.executions.flatMap((execution) => [execution.planStart, execution.planEnd]),
  ]);
  return buildTimelineRange(values);
}

function getOwnerTimelineRange(groups: OwnerExecutionGroup[]): TimelineRange | null {
  const values = groups.flatMap((group) => group.executions.flatMap((execution) => [execution.planStart, execution.planEnd]));
  return buildTimelineRange(values);
}

function buildTimelineRange(values: string[]): TimelineRange | null {
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
    segments.push({ key: day.monthKey, label: day.monthLabel, span: 1 });
  });
  return segments;
}

function buildDayColumns(dayCount: number): string {
  return `repeat(${Math.max(dayCount, 1)}, minmax(0, 1fr))`;
}

function getTimelineWidth(range: TimelineRange | null): number {
  return Math.max((range?.totalDays ?? 0) * 56, 960);
}

function buildBoardColumns(timelineWidth: number): string {
  return `360px 180px 200px ${timelineWidth}px`;
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

function getExecutionWindow(executions: TeamScheduleRow[]): { start: string; end: string } {
  if (executions.length === 0) {
    return { start: '', end: '' };
  }

  const start = executions.map((item) => item.planStart || '9999-12-31').sort()[0] ?? '';
  const end = executions.map((item) => item.planEnd || '').sort().reverse()[0] ?? '';
  return { start, end };
}

function shouldExpandProject(project: ProjectScheduleItem, index: number): boolean {
  if (index === 0) {
    return true;
  }
  return project.health !== 'healthy' || project.blockedExecutionCount > 0 || project.dueSoonCount > 0 || project.overdueCount > 0;
}

function shouldExpandOwner(group: OwnerExecutionGroup, index: number): boolean {
  if (index === 0) {
    return true;
  }
  return group.executions.some((item) => item.overlapCount > 0 || item.status === 'Blocked');
}

