export type AllUserInformation = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  picture?: string;
  provider?: SocialProvider | 'email';
  createdAt: Date;
  updatedAt: Date;

  subscription?: Subscription;
  onboarding?: OnBoarding;
  lastActivity?: Date;
  totalAnalyses?: number;
  accountStatus: 'active' | 'locked' | 'inactive';
};

export enum SocialProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  PREMIUM = 'premium',
}

export type Subscription = {
  tier: string;
  status: string;
  currentPeriodEnd?: Date;
};

export type OnBoarding = {
  currentStep: string;
  progressPercentage: number;
  completedAt?: Date;
};

export type UserInformation = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  picture?: string;
  provider?: SocialProvider | 'email';
  createdAt: Date;
  updatedAt: Date;
};
