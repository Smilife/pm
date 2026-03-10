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
const settingsPermissions = [
  'settings.member.manage.org',
  'settings.role.manage.org',
  'settings.policy.manage.org',
  'settings.dictionary.view.org',
  'settings.workflow.view.org',
];

type NavItem = {
  key: string;
  label: string;
  icon: JSX.Element;
  permission?: string;
  permissions?: string[];
};

const navItems: NavItem[] = [
  { key: '/workspace', icon: <HomeOutlined />, label: '工作台' },
  { key: '/requirements', icon: <ContainerOutlined />, label: '需求池', permission: 'requirement.view.related' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目', permission: 'project.view.related' },
  { key: '/executions', icon: <ProfileOutlined />, label: '执行', permission: 'execution.view.related' },
  { key: '/bugs', icon: <BugOutlined />, label: '缺陷', permission: 'bug.view.related' },
  { key: '/daily-tasks', icon: <CheckSquareOutlined />, label: '日常事项', permission: 'daily_task.view.self' },
  { key: '/reports/daily', icon: <FileTextOutlined />, label: '日报', permission: 'report.daily.generate.self' },
  { key: '/reports/weekly', icon: <ReadOutlined />, label: '周报', permission: 'report.weekly.generate.self' },
  { key: '/gantt', icon: <CalendarOutlined />, label: '甘特图', permission: 'schedule.view.related' },
  { key: '/settings', icon: <AppstoreOutlined />, label: '设置中心', permissions: settingsPermissions },
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
  const visibleItems = navItems.filter((item) => {
    if (!item.permission && (!item.permissions || item.permissions.length === 0)) {
      return true;
    }

    return Boolean(
      (item.permission && permissions.includes(item.permission)) ||
        item.permissions?.some((permission) => permissions.includes(permission)),
    );
  });

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
              <Typography.Text strong>团队项目管理平台</Typography.Text>
              <Typography.Paragraph>覆盖从需求到汇报的一体化工作台。</Typography.Paragraph>
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
              <Typography.Text strong>研发项目主线协同</Typography.Text>
              <Typography.Paragraph>当前已覆盖登录、需求、执行、缺陷、工时、报表与设置中心。</Typography.Paragraph>
            </div>
          </Space>
          <Space size="middle" align="center">
            <div className="header-user">
              <Typography.Text strong>{user?.name ?? '未知用户'}</Typography.Text>
              <Typography.Paragraph>{user?.email ?? '-'}</Typography.Paragraph>
            </div>
            <Button onClick={handleLogout}>退出登录</Button>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
