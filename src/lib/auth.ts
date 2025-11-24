import { ConfigService } from './config';

interface AuthUser {
  sub: string;
  email: string;
  name: string;
  app_id: string;
  role: string;
  permissions: Record<string, string[]>;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  metadata?: Record<string, any>;
}

interface AuthTokens {
  token: string;
  refreshToken?: string;
  refresh_token?: string;
  user_id?: string;
  state?: string;
  user?: AuthUser;
}

class AuthService {
  private static STORAGE_KEY = 'auth_tokens';
  private static USER_KEY = 'auth_user';

  private static getAuthUrl(): string {
    return ConfigService.getVariable('VITE_AUTH_URL') || '';
  }

  private static getAppId(): string {
    return ConfigService.getVariable('VITE_AUTH_APP_ID') || '';
  }

  private static getApiKey(): string {
    return ConfigService.getVariable('VITE_AUTH_API_KEY') || '';
  }

  private static getRedirectUri(): string {
    return ConfigService.getVariable('VITE_REDIRECT_URI') || '';
  }

  static buildAuthUrl(type: 'login' | 'register'): string {
    const authUrl = this.getAuthUrl();
    const appId = this.getAppId();
    const apiKey = this.getApiKey();
    const redirectUri = this.getRedirectUri() || `${window.location.origin}/callback`;

    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      api_key: apiKey,
    });

    return `${authUrl}/${type}?${params.toString()}`;
  }

  static redirectToLogin() {
    window.location.href = this.buildAuthUrl('login');
  }

  static redirectToRegister() {
    window.location.href = this.buildAuthUrl('register');
  }

  static parseTokenFromUrl(): AuthTokens | null {
    const params = new URLSearchParams(window.location.search);

    const token = params.get('token');
    const refresh_token = params.get('refresh_token');
    const user_id = params.get('user_id');
    const state = params.get('state');
    const code = params.get('code');

    if (code) {
      return null;
    }

    if (!token || !refresh_token || !user_id) {
      return null;
    }

    return {
      token,
      refresh_token,
      user_id,
      state: state || undefined,
    };
  }

  static decodeToken(token: string): AuthUser | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  static saveTokens(tokens: AuthTokens) {
    const normalizedTokens = {
      ...tokens,
      refresh_token: tokens.refreshToken || tokens.refresh_token,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalizedTokens));

    if (tokens.token) {
      const user = tokens.user || this.decodeToken(tokens.token);
      if (user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }
    }
  }

  static getTokens(): AuthTokens | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  static getUser(): AuthUser | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    const user = this.decodeToken(token);
    if (!user) return true;

    const now = Math.floor(Date.now() / 1000);
    return user.exp < now;
  }

  static isAuthenticated(): boolean {
    const tokens = this.getTokens();
    if (!tokens) return false;

    return !this.isTokenExpired(tokens.token);
  }

  static logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('tenant_info');
    localStorage.removeItem('has_access');
    localStorage.removeItem('available_plans');
    window.location.href = '/';
  }

  static async refreshToken(): Promise<boolean> {
    const tokens = this.getTokens();
    const refreshToken = tokens?.refreshToken || tokens?.refresh_token;
    if (!refreshToken) return false;

    const authRefreshUrl = ConfigService.getVariable('AUTH_REFRESH_TOKEN');
    const applicationId = ConfigService.getVariable('VITE_AUTH_APP_ID');

    if (!authRefreshUrl || !applicationId) {
      console.error('Missing refresh token configuration');
      return false;
    }

    try {
      const response = await fetch(authRefreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
          application_id: applicationId,
        }),
      });

      if (!response.ok) return false;

      const result = await response.json();

      if (result.success && result.data?.access_token) {
        this.saveTokens({
          token: result.data.access_token,
          refreshToken: result.data.refresh_token || refreshToken,
          user: result.data.user,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  static hasPermission(resource: string, action: string): boolean {
    const user = this.getUser();
    if (!user || !user.permissions) return false;

    const resourcePermissions = user.permissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions.includes(action);
  }

  static getAuthHeader(): string | null {
    const tokens = this.getTokens();
    if (!tokens?.token) return null;

    return `Bearer ${tokens.token}`;
  }

  static getTenantInfo(): any | null {
    try {
      const stored = localStorage.getItem('tenant_info');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  static getHasAccess(): boolean {
    try {
      const stored = localStorage.getItem('has_access');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  }

  static getAvailablePlans(): any[] {
    try {
      const stored = localStorage.getItem('available_plans');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

export { AuthService };
export type { AuthUser, AuthTokens };
