import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const authErrorMap: Record<string, string> = {
  invalid_credentials: '账号或密码错误',
  missing_credentials: '请输入账号和密码',
  unauthorized: '登录状态已失效',
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFinish = async (values: { account: string; password: string }) => {
    try {
      setErrorMessage('');
      await login(values.account, values.password);
      const target = typeof location.state?.from === 'string' ? location.state.from : '/workspace';
      navigate(target, { replace: true });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Login failed';
      setErrorMessage(authErrorMap[rawMessage] ?? '登录失败，请稍后重试');
    }
  };

  return (
    <div className="auth-screen">
      <Card className="auth-card">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>登录系统</Typography.Title>
            <Typography.Paragraph>
              使用演示账号进入团队项目管理平台，不同账号会看到不同的权限范围。
            </Typography.Paragraph>
          </div>
          <Alert
            type="info"
            showIcon
            message="演示账号"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>管理员：wangjun@example.com / demo123</Typography.Text>
                <Typography.Text>执行成员：chenjing@example.com / demo123</Typography.Text>
                <Typography.Text>只读成员：sunmei@example.com / demo123</Typography.Text>
              </Space>
            }
          />
          {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
          <Form layout="vertical" initialValues={{ account: 'wangjun@example.com', password: 'demo123' }} onFinish={handleFinish}>
            <Form.Item label="账号" name="account" rules={[{ required: true, message: '请输入账号' }]}>
              <Input placeholder="邮箱或用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder="请输入密码" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
