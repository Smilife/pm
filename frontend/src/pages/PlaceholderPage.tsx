import { Card, Typography } from 'antd';
import { PageHeader } from '../components/PageHeader';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="page-stack">
      <PageHeader title={title} description={description} />
      <Card>
        <Typography.Paragraph>
          这个路由已经接入导航，后续会继续补齐表格、筛选器和真实接口联动。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
