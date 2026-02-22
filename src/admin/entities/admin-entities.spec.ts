import {
  AuditAction,
  AuditEventType,
  AuditLog,
  AuditOutcome,
  AuditSeverity,
} from './audit-log.entity';
import { AuditLogArchive } from './audit-log-archive.entity';
import {
  AuditAlert,
  AuditAlertSeverity,
  AuditAlertType,
} from './audit-alert.entity';
import { DataAccessAction, DataAccessLog } from './data-access-log.entity';
import { IpWhitelist } from './ip-whitelist.entity';
import { PlatformConfig } from './platform-config.entity';

describe('Admin entities', () => {
  it('exposes key audit/data enums', () => {
    expect(AuditAction.USER_BANNED).toBe('user.banned');
    expect(AuditEventType.AUTH).toBe('auth');
    expect(AuditOutcome.SUCCESS).toBe('success');
    expect(AuditSeverity.CRITICAL).toBe('critical');
    expect(AuditAlertType.DATA_EXPORT).toBe('data.export');
    expect(AuditAlertSeverity.HIGH).toBe('high');
    expect(DataAccessAction.EXPORT).toBe('export');
  });

  it('enforces immutability hooks on audit log', () => {
    const entity = new AuditLog();
    expect(() => entity.preventUpdate()).toThrow('Audit logs are immutable.');
    expect(() => entity.preventRemove()).toThrow('Audit logs are immutable.');
  });

  it('can instantiate archive and other entity shapes', () => {
    const archive = new AuditLogArchive();
    archive.action = AuditAction.AUDIT_LOG_VIEWED;
    archive.eventType = AuditEventType.ADMIN;

    const alert = new AuditAlert();
    alert.alertType = AuditAlertType.ADMIN_BULK_ACTION;
    alert.severity = AuditAlertSeverity.MEDIUM;

    const access = new DataAccessLog();
    access.action = DataAccessAction.VIEW;
    access.resourceType = 'user';

    const whitelist = new IpWhitelist();
    whitelist.ipCidr = '10.0.0.0/24';

    const config = new PlatformConfig();
    config.key = 'feature.flag';

    expect(archive.action).toBe(AuditAction.AUDIT_LOG_VIEWED);
    expect(alert.alertType).toBe(AuditAlertType.ADMIN_BULK_ACTION);
    expect(access.resourceType).toBe('user');
    expect(whitelist.ipCidr).toBe('10.0.0.0/24');
    expect(config.key).toBe('feature.flag');
  });
});
