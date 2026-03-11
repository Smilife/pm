import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, DatePicker, Progress, Row, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { pmApi } from '../services/api';
import type { PerformanceLevel, PerformanceMemberRecord } from '../services/types';
import { useAuthStore } from '../store/authStore';

const text = {
  pageTitle: '\u4eba\u5458\u7ee9\u6548',
  teamDescription: '\u9762\u5411\u7ba1\u7406\u8005\u7684\u4eba\u5458\u7ee9\u6548\u770b\u677f\uff0c\u6309\u65f6\u5b8c\u6210\u3001\u65e5\u66f4\u65b0\u3001\u5de5\u65f6\u6295\u5165\u4e0e\u6392\u540d\u5bf9\u6bd4\u4e00\u5c4f\u67e5\u770b\u3002',
  personalDescription: '\u805a\u7126\u6211\u7684\u4ea4\u4ed8\u8282\u594f\u4e0e\u65e5\u66f4\u65b0\u60c5\u51b5\uff0c\u53ea\u663e\u793a\u672c\u4eba\u7ee9\u6548\u6570\u636e\u3002',
  teamMode: '\u56e2\u961f\u7ba1\u7406\u89c6\u89d2',
  personalMode: '\u4e2a\u4eba\u7ee9\u6548\u89c6\u89d2',
  modeHintTeam: '\u53ef\u4ee5\u6309\u65f6\u95f4\u6bb5\u67e5\u770b\u6210\u5458\u7ee9\u6548\u3001\u6392\u540d\u548c\u5bf9\u6bd4\u3002',
  modeHintPersonal: '\u5f53\u524d\u53ea\u8fd4\u56de\u672c\u4eba\u6570\u636e\uff0c\u4e0d\u5c55\u793a\u5176\u4ed6\u6210\u5458\u6392\u540d\u3002',
  executionList: '\u6267\u884c\u5217\u8868',
  weeklyReport: '\u5468\u62a5',
  memberCount: '\u7eb3\u5165\u8bc4\u4f30\u6210\u5458',
  averageScore: '\u5e73\u5747\u7ee9\u6548\u5f97\u5206',
  averageOnTimeRate: '\u5e73\u5747\u6309\u65f6\u7387',
  averageUpdateRate: '\u5e73\u5747\u66f4\u65b0\u8986\u76d6\u7387',
  totalHours: '\u7edf\u8ba1\u5de5\u65f6',
  overdueItems: '\u903e\u671f\u4e8b\u9879',
  myScore: '\u6211\u7684\u7ee9\u6548\u5f97\u5206',
  myOnTimeRate: '\u6211\u7684\u6309\u65f6\u7387',
  myUpdateRate: '\u6211\u7684\u66f4\u65b0\u8986\u76d6\u7387',
  myHours: '\u6211\u7684\u5de5\u65f6',
  myDueItems: '\u6211\u7684\u5230\u671f\u4e8b\u9879',
  toolbarTitle: '\u7edf\u8ba1\u8303\u56f4',
  rangeLabel: '\u65f6\u95f4\u8303\u56f4',
  levelLabel: '\u7ee9\u6548\u72b6\u6001',
  compareLabel: '\u5bf9\u6bd4\u6210\u5458',
  levelAll: '\u5168\u90e8\u72b6\u6001',
  levelExcellent: '\u4f18\u79c0',
  levelSteady: '\u7a33\u5b9a',
  levelWatch: '\u9700\u5173\u6ce8',
  levelRisk: '\u9884\u8b66',
  rankingTitle: '\u7ee9\u6548\u6392\u540d',
  rankingSubtitle: '\u6309\u7efc\u5408\u5f97\u5206\u3001\u6309\u65f6\u7387\u548c\u66f4\u65b0\u8986\u76d6\u7387\u6392\u5e8f',
  compareTitle: '\u6210\u5458\u5bf9\u6bd4',
  selfTitle: '\u6211\u7684\u7ee9\u6548\u89e3\u8bfb',
  noCompare: '\u6682\u65e0\u53ef\u5bf9\u6bd4\u7684\u6210\u5458\u6570\u636e\u3002',
  noData: '\u5f53\u524d\u65f6\u95f4\u6bb5\u6682\u65e0\u7ee9\u6548\u6570\u636e\u3002',
  rankColumn: '\u6392\u540d',
  memberColumn: '\u6210\u5458',
  scoreColumn: '\u5f97\u5206',
  onTimeColumn: '\u6309\u65f6\u7387',
  updateRateColumn: '\u66f4\u65b0\u8986\u76d6\u7387',
  hoursColumn: '\u7edf\u8ba1\u5de5\u65f6',
  dueItemColumn: '\u5230\u671f\u4e8b\u9879',
  overdueColumn: '\u903e\u671f\u4e8b\u9879',
  projectCountColumn: '\u53c2\u4e0e\u9879\u76ee',
  projectsColumn: '\u5173\u8054\u9879\u76ee',
  comparePlaceholder: '\u9009\u62e9 1-3 \u4f4d\u6210\u5458\u8fdb\u884c\u5bf9\u6bd4',
  rankSuffix: '\u540d',
  peopleSuffix: '\u4eba',
  itemSuffix: '\u9879',
  hourSuffix: 'h',
  daySuffix: '\u5929',
  updateDays: '\u66f4\u65b0\u5929\u6570',
  activeProjects: '\u5728\u624b\u9879\u76ee',
  activeExecutions: '\u5728\u624b\u6267\u884c',
  completedItems: '\u5df2\u5b8c\u6210\u4e8b\u9879',
  compareHint: '\u7efc\u5408\u5bf9\u6bd4\u6309\u65f6\u5b8c\u6210\u3001\u65e5\u66f4\u65b0\u9891\u7387\u548c\u5de5\u65f6\u6295\u5165\u3002',
  selfHint: '\u8fd9\u4e2a\u89c6\u56fe\u53ef\u4ee5\u7528\u6765\u68c0\u67e5\u81ea\u5df1\u5728\u4e0d\u540c\u65f6\u95f4\u6bb5\u7684\u4ea4\u4ed8\u8282\u594f\u3002',
  statusActive: '\u5728\u5c97',
  statusInvited: '\u5f85\u6fc0\u6d3b',
  notRegistered: '\u672a\u767b\u8bb0\u90ae\u7bb1',
  projectEmpty: '\u6682\u65e0\u9879\u76ee',
} as const;

const levelOptions = [
  { label: text.levelAll, value: 'all' },
  { label: text.levelExcellent, value: 'excellent' },
  { label: text.levelSteady, value: 'steady' },
  { label: text.levelWatch, value: 'watch' },
  { label: text.levelRisk, value: 'risk' },
] as const;

const levelColorMap: Record<PerformanceLevel, string> = {
  excellent: 'success',
  steady: 'processing',
  watch: 'warning',
  risk: 'error',
};

const levelLabelMap: Record<PerformanceLevel, string> = {
  excellent: text.levelExcellent,
  steady: text.levelSteady,
  watch: text.levelWatch,
  risk: text.levelRisk,
};

type SummaryCardItem = {
  key: string;
  title: string;
  value: number;
  suffix?: string;
  hint: string;
};

export function PerformancePage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.permissions);
  const canViewExecutions = permissions.includes('execution.view.related');
  const canViewWeeklyReport = permissions.includes('report.weekly.generate.self');
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(13, 'day'), dayjs()]);
  const [levelFilter, setLevelFilter] = useState<'all' | PerformanceLevel>('all');
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const start = range[0].format('YYYY-MM-DD');
  const end = range[1].format('YYYY-MM-DD');
  const performanceQuery = useQuery({
    queryKey: ['performance-dashboard', start, end],
    queryFn: () => pmApi.getPerformanceDashboard({ start, end }),
  });

  const dashboard = performanceQuery.data;
  const ranking = dashboard?.ranking ?? [];
  const isTeamDashboard = dashboard?.dashboardMode !== 'personal';
  const selfRecord = ranking[0];

  useEffect(() => {
    if (ranking.length === 0) {
      setCompareIds([]);
      return;
    }

    setCompareIds((current) => {
      const valid = current.filter((id) => ranking.some((item) => item.id === id));
      if (valid.length > 0) {
        return valid.slice(0, isTeamDashboard ? 3 : 1);
      }

      const defaults = (dashboard?.compareDefaultIds ?? []).filter((id) => ranking.some((item) => item.id === id));
      if (defaults.length > 0) {
        return defaults.slice(0, isTeamDashboard ? 3 : 1);
      }

      return ranking.slice(0, isTeamDashboard ? 3 : 1).map((item) => item.id);
    });
  }, [dashboard?.compareDefaultIds, isTeamDashboard, ranking]);

  const filteredRanking = useMemo(() => {
    if (levelFilter === 'all') {
      return ranking;
    }

    return ranking.filter((item) => item.level === levelFilter);
  }, [levelFilter, ranking]);

  const compareCandidates = useMemo(
    () => ranking.map((item) => ({ label: item.name, value: item.id })),
    [ranking],
  );

  const compareMembers = useMemo(() => {
    const selected = ranking.filter((item) => compareIds.includes(item.id));
    if (selected.length > 0) {
      return selected;
    }

    return ranking.slice(0, isTeamDashboard ? 3 : 1);
  }, [compareIds, isTeamDashboard, ranking]);

  const summaryCards = useMemo<SummaryCardItem[]>(() => {
    if (isTeamDashboard) {
      return [
        {
          key: 'memberCount',
          title: text.memberCount,
          value: dashboard?.summary.memberCount ?? 0,
          suffix: text.peopleSuffix,
          hint: text.rankingSubtitle,
        },
        {
          key: 'averageScore',
          title: text.averageScore,
          value: dashboard?.summary.averageScore ?? 0,
          suffix: text.rankSuffix,
          hint: text.compareHint,
        },
        {
          key: 'averageOnTimeRate',
          title: text.averageOnTimeRate,
          value: dashboard?.summary.averageOnTimeRate ?? 0,
          suffix: '%',
          hint: text.compareHint,
        },
        {
          key: 'averageUpdateRate',
          title: text.averageUpdateRate,
          value: dashboard?.summary.averageUpdateRate ?? 0,
          suffix: '%',
          hint: text.compareHint,
        },
        {
          key: 'totalHours',
          title: text.totalHours,
          value: dashboard?.summary.totalHours ?? 0,
          suffix: text.hourSuffix,
          hint: text.compareHint,
        },
        {
          key: 'overdueItems',
          title: text.overdueItems,
          value: dashboard?.summary.overdueItemCount ?? 0,
          suffix: text.itemSuffix,
          hint: text.compareHint,
        },
      ];
    }

    return [
      {
        key: 'myScore',
        title: text.myScore,
        value: selfRecord?.score ?? 0,
        suffix: text.rankSuffix,
        hint: text.selfHint,
      },
      {
        key: 'myOnTimeRate',
        title: text.myOnTimeRate,
        value: selfRecord?.onTimeRate ?? 0,
        suffix: '%',
        hint: text.selfHint,
      },
      {
        key: 'myUpdateRate',
        title: text.myUpdateRate,
        value: selfRecord?.updateRate ?? 0,
        suffix: '%',
        hint: text.selfHint,
      },
      {
        key: 'myHours',
        title: text.myHours,
        value: selfRecord?.totalHours ?? 0,
        suffix: text.hourSuffix,
        hint: text.selfHint,
      },
      {
        key: 'myDueItems',
        title: text.myDueItems,
        value: selfRecord?.dueItemCount ?? 0,
        suffix: text.itemSuffix,
        hint: text.selfHint,
      },
    ];
  }, [dashboard?.summary, isTeamDashboard, selfRecord]);

  const columns: ColumnsType<PerformanceMemberRecord> = [
    {
      title: text.rankColumn,
      dataIndex: 'rank',
      width: 88,
      sorter: (left, right) => left.rank - right.rank,
      render: (value: number) => <Tag color={value <= 3 ? 'gold' : 'default'}>{`#${value}`}</Tag>,
    },
    {
      title: text.memberColumn,
      dataIndex: 'name',
      width: 220,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.email || text.notRegistered}</Typography.Text>
          <Typography.Text type="secondary">{`${record.department} / ${record.title}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: text.scoreColumn,
      dataIndex: 'score',
      width: 180,
      sorter: (left, right) => left.score - right.score,
      defaultSortOrder: 'descend',
      render: (_value, record) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size={8}>
            <Typography.Text strong>{record.score}</Typography.Text>
            <Tag color={levelColorMap[record.level]}>{levelLabelMap[record.level]}</Tag>
          </Space>
          <Progress percent={record.score} size="small" showInfo={false} />
        </Space>
      ),
    },
    {
      title: text.onTimeColumn,
      dataIndex: 'onTimeRate',
      width: 180,
      sorter: (left, right) => left.onTimeRate - right.onTimeRate,
      render: (value: number) => <Progress percent={value} size="small" />,
    },
    {
      title: text.updateRateColumn,
      dataIndex: 'updateRate',
      width: 180,
      sorter: (left, right) => left.updateRate - right.updateRate,
      render: (value: number) => <Progress percent={value} size="small" strokeColor="#2da895" />,
    },
    {
      title: text.hoursColumn,
      dataIndex: 'totalHours',
      width: 120,
      sorter: (left, right) => left.totalHours - right.totalHours,
      render: (value: number) => `${value.toFixed(1)} ${text.hourSuffix}`,
    },
    { title: text.dueItemColumn, dataIndex: 'dueItemCount', width: 110, sorter: (left, right) => left.dueItemCount - right.dueItemCount },
    { title: text.overdueColumn, dataIndex: 'overdueItemCount', width: 110, sorter: (left, right) => left.overdueItemCount - right.overdueItemCount },
    { title: text.projectCountColumn, dataIndex: 'activeProjectCount', width: 110, sorter: (left, right) => left.activeProjectCount - right.activeProjectCount },
    {
      title: text.projectsColumn,
      dataIndex: 'projectNames',
      width: 220,
      render: (value: string[]) => (value.length > 0 ? value.join(' / ') : text.projectEmpty),
    },
  ];

  return (
    <Space direction="vertical" size={20} className="page-stack">
      <PageHeader
        title={text.pageTitle}
        description={isTeamDashboard ? text.teamDescription : text.personalDescription}
        extra={
          <Space wrap>
            {canViewExecutions ? <Button onClick={() => navigate('/executions')}>{text.executionList}</Button> : null}
            {canViewWeeklyReport ? <Button onClick={() => navigate('/reports/weekly')}>{text.weeklyReport}</Button> : null}
          </Space>
        }
      />
      <Card className="workspace-mode-card" bodyStyle={{ padding: 16 }}>
        <Space wrap size={[12, 12]}>
          <Tag color={isTeamDashboard ? 'processing' : 'default'}>{isTeamDashboard ? text.teamMode : text.personalMode}</Tag>
          <Typography.Text type="secondary">{isTeamDashboard ? text.modeHintTeam : text.modeHintPersonal}</Typography.Text>
        </Space>
      </Card>
      <Card>
        <div className="page-toolbar">
          <Space wrap>
            <div>
              <Typography.Text type="secondary">{text.rangeLabel}</Typography.Text>
              <div>
                <DatePicker.RangePicker
                  allowClear={false}
                  value={range}
                  onChange={(values) => {
                    if (values && values[0] && values[1]) {
                      setRange([values[0], values[1]]);
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">{text.levelLabel}</Typography.Text>
              <div>
                <Select
                  value={levelFilter}
                  onChange={(value) => setLevelFilter(value)}
                  style={{ width: 160 }}
                  options={levelOptions.map((item) => ({ ...item }))}
                />
              </div>
            </div>
            {isTeamDashboard ? (
              <div>
                <Typography.Text type="secondary">{text.compareLabel}</Typography.Text>
                <div>
                  <Select
                    mode="multiple"
                    maxCount={3}
                    value={compareIds}
                    onChange={(value) => setCompareIds(value)}
                    style={{ minWidth: 280 }}
                    placeholder={text.comparePlaceholder}
                    options={compareCandidates}
                  />
                </div>
              </div>
            ) : null}
          </Space>
          <Typography.Text type="secondary">{`${start} ~ ${end}`}</Typography.Text>
        </div>
      </Card>
      <Row gutter={[16, 16]}>
        {summaryCards.map((item) => (
          <Col key={item.key} xs={24} md={12} xl={isTeamDashboard ? 8 : 10}>
            <PerformanceSummaryCard item={item} loading={performanceQuery.isLoading} />
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title={text.rankingTitle} extra={<Typography.Text type="secondary">{text.rankingSubtitle}</Typography.Text>}>
            <Table
              rowKey={(record) => `${record.id}-${record.name}`}
              columns={columns}
              dataSource={filteredRanking}
              loading={performanceQuery.isLoading}
              pagination={false}
              locale={{ emptyText: text.noData }}
              scroll={{ x: 1500 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title={isTeamDashboard ? text.compareTitle : text.selfTitle} extra={<Typography.Text type="secondary">{isTeamDashboard ? text.compareHint : text.selfHint}</Typography.Text>}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {compareMembers.length > 0 ? (
                compareMembers.map((member) => <PerformanceCompareCard key={`${member.id}-${member.name}`} member={member} />)
              ) : (
                <Typography.Text type="secondary">{text.noCompare}</Typography.Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function PerformanceSummaryCard({ item, loading }: { item: SummaryCardItem; loading: boolean }) {
  return (
    <Card className="performance-summary-card" loading={loading}>
      <Typography.Text type="secondary">{item.title}</Typography.Text>
      <Typography.Title level={2} className="performance-summary-card__value">
        {item.value}
        {item.suffix ? <Typography.Text type="secondary"> {item.suffix}</Typography.Text> : null}
      </Typography.Title>
      <Typography.Paragraph className="performance-summary-card__hint">{item.hint}</Typography.Paragraph>
    </Card>
  );
}

function PerformanceCompareCard({ member }: { member: PerformanceMemberRecord }) {
  return (
    <div className="performance-compare-card">
      <div className="performance-compare-card__header">
        <Space>
          <Typography.Text strong>{member.name}</Typography.Text>
          <Tag color={levelColorMap[member.level]}>{levelLabelMap[member.level]}</Tag>
          <Tag color={member.status === 'Active' ? 'processing' : 'default'}>
            {member.status === 'Active' ? text.statusActive : text.statusInvited}
          </Tag>
        </Space>
        <Typography.Text type="secondary">{`#${member.rank}`}</Typography.Text>
      </div>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <MetricProgressRow label={text.scoreColumn} value={member.score} />
        <MetricProgressRow label={text.onTimeColumn} value={member.onTimeRate} />
        <MetricProgressRow label={text.updateRateColumn} value={member.updateRate} color="#2da895" />
        <Row gutter={[12, 12]}>
          <Col span={12}>
            <StatisticText label={text.totalHours} value={`${member.totalHours.toFixed(1)} ${text.hourSuffix}`} />
          </Col>
          <Col span={12}>
            <StatisticText label={text.updateDays} value={`${member.updateDays} ${text.daySuffix}`} />
          </Col>
          <Col span={12}>
            <StatisticText label={text.activeProjects} value={`${member.activeProjectCount} ${text.itemSuffix}`} />
          </Col>
          <Col span={12}>
            <StatisticText label={text.completedItems} value={`${member.completedItemCount} / ${member.dueItemCount}`} />
          </Col>
        </Row>
        <Typography.Text type="secondary">{member.projectNames.length > 0 ? member.projectNames.join(' / ') : text.projectEmpty}</Typography.Text>
      </Space>
    </div>
  );
}

function MetricProgressRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="performance-compare-card__metric">
        <Typography.Text>{label}</Typography.Text>
        <Typography.Text strong>{`${value}%`}</Typography.Text>
      </div>
      <Progress percent={value} showInfo={false} size="small" strokeColor={color} />
    </div>
  );
}

function StatisticText({ label, value }: { label: string; value: string }) {
  return (
    <Space direction="vertical" size={0}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text strong>{value}</Typography.Text>
    </Space>
  );
}