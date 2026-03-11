import {
  AppstoreOutlined,
  BarChartOutlined,
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

const text = {
  workspace: '\u5de5\u4f5c\u53f0',
  requirements: '\u9700\u6c42\u6c60',
  projects: '\u9879\u76ee',
  executions: '\u6267\u884c',
  bugs: '\u7f3a\u9677',
  dailyTasks: '\u65e5\u5e38\u4e8b\u9879',
  dailyReport: '\u65e5\u62a5',
  weeklyReport: '\u5468\u62a5',
  gantt: '\u7518\u7279\u56fe',
  performance: '\u4eba\u5458\u7ee9\u6548',
  settings: '\u8bbe\u7f6e\u4e2d\u5fc3',
  brandTitle: '\u56e2\u961f\u9879\u76ee\u7ba1\u7406\u5e73\u53f0',
  brandDescription: '\u8986\u76d6\u4ece\u9700\u6c42\u5230\u6c47\u62a5\u7684\u4e00\u4f53\u5316\u5de5\u4f5c\u53f0\u3002',
  headerTitle: '\u7814\u53d1\u9879\u76ee\u4e3b\u7ebf\u534f\u540c',
  headerDescription: '\u5f53\u524d\u5df2\u8986\u76d6\u767b\u5f55\u3001\u9700\u6c42\u3001\u6267\u884c\u3001\u7f3a\u9677\u3001\u5de5\u65f6\u3001\u7ee9\u6548\u3001\u62a5\u8868\u4e0e\u8bbe\u7f6e\u4e2d\u5fc3\u3002',
  unknownUser: '\u672a\u77e5\u7528\u6237',
  logout: '\u9000\u51fa\u767b\u5f55',
} as const;

type NavItem = {
  key: string;
  label: string;
  icon: JSX.Element;
  permission?: string;
  permissions?: string[];
};

const navItems: NavItem[] = [
  { key: '/workspace', icon: <HomeOutlined />, label: text.workspace },
  { key: '/requirements', icon: <ContainerOutlined />, label: text.requirements, permission: 'requirement.view.related' },
  { key: '/projects', icon: <ProjectOutlined />, label: text.projects, permission: 'project.view.related' },
  { key: '/executions', icon: <ProfileOutlined />, label: text.executions, permission: 'execution.view.related' },
  { key: '/bugs', icon: <BugOutlined />, label: text.bugs, permission: 'bug.view.related' },
  { key: '/daily-tasks', icon: <CheckSquareOutlined />, label: text.dailyTasks, permission: 'daily_task.view.self' },
  { key: '/reports/daily', icon: <FileTextOutlined />, label: text.dailyReport, permission: 'report.daily.generate.self' },
  { key: '/reports/weekly', icon: <ReadOutlined />, label: text.weeklyReport, permission: 'report.weekly.generate.self' },
  { key: '/gantt', icon: <CalendarOutlined />, label: text.gantt, permission: 'schedule.view.related' },
  { key: '/performance', icon: <BarChartOutlined />, label: text.performance, permission: 'execution.view.related' },
  { key: '/settings', icon: <AppstoreOutlined />, label: text.settings, permissions: settingsPermissions },
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
              <Typography.Text strong>{text.brandTitle}</Typography.Text>
              <Typography.Paragraph>{text.brandDescription}</Typography.Paragraph>
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
              <Typography.Text strong>{text.headerTitle}</Typography.Text>
              <Typography.Paragraph>{text.headerDescription}</Typography.Paragraph>
            </div>
          </Space>
          <Space size="middle" align="center">
            <div className="header-user">
              <Typography.Text strong>{user?.name ?? text.unknownUser}</Typography.Text>
              <Typography.Paragraph>{user?.email ?? '-'}</Typography.Paragraph>
            </div>
            <Button onClick={handleLogout}>{text.logout}</Button>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}