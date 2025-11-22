export interface UsageOverviewDto {
  userId: string;
  email: string;
  name: string;
  subscriptionTier: string;

  videoAnalysis: {
    totalAnalyzed: number;
    monthlyAnalyzed: number;
    limit: number;
    remaining: number;
    percentageUsed: number;
  };

  tokens: {
    totalUsed: number;
    monthlyUsed: number;
    limit: number;
    remaining: number;
    percentageUsed: number;
    breakdown: Array<{
      featureType: string;
      tokensConsumed: number;
      percentage: number;
    }>;
  };

  apiCalls: {
    totalCalls: number;
    monthlyCallsCount: number;
    limit: number;
    remaining: number;
    percentageUsed: number;
    byEndpoint: Array<{
      endpoint: string;
      count: number;
      percentage: number;
    }>;
  };

  recentActivities: Array<{
    id: string;
    activityType: string;
    description: string;
    timestamp: Date;
    metadata?: any;
  }>;

  videoAnalysisHistory: Array<{
    id: string;
    videoId: string;
    videoTitle: string;
    videoUrl: string;
    analysisType: string;
    tokensUsed: number;
    status: string;
    createdAt: Date;
    completedAt?: Date;
    results?: any;
  }>;

  period: {
    startDate: Date;
    endDate: Date;
    daysRemaining: number;
  };
}
