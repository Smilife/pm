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
    return <FullScreenLoading message="正在加载工作台..." />;
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
    return <FullScreenLoading message="正在检查登录状态..." />;
  }

  if (token) {
    const target = typeof location.state?.from === 'string' ? location.state.from : '/workspace';
    return <Navigate to={target} replace />;
  }

  return <LoginPage />;
}

export function PermissionGuard({
  permission,
  permissions: requiredPermissions,
  children,
}: {
  permission?: string;
  permissions?: string[];
  children: JSX.Element;
}) {
  const currentPermissions = useAuthStore((state) => state.permissions);
  const navigate = useNavigate();
  const hasSinglePermission = permission ? currentPermissions.includes(permission) : false;
  const hasAnyRequiredPermission = Array.isArray(requiredPermissions)
    ? requiredPermissions.some((item) => currentPermissions.includes(item))
    : false;

  if ((!permission && (!requiredPermissions || requiredPermissions.length === 0)) || hasSinglePermission || hasAnyRequiredPermission) {
    return children;
  }

  return (
    <Result
      status="403"
      title="403"
      subTitle="当前角色暂时没有访问这个页面的权限。"
      extra={
        <Button type="primary" onClick={() => navigate('/workspace')}>
          返回工作台
        </Button>
      }
    />
  );
}
