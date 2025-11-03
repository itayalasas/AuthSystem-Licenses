const AUTH_URL = import.meta.env.VITE_AUTH_URL;
const AUTH_APP_ID = import.meta.env.VITE_AUTH_APP_ID;
const AUTH_API_KEY = import.meta.env.VITE_AUTH_API_KEY;

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
}

interface AuthTokens {
  token: string;
  refresh_token: string;
  user_id: string;
  state: string;
  user?: AuthUser;
}

class AuthService {
  private static STORAGE_KEY = 'auth_tokens';
  private static USER_KEY = 'auth_user';

  static buildAuthUrl(type: 'login' | 'register'): string {
    const redirectUri = `${window.location.origin}/callback`;
    const params = new URLSearchParams({
      app_id: AUTH_APP_ID,
      redirect_uri: redirectUri,
      api_key: AUTH_API_KEY,
    });

    return `${AUTH_URL}/${type}?${params.toString()}`;
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

    if (!token || !refresh_token || !user_id) {
      return null;
    }

    return {
      token,
      refresh_token,
      user_id,
      state,
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
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokens));

    if (tokens.token) {
      const user = this.decodeToken(tokens.token);
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
    window.location.href = '/';
  }

  static async refreshToken(): Promise<boolean> {
    const tokens = this.getTokens();
    if (!tokens?.refresh_token) return false;

    try {
      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refresh_token,
          app_id: AUTH_APP_ID,
          api_key: AUTH_API_KEY,
        }),
      });

      if (!response.ok) return false;

      const data = await response.json();

      if (data.token) {
        this.saveTokens({
          token: data.token,
          refresh_token: data.refresh_token || tokens.refresh_token,
          user_id: tokens.user_id,
          state: 'authenticated',
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
}

export { AuthService };
export type { AuthUser, AuthTokens };
