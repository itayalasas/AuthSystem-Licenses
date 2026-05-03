import { AlertTriangle, FlaskConical } from 'lucide-react';

type Environment = 'development' | 'production' | string;

interface EnvironmentBadgeProps {
  variant?: 'badge' | 'banner';
}

function getEnvironment(): Environment {
  return import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';
}

export function EnvironmentBadge({ variant = 'badge' }: EnvironmentBadgeProps) {
  const env = getEnvironment();
  const isProduction = env === 'production';

  if (isProduction && variant === 'badge') {
    return null;
  }

  if (variant === 'banner') {
    if (isProduction) return null;

    return (
      <div className="w-full bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 select-none">
        <FlaskConical size={13} />
        <span>AMBIENTE DE TESTING — Los datos no son de producción</span>
        <FlaskConical size={13} />
      </div>
    );
  }

  if (isProduction) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        PROD
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
      <AlertTriangle size={11} />
      TESTING
    </span>
  );
}

export function getEnvInfo() {
  const env = getEnvironment();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'desconocido';

  return {
    env,
    isProduction: env === 'production',
    supabaseProjectRef: projectRef,
    supabaseUrl,
  };
}
