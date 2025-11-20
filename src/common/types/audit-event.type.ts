export enum AuditEventType {
  // Authentication Events
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',
  LOGOUT_ALL = 'logout_all',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_BLACKLIST = 'token_blacklist',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_COMPLETE = 'password_reset_complete',

  // Account Events
  ACCOUNT_REGISTER = 'account_register',
  ACCOUNT_UPDATE = 'account_update',
  ACCOUNT_DELETE = 'account_delete',
  ACCOUNT_LOCKOUT = 'account_lockout',
  ACCOUNT_UNLOCK = 'account_unlock',

  // Session Events
  SESSION_CREATE = 'session_create',
  SESSION_UPDATE = 'session_update',
  SESSION_DELETE = 'session_delete',
  SESSION_REVOKE = 'session_revoke',

  // Security Events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SECURITY_BREACH = 'security_breach',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',

  // Data Events
  DATA_ACCESS = 'data_access',
  DATA_EXPORT = 'data_export',
  DATA_DELETE = 'data_delete',
  AUDIT_CREATE = 'audit_create',
  AUDIT_DELETE = 'audit_delete',

  // Admin Events
  ADMIN_ACCESS = 'admin_access',
  USER_IMPERSONATION = 'user_impersonation',
  SYSTEM_CONFIG_CHANGE = 'system_config_change',

  // API Events
  API_ACCESS = 'api_access',
  API_ERROR = 'api_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

  // User Feedback Events
  FEEDBACK_SUBMITTED = 'feedback_submitted',
  FEATURE_REQUESTED = 'feature_requested',
  FEATURE_USED = 'feature_used',
}
