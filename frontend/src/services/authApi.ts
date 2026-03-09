import { clearAuthToken, getAuthToken, setAuthToken } from './authToken';

const API_BASE = '/api/v1';

type AuthEnvelope<T> = {
  code: number;
  message: string;
  data: T;
  request_id: string;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  dingtalkBound: boolean;
};

export type AuthPermissionSummary = {
  roles: string[];
  permissions: string[];
};

export async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const payload = (await response.json()) as AuthEnvelope<T>;

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || 'request_failed');
  }

  return payload.data;
}

function mapUser(user: any): AuthUser {
  return {
    id: Number(user?.id ?? 0),
    name: String(user?.name ?? ''),
    email: String(user?.email ?? ''),
    roles: Array.isArray(user?.roles) ? user.roles.map((item: unknown) => String(item)) : [],
    dingtalkBound: Boolean(user?.dingtalk_bound),
  };
}

export const authApi = {
  async login(account: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const data = await authRequest<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    });

    const token = String(data?.token ?? '');
    if (token) {
      setAuthToken(token);
    }

    return {
      token,
      user: mapUser(data?.user ?? {}),
    };
  },
  async logout(): Promise<void> {
    try {
      await authRequest('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      clearAuthToken();
    }
  },
  async getCurrentUser(): Promise<AuthUser> {
    const data = await authRequest<any>('/auth/me');
    return mapUser(data);
  },
  async getPermissions(): Promise<AuthPermissionSummary> {
    const data = await authRequest<any>('/auth/permissions');
    return {
      roles: Array.isArray(data?.roles) ? data.roles.map((item: unknown) => String(item)) : [],
      permissions: Array.isArray(data?.permissions) ? data.permissions.map((item: unknown) => String(item)) : [],
    };
  },
};