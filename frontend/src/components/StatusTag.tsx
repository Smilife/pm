import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  Draft: 'default',
  Understanding: 'processing',
  Confirmed: 'gold',
  ToReview: 'magenta',
  Reviewed: 'cyan',
  Scheduled: 'blue',
  InDevelopment: 'green',
  NotStarted: 'default',
  InProgress: 'processing',
  Blocked: 'error',
  ToVerify: 'warning',
  Done: 'success',
  Closed: 'default',
  Active: 'processing',
  Risk: 'error',
  Open: 'error',
  Resolved: 'success',
};

const labelMap: Record<string, string> = {
  Draft: '草稿',
  Understanding: '需求澄清',
  Confirmed: '已确认',
  ToReview: '待评审',
  Reviewed: '已评审',
  Scheduled: '已排期',
  InDevelopment: '开发中',
  NotStarted: '未开始',
  InProgress: '进行中',
  Blocked: '阻塞',
  ToVerify: '待验证',
  Done: '完成',
  Closed: '关闭',
  Active: '进行中',
  Risk: '风险',
  Open: '已打开',
  Resolved: '已解决',
};

export function StatusTag({ value }: { value: string }) {
  return <Tag color={colorMap[value] ?? 'default'}>{labelMap[value] ?? value}</Tag>;
}
