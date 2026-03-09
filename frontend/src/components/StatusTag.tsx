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

export function StatusTag({ value }: { value: string }) {
  return <Tag color={colorMap[value] ?? 'default'}>{value}</Tag>;
}