import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="This route is not part of the current iteration yet."
      extra={
        <Button type="primary" onClick={() => navigate('/workspace')}>
          Back to workspace
        </Button>
      }
    />
  );
}
