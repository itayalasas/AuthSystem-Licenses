import { AlertCircle, Clock, XCircle } from 'lucide-react';
import type { Subscription } from '../lib/subscription';

interface SubscriptionBannerProps {
  subscription: Subscription;
  daysRemaining: number;
  onUpgradeClick: () => void;
}

export function SubscriptionBanner({ subscription, daysRemaining, onUpgradeClick }: SubscriptionBannerProps) {
  if (subscription.status === 'active' && daysRemaining > 7) {
    return null;
  }

  const getBannerConfig = () => {
    if (subscription.status === 'trialing') {
      if (daysRemaining <= 0) {
        return {
          icon: XCircle,
          color: 'bg-red-50 border-red-200 text-red-800',
          iconColor: 'text-red-500',
          title: 'Trial Expired',
          message: 'Your trial period has ended. Upgrade now to continue using all features.',
          buttonText: 'Upgrade Now',
          urgent: true,
        };
      }
      if (daysRemaining <= 3) {
        return {
          icon: AlertCircle,
          color: 'bg-orange-50 border-orange-200 text-orange-800',
          iconColor: 'text-orange-500',
          title: `Trial Ending Soon`,
          message: `Your trial expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}. Upgrade to keep access.`,
          buttonText: 'View Plans',
          urgent: true,
        };
      }
      return {
        icon: Clock,
        color: 'bg-blue-50 border-blue-200 text-blue-800',
        iconColor: 'text-blue-500',
        title: 'Trial Active',
        message: `${daysRemaining} days remaining in your trial. Upgrade anytime for full access.`,
        buttonText: 'View Plans',
        urgent: false,
      };
    }

    if (subscription.status === 'past_due') {
      return {
        icon: AlertCircle,
        color: 'bg-red-50 border-red-200 text-red-800',
        iconColor: 'text-red-500',
        title: 'Payment Required',
        message: 'Your payment is overdue. Please update your payment method to restore access.',
        buttonText: 'Update Payment',
        urgent: true,
      };
    }

    if (subscription.status === 'canceled') {
      return {
        icon: XCircle,
        color: 'bg-gray-50 border-gray-200 text-gray-800',
        iconColor: 'text-gray-500',
        title: 'Subscription Canceled',
        message: 'Your subscription has been canceled. Reactivate to continue using the platform.',
        buttonText: 'Reactivate',
        urgent: true,
      };
    }

    if (subscription.status === 'paused') {
      return {
        icon: AlertCircle,
        color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        iconColor: 'text-yellow-500',
        title: 'Subscription Paused',
        message: 'Your subscription is currently paused. Resume to continue using all features.',
        buttonText: 'Resume',
        urgent: false,
      };
    }

    if (daysRemaining <= 7) {
      return {
        icon: Clock,
        color: 'bg-blue-50 border-blue-200 text-blue-800',
        iconColor: 'text-blue-500',
        title: 'Renewal Coming Up',
        message: `Your subscription renews in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.`,
        buttonText: 'Manage Subscription',
        urgent: false,
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={`border rounded-lg p-4 ${config.color}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${config.iconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">{config.title}</h3>
          <p className="text-sm opacity-90">{config.message}</p>
        </div>
        <button
          onClick={onUpgradeClick}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all flex-shrink-0
            ${config.urgent
              ? 'bg-white shadow-sm hover:shadow border border-current hover:scale-105'
              : 'bg-white/50 hover:bg-white/80'
            }
          `}
        >
          {config.buttonText}
        </button>
      </div>
    </div>
  );
}
