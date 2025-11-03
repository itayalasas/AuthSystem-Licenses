import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { Plan } from '../lib/subscription';

interface FeatureGuardProps {
  children: ReactNode;
  feature: keyof Plan['entitlements']['features'];
  entitlements: Plan['entitlements'] | null;
  fallback?: ReactNode;
  onUpgradeClick?: () => void;
}

export function FeatureGuard({
  children,
  feature,
  entitlements,
  fallback,
  onUpgradeClick,
}: FeatureGuardProps) {
  if (!entitlements) {
    return null;
  }

  const hasAccess = entitlements.features[feature];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-50 blur-sm select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-auto text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Premium Feature
          </h3>
          <p className="text-gray-600 mb-4">
            Upgrade your plan to access this feature
          </p>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Upgrade Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface LimitGuardProps {
  children: ReactNode;
  metric: keyof Plan['entitlements']['limits'];
  currentValue: number;
  entitlements: Plan['entitlements'] | null;
  warningThreshold?: number;
  onUpgradeClick?: () => void;
}

export function LimitGuard({
  children,
  metric,
  currentValue,
  entitlements,
  warningThreshold = 0.8,
  onUpgradeClick,
}: LimitGuardProps) {
  if (!entitlements) {
    return null;
  }

  const limit = entitlements.limits[metric];
  const percentage = currentValue / limit;
  const isAtLimit = currentValue >= limit;
  const isNearLimit = percentage >= warningThreshold;

  if (!isAtLimit && !isNearLimit) {
    return <>{children}</>;
  }

  if (isAtLimit) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-50 blur-sm select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-auto text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Limit Reached
            </h3>
            <p className="text-gray-600 mb-4">
              You've reached your plan's limit for {metric.replace('_', ' ')}.
              Upgrade to continue.
            </p>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Upgrade Plan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-orange-900 text-sm mb-1">
              Approaching Limit
            </h4>
            <p className="text-orange-800 text-sm mb-2">
              You're using {currentValue} of {limit} {metric.replace('_', ' ')}.
            </p>
            <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
              <div
                className="bg-orange-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(percentage * 100, 100)}%` }}
              />
            </div>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="text-sm font-medium text-orange-700 hover:text-orange-900 underline"
              >
                Upgrade to increase limit
              </button>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
