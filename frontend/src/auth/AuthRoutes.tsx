import { useEffect } from 'react';
import { Button, Result, Spin } from 'antd';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { useAuthStore } from '../store/authStore';
import { LoginPage } from '../pages/LoginPage';

function useBootstrapAuth() {
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    if (!bootstrapped && !loading) {
      void useAuthStore.getState().bootstrap();
    }
  }, [bootstrapped, loading]);

  return { bootstrapped, loading };
}

function FullScreenLoading({ message }: { message: string }) {
  return (
    <div className="auth-screen auth-screen--loading">
      <Spin size="large" />
      <div>{message}</div>
    </div>
  );
}

export function ProtectedAppShell() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const { bootstrapped, loading } = useBootstrapAuth();

  if (!bootstrapped || loading) {
    return <FullScreenLoading message="Loading workspace..." />;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <AppShell />;
}

export function PublicLoginRoute() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const { bootstrapped, loading } = useBootstrapAuth();

  if (!bootstrapped || loading) {
    return <FullScreenLoading message="Checking session..." />;
  }

  if (token) {
    const target = typeof location.state?.from === 'string' ? location.state.from : '/workspace';
    return <Navigate to={target} replace />;
  }

  return <LoginPage />;
}

export function PermissionGuard({ permission, children }: { permission?: string; children: JSX.Element }) {
  const permissions = useAuthStore((state) => state.permissions);
  const navigate = useNavigate();

  if (!permission || permissions.includes(permission)) {
    return children;
  }

  return (
    <Result
      status="403"
      title="403"
      subTitle="Your current role does not include access to this page yet."
      extra={
        <Button type="primary" onClick={() => navigate('/workspace')}>
          Back to workspace
        </Button>
      }
    />
  );
}