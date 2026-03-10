import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="当前迭代里还没有这个路由页面。"
      extra={
        <Button type="primary" onClick={() => navigate('/workspace')}>
          返回工作台
        </Button>
      }
    />
  );
}
