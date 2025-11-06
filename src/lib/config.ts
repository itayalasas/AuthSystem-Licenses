const ENV_API_URL = 'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/get-env';
const ACCESS_KEY = '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866';

interface EnvConfig {
  project_name: string;
  description: string;
  variables: Record<string, string>;
  updated_at: string;
}

class ConfigService {
  private static CONFIG_KEY = 'app_config';
  private static CACHE_DURATION = 1000 * 60 * 60;
  private static config: EnvConfig | null = null;

  static getAccessKey(): string {
    return ACCESS_KEY;
  }

  static async fetchConfig(): Promise<EnvConfig> {
    try {
      const response = await fetch(ENV_API_URL, {
        headers: {
          'X-Access-Key': ACCESS_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }

      const data: EnvConfig = await response.json();

      this.config = data;
      this.cacheConfig(data);

      return data;
    } catch (error) {
      console.error('Error fetching config:', error);

      const cached = this.getCachedConfig();
      if (cached) {
        console.warn('Using cached config due to fetch error');
        return cached;
      }

      throw error;
    }
  }

  private static cacheConfig(config: EnvConfig) {
    const cacheData = {
      config,
      timestamp: Date.now(),
    };
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(cacheData));
  }

  private static getCachedConfig(): EnvConfig | null {
    try {
      const cached = localStorage.getItem(this.CONFIG_KEY);
      if (!cached) return null;

      const { config, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > this.CACHE_DURATION) {
        return null;
      }

      return config;
    } catch {
      return null;
    }
  }

  static async getConfig(): Promise<EnvConfig> {
    if (this.config) {
      return this.config;
    }

    const cached = this.getCachedConfig();
    if (cached) {
      this.config = cached;
      this.fetchConfig().catch(console.error);
      return cached;
    }

    return await this.fetchConfig();
  }

  static getVariable(key: string): string | undefined {
    if (!this.config) {
      const cached = this.getCachedConfig();
      if (cached) {
        return cached.variables[key];
      }
      return undefined;
    }

    return this.config.variables[key];
  }

  static getAllVariables(): Record<string, string> {
    if (!this.config) {
      const cached = this.getCachedConfig();
      if (cached) {
        return cached.variables;
      }
      return {};
    }

    return this.config.variables;
  }

  static async initialize(): Promise<void> {
    try {
      await this.fetchConfig();
      console.log('Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to initialize config:', error);
      throw error;
    }
  }

  static isConfigured(): boolean {
    return this.config !== null || this.getCachedConfig() !== null;
  }

  static clearCache() {
    localStorage.removeItem(this.CONFIG_KEY);
    this.config = null;
  }

  static async refreshConfig(): Promise<EnvConfig> {
    this.clearCache();
    return await this.fetchConfig();
  }

  static getMercadoPagoApiUrl(): string {
    return this.getVariable('MERCADOPAGO_API_URL') || 'https://api.mercadopago.com/preapproval_plan';
  }

  static getMercadoPagoAccessToken(): string | undefined {
    return this.getVariable('MERCADOPAGO_ACCESS_TOKEN');
  }

  static getMercadoPagoBackUrl(): string {
    return this.getVariable('MERCADOPAGO_BACK_URL') || 'https://www.yoursite.com';
  }

  static isMercadoPagoConfigured(): boolean {
    const token = this.getMercadoPagoAccessToken();
    return !!token && token !== 'your_mercadopago_access_token_here';
  }
}

export { ConfigService };
export type { EnvConfig };
