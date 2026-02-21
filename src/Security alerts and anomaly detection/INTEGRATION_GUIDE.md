/\*\*

- INTEGRATION GUIDE
- ==================
-
- This guide shows how to integrate the Security Alerts & Anomaly Detection system
- with your existing NestJS application.
  \*/

// 1. IMPORT AND SETUP MODULE
// ---------------------------
// In your app.module.ts, import the module:

import { SecurityAlertsModule } from './modules/security-alerts/security-alerts.module';

// Add to imports:
export class AppModule {
// imports: [
// SecurityAlertsModule,
// ]
}

// 2. INJECT SERVICES INTO YOUR MODULES
// ------------------------------------

// Example in your messages module to trigger anomaly detection:

import { Module } from '@nestjs/common';
import { SecurityAlertService } from '@/modules/security-alerts/services/security-alert.service';
import { AnomalyDetectionService } from '@/modules/security-alerts/services/anomaly-detection.service';
import { SecurityAlertsGateway } from '@/modules/security-alerts/gateways/security-alerts.gateway';

// @Module({
// providers: [MessagesService],
// imports: [SecurityAlertsModule],
// })
// export class MessagesModule {}

// 3. CREATE ALERTS PROGRAMMATICALLY
// ---------------------------------

// In your service, inject and use the service:

export class ExampleUsage {
// constructor(
// private securityAlertService: SecurityAlertService,
// private anomalyDetectionService: AnomalyDetectionService,
// private securityGateway: SecurityAlertsGateway,
// ) {}

// Example: Trigger alert when suspicious activity detected
// async createAlertExample() {
// const alert = await this.securityAlertService.createAlert({
// rule: 'spam',
// severity: 'high',
// userId: 'user-123',
// details: {
// messageCount: 150,
// timeWindow: '1 minute',
// threshold: 100,
// },
// });

// // Emit to connected admins via WebSocket
// this.securityGateway.emitSecurityAlert(alert);
// }

// Example: Check for spamming users
// async checkSpamExample() {
// const recentMessages = await this.messageService.getMessages({
// since: new Date(Date.now() - 1 _ 60 _ 1000), // last minute
// });

// await this.anomalyDetectionService.checkSpamRule(
// recentMessages.map(msg => ({
// userId: msg.userId,
// timestamp: msg.createdAt,
// })),
// );
// }

// Example: Update rule configuration
// updateRuleExample() {
// this.anomalyDetectionService.updateRule('spam', {
// threshold: 200, // Change from 100 to 200
// timeWindow: 120000, // Change from 60s to 120s
// });
// }
}

// 4. SCHEDULED ANOMALY CHECKS
// ----------------------------

// The system runs anomaly checks every 10 minutes via the AnomalyCheckJobService
// To customize the schedule, modify the @Cron decorator in anomaly-check-job.service.ts

// Cron expression examples:
// '_/10 _ \* \* _' - Every 10 minutes
// '0 _/1 \* \* _' - Every hour
// '0 0 _ \* \*' - Every day at midnight

// 5. CONFIGURE RULES (SUPER_ADMIN ONLY)
// ------------------------------------

// Example endpoint to configure rules (add to your admin controller):

// @Roles('SUPER_ADMIN')
// @Patch('/admin/security/rules/:ruleName')
// async updateRule(
// @Param('ruleName') ruleName: string,
// @Body() config: Partial<AnomalyRuleConfig>,
// ) {
// return this.anomalyDetectionService.updateRule(ruleName, config);
// }

// 6. USE DATA INTEGRATION SERVICE
// --------------------------------

// The DataIntegrationService provides example methods for fetching data
// Implement actual database queries in these methods and call them from
// the AnomalyCheckJobService.processAnomalyCheck() method

// 7. DATABASE SETUP
// -----------------

// Run migrations to create the security_alerts table:
// npm run migration:run

// 8. ENVIRONMENT VARIABLES
// ------------------------

// Ensure these are set in your .env file:
// DATABASE_HOST=your-db-host
// DATABASE_USER=your-db-user
// DATABASE_PASSWORD=your-db-password
// REDIS_HOST=your-redis-host
// JWT_SECRET=your-jwt-secret

// 9. WEBSOCKET CONNECTION
// -----------------------

// From your frontend, connect to the WebSocket:

// const socket = io('http://localhost:3000/security', {
// query: {
// userId: currentUserId,
// role: userRole,
// },
// transports: ['websocket'],
// });

// Listen for alerts:
// socket.on('security.alert', (alert) => {
// console.log('New security alert:', alert);
// // Update UI, send notification, etc.
// });

// 10. API ENDPOINTS
// -----------------

// List alerts:
// GET /admin/security/alerts?severity=high&status=open&page=1&limit=20
// Authorization: Bearer <token>

// Get specific alert:
// GET /admin/security/alerts/:alertId
// Authorization: Bearer <token>

// Update alert status:
// PATCH /admin/security/alerts/:alertId
// Authorization: Bearer <token>
// Body: { status: 'acknowledged', note: 'Investigating...' }

export default {};
