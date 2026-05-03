import { useState, useEffect } from 'react';
import { AlertTriangle, FlaskConical, CheckCircle } from 'lucide-react';
import { ConfigService, type EnvConfig } from '../lib/config';

type EnvType = 'DEV' | 'QA' | 'PROD' | 'UNKNOWN';

function detectEnvFromConfig(config: EnvConfig | null): EnvType {
  if (!config) return 'UNKNOWN';
  const name = (config.project_name || '').toUpperCase();
  if (name.endsWith('-PROD')) return 'PROD';
  if (name.endsWith('-QA')) return 'QA';
  if (name.endsWith('-DEV')) return 'DEV';
  return 'UNKNOWN';
}

const ENV_META: Record<EnvType, {
  label: string;
  badgeBg: string; badgeText: string; badgeBorder: string; dot: string;
  bannerBg: string; bannerText: string;
  isTest: boolean;
}> = {
  PROD: {
    label: 'PROD',
    badgeBg: 'bg-green-100', badgeText: 'text-green-700', badgeBorder: 'border-green-200', dot: 'bg-green-500',
    bannerBg: '', bannerText: '',
    isTest: false,
  },
  QA: {
    label: 'QA',
    badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', badgeBorder: 'border-blue-200', dot: 'bg-blue-500',
    bannerBg: 'bg-blue-600', bannerText: 'text-white',
    isTest: true,
  },
  DEV: {
    label: 'DEV',
    badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', badgeBorder: 'border-amber-200', dot: 'bg-amber-500',
    bannerBg: 'bg-amber-500', bannerText: 'text-white',
    isTest: true,
  },
  UNKNOWN: {
    label: '?',
    badgeBg: 'bg-gray-100', badgeText: 'text-gray-600', badgeBorder: 'border-gray-200', dot: 'bg-gray-400',
    bannerBg: 'bg-gray-500', bannerText: 'text-white',
    isTest: true,
  },
};

function useEnvConfig() {
  const [config, setConfig] = useState<EnvConfig | null>(() => ConfigService.getCurrentConfig());

  useEffect(() => {
    if (config) return;
    let cancelled = false;
    ConfigService.getConfig().then((c) => {
      if (!cancelled) setConfig(c);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [config]);

  return config;
}

interface EnvironmentBadgeProps {
  variant?: 'badge' | 'banner';
}

export function EnvironmentBadge({ variant = 'badge' }: EnvironmentBadgeProps) {
  const config = useEnvConfig();
  const env = detectEnvFromConfig(config);
  const meta = ENV_META[env];

  if (variant === 'banner') {
    if (!meta.isTest) return null;
    const Icon = env === 'QA' ? FlaskConical : AlertTriangle;
    const envLabel = env === 'UNKNOWN' ? 'AMBIENTE DESCONOCIDO' : `AMBIENTE DE ${env}`;

    return (
      <div className={`w-full ${meta.bannerBg} ${meta.bannerText} text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 select-none`}>
        <Icon size={13} />
        <span>{envLabel} — Los datos no son de producción</span>
        <Icon size={13} />
      </div>
    );
  }

  if (!config) return null;

  if (env === 'PROD') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${meta.badgeBg} ${meta.badgeText} border ${meta.badgeBorder}`}>
        <CheckCircle size={11} />
        PROD
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${meta.badgeBg} ${meta.badgeText} border ${meta.badgeBorder}`}>
      <AlertTriangle size={11} />
      {meta.label}
    </span>
  );
}

export function useEnvInfo() {
  const config = useEnvConfig();
  const env = detectEnvFromConfig(config);
  const supabaseUrl = config?.variables?.['VITE_SUPABASE_URL'] || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';

  return {
    env,
    projectName: config?.project_name || '',
    isProduction: env === 'PROD',
    supabaseProjectRef: projectRef,
    supabaseUrl,
  };
}
