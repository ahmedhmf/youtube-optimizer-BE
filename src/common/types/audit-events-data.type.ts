import { AuditEventCategory } from './audit-event-category.type';
import { AuditEventType } from './audit-event.type';
import { AuditSeverity } from './audit-severity.type';
import { AuditStatus } from './audit-status.type';

export type AuditEventData = {
  userId?: string;
  eventType: AuditEventType;
  eventCategory?: AuditEventCategory;
  severity?: AuditSeverity;
  status?: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  metadata?: Record<string, any>;
  requestId?: string;
};
