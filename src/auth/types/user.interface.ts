import { UserRole } from '../types/roles.types';
import { SocialProvider } from '../dto/social-login.dto';
import { SubscriptionTier, SubscriptionStatus } from '../../DTO/subscription.dto';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  picture?: string;
  provider?: SocialProvider | 'email';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date;
}

export interface UserProfileWithSubscription extends User {
  subscription: UserSubscription;
  usage?: {
    analysesUsed: number;
    analysesAllowed: number;
    usagePercentage: number;
  };
  features?: {
    maxAnalysesPerMonth: number;
    maxChannelsPerUser: number;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    bulkOperations: boolean;
    aiSuggestionsLimit: number;
    exportFeatures: boolean;
    integrations: string[];
  };
}
