export enum LogType {
  ACTIVITY = 'activity',
  ERROR = 'error',
  SECURITY = 'security',
  AUDIT = 'audit',
}

export enum LogSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorType {
  VALIDATION = 'ValidationError',
  DATABASE = 'DatabaseError',
  API = 'APIError',
  AUTHENTICATION = 'AuthenticationError',
  AUTHORIZATION = 'AuthorizationError',
  NOT_FOUND = 'NotFoundError',
  RATE_LIMIT = 'RateLimitError',
  EXTERNAL_SERVICE = 'ExternalServiceError',
  INTERNAL = 'InternalError',
}

export enum SystemLogCategory {
  DATABASE = 'database',
  CACHE = 'cache',
  QUEUE = 'queue',
  CRON = 'cron',
  EMAIL = 'email',
  STORAGE = 'storage',
  NETWORK = 'network',
}

export enum VideoAnalysisStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface UserLogData {
  userId?: string;
  logType: LogType;
  activityType: string;
  description: string;
  severity?: LogSeverity;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: any;
  stackTrace?: string;
}

export interface ErrorLogData {
  errorCode?: string;
  errorType: ErrorType;
  message: string;
  severity?: LogSeverity;
  stackTrace?: string;
  context?: any;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface VideoAnalysisLogData {
  userId: string;
  auditId?: string;
  videoId: string;
  videoUrl: string;
  videoTitle?: string;
  analysisType: string;
  status: VideoAnalysisStatus;
  stage?: string;
  progressPercentage?: number;
  tokensConsumed?: number;
  promptTokens?: number;
  completionTokens?: number;
  modelUsed?: string;
  costUsd?: number;
  processingTimeMs?: number;
  errorMessage?: string;
  errorCode?: string;
  retryCount?: number;
  metadata?: any;
  results?: any;
}

export interface ApiLogData {
  requestId: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  queryParams?: any;
  requestBody?: any;
  responseBody?: any;
  headers?: any;
  errorMessage?: string;
  rateLimitHit?: boolean;
  cached?: boolean;
  sessionId?: string;
  deviceId?: string;
  geographicalLocation?: any;
}

export interface SystemLogData {
  logLevel: LogSeverity;
  category: SystemLogCategory;
  serviceName: string;
  message: string;
  details?: any;
  stackTrace?: string;
  hostname?: string;
  processId?: number;
  memoryUsageMb?: number;
  cpuUsagePercent?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  requestId?: string;
}

export interface AuditTrailData {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  reason?: string;
  metadata?: any;
}
