import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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
      const message = error instanceof Error ? error.message.replace(/_/g, ' ') : 'Login failed';
      setErrorMessage(message);
    }
  };

  return (
    <div className="auth-screen">
      <Card className="auth-card">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>Sign in</Typography.Title>
            <Typography.Paragraph>
              Use one of the demo accounts to explore the project management workspace with different role permissions.
            </Typography.Paragraph>
          </div>
          <Alert
            type="info"
            showIcon
            message="Demo accounts"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>Admin: `wangjun@example.com` / `demo123`</Typography.Text>
                <Typography.Text>Execution member: `chenjing@example.com` / `demo123`</Typography.Text>
                <Typography.Text>Read only: `sunmei@example.com` / `demo123`</Typography.Text>
              </Space>
            }
          />
          {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
          <Form layout="vertical" initialValues={{ account: 'wangjun@example.com', password: 'demo123' }} onFinish={handleFinish}>
            <Form.Item label="Account" name="account" rules={[{ required: true, message: 'Enter your account' }]}>
              <Input placeholder="Email or username" autoComplete="username" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Enter your password' }]}>
              <Input.Password placeholder="Password" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Sign in
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
