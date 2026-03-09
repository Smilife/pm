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
          The route is wired into navigation. Tables, filters and real API calls will be added in the next pass.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
