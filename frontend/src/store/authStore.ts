import { create } from 'zustand';
import { authApi, type AuthUser } from '../services/authApi';
import { clearAuthToken, getAuthToken } from '../services/authToken';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  bootstrapped: boolean;
  loading: boolean;
  login: (account: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getAuthToken(),
  user: null,
  roles: [],
  permissions: [],
  bootstrapped: false,
  loading: false,
  login: async (account: string, password: string) => {
    set({ loading: true });

    try {
      const { token, user } = await authApi.login(account, password);
      const permissionSummary = await authApi.getPermissions();

      set({
        token,
        user,
        roles: permissionSummary.roles,
        permissions: permissionSummary.permissions,
        bootstrapped: true,
        loading: false,
      });
    } catch (error) {
      clearAuthToken();
      set({ token: null, user: null, roles: [], permissions: [], bootstrapped: true, loading: false });
      throw error;
    }
  },
  logout: async () => {
    set({ loading: true });

    try {
      await authApi.logout();
    } finally {
      clearAuthToken();
      set({ token: null, user: null, roles: [], permissions: [], bootstrapped: true, loading: false });
    }
  },
  bootstrap: async () => {
    const token = get().token ?? getAuthToken();

    if (!token) {
      set({ token: null, user: null, roles: [], permissions: [], bootstrapped: true, loading: false });
      return;
    }

    if (get().loading) {
      return;
    }

    set({ loading: true, token });

    try {
      const [user, permissionSummary] = await Promise.all([authApi.getCurrentUser(), authApi.getPermissions()]);
      set({
        token,
        user,
        roles: permissionSummary.roles,
        permissions: permissionSummary.permissions,
        bootstrapped: true,
        loading: false,
      });
    } catch (error) {
      clearAuthToken();
      set({ token: null, user: null, roles: [], permissions: [], bootstrapped: true, loading: false });
    }
  },
}));