import {
  AppstoreOutlined,
  BugOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ContainerOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  ProjectOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';

const { Header, Sider, Content } = Layout;

type NavItem = {
  key: string;
  label: string;
  icon: JSX.Element;
  permission?: string;
};

const navItems: NavItem[] = [
  { key: '/workspace', icon: <HomeOutlined />, label: 'Workspace' },
  { key: '/requirements', icon: <ContainerOutlined />, label: 'Requirements', permission: 'requirement.view.related' },
  { key: '/projects', icon: <ProjectOutlined />, label: 'Projects', permission: 'project.view.related' },
  { key: '/executions', icon: <ProfileOutlined />, label: 'Executions', permission: 'execution.view.related' },
  { key: '/bugs', icon: <BugOutlined />, label: 'Bugs', permission: 'bug.view.related' },
  { key: '/daily-tasks', icon: <CheckSquareOutlined />, label: 'Daily Tasks', permission: 'daily_task.view.self' },
  { key: '/reports/daily', icon: <FileTextOutlined />, label: 'Daily Report', permission: 'report.daily.generate.self' },
  { key: '/reports/weekly', icon: <ReadOutlined />, label: 'Weekly Report', permission: 'report.weekly.generate.self' },
  { key: '/gantt', icon: <CalendarOutlined />, label: 'Gantt', permission: 'schedule.view.related' },
  { key: '/settings', icon: <AppstoreOutlined />, label: 'Settings' },
];

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const collapsed = useUiStore((state) => state.collapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleCollapsed);
  const permissions = useAuthStore((state) => state.permissions);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const selectedKey = pathname === '/' ? '/workspace' : pathname;
  const visibleItems = navItems.filter((item) => !item.permission || permissions.includes(item.permission));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Sider trigger={null} collapsible collapsed={collapsed} width={248} theme="light" className="app-sider">
        <div className="brand-panel">
          <span className="brand-badge">PM</span>
          {!collapsed ? (
            <div>
              <Typography.Text strong>Project Management Platform</Typography.Text>
              <Typography.Paragraph>One workspace from requirement to report.</Typography.Paragraph>
            </div>
          ) : null}
        </div>
        <Menu selectedKeys={[selectedKey]} mode="inline" items={visibleItems} onClick={({ key }) => navigate(String(key))} />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size="middle">
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={toggleCollapsed} />
            <div>
              <Typography.Text strong>R and D Management Mainline</Typography.Text>
              <Typography.Paragraph>Current focus: auth, requirements, executions, bugs, worklogs, reports.</Typography.Paragraph>
            </div>
          </Space>
          <Space size="middle" align="center">
            <div className="header-user">
              <Typography.Text strong>{user?.name ?? 'Unknown user'}</Typography.Text>
              <Typography.Paragraph>{user?.email ?? '-'}</Typography.Paragraph>
            </div>
            <Button onClick={handleLogout}>Sign out</Button>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}