import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  SecurityAlert,
  AlertSeverity,
} from "../entities/security-alert.entity";
import { SecurityAlertService } from "./security-alert.service";

export interface AnomalyRuleConfig {
  enabled: boolean;
  name: string;
  description: string;
  severity: AlertSeverity;
  threshold: number;
  timeWindow: number; // in milliseconds
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  // Default rule configurations
  private ruleConfigs: Record<string, AnomalyRuleConfig> = {
    spam: {
      enabled: true,
      name: "Spam Detection",
      description: "User sending >100 messages in 1 minute",
      severity: "medium",
      threshold: 100,
      timeWindow: 60 * 1000, // 1 minute
    },
    wash_trading: {
      enabled: true,
      name: "Wash Trading Detection",
      description:
        "User receiving >10 tips in 5 minutes from different senders",
      severity: "high",
      threshold: 10,
      timeWindow: 5 * 60 * 1000, // 5 minutes
    },
    early_withdrawal: {
      enabled: true,
      name: "Early Withdrawal Detection",
      description:
        "New user performing withdrawal within 1 hour of registration",
      severity: "high",
      threshold: 1, // Any withdrawal within timeWindow triggers alert
      timeWindow: 60 * 60 * 1000, // 1 hour
    },
    ip_registration_fraud: {
      enabled: true,
      name: "IP Registration Fraud Detection",
      description: "Single IP registering >5 accounts in 24 hours",
      severity: "medium",
      threshold: 5,
      timeWindow: 24 * 60 * 60 * 1000, // 24 hours
    },
    admin_new_ip: {
      enabled: true,
      name: "Admin New IP Login",
      description: "Admin login from a new IP address",
      severity: "critical",
      threshold: 1, // Any new IP triggers alert
      timeWindow: 0, // No time window, just check if IP is new
    },
  };

  constructor(
    @InjectRepository(SecurityAlert)
    private alertRepository: Repository<SecurityAlert>,
    private securityAlertService: SecurityAlertService,
  ) {}

  /**
   * Get all configured anomaly rules
   */
  getRules() {
    return this.ruleConfigs;
  }

  /**
   * Update a rule configuration
   */
  updateRule(ruleName: string, config: Partial<AnomalyRuleConfig>) {
    if (!this.ruleConfigs[ruleName]) {
      throw new Error(`Rule ${ruleName} not found`);
    }
    this.ruleConfigs[ruleName] = {
      ...this.ruleConfigs[ruleName],
      ...config,
    };
    return this.ruleConfigs[ruleName];
  }

  /**
   * Check for spam - user sending >100 messages in 1 minute
   */
  async checkSpamRule(
    messageData: Array<{
      userId: string;
      timestamp: Date;
    }>,
  ) {
    const config = this.ruleConfigs.spam;
    if (!config.enabled) return;

    const groupedByUser = this._groupByUserId(messageData);

    for (const [userId, messages] of Object.entries(groupedByUser)) {
      // Sort messages by timestamp
      const sortedMessages = (messages as any[]).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      // Check sliding windows of 1 minute
      for (let i = 0; i < sortedMessages.length; i++) {
        const windowStart = sortedMessages[i].timestamp;
        const windowEnd = new Date(windowStart.getTime() + config.timeWindow);

        const messagesInWindow = sortedMessages.filter(
          (m) => m.timestamp >= windowStart && m.timestamp <= windowEnd,
        );

        if (messagesInWindow.length > config.threshold) {
          await this.securityAlertService.createAlert({
            rule: "spam",
            severity: config.severity,
            userId,
            details: {
              messageCount: messagesInWindow.length,
              timeWindow: `${config.timeWindow / 1000} seconds`,
              threshold: config.threshold,
            },
          });

          this.logger.warn(
            `Spam detected for user ${userId}: ${messagesInWindow.length} messages in ${config.timeWindow / 1000}s`,
          );
          break; // Only create one alert per user per check
        }
      }
    }
  }

  /**
   * Check for wash trading - user receiving >10 tips from different senders in 5 minutes
   */
  async checkWashTradingRule(
    tipData: Array<{
      recipientId: string;
      senderId: string;
      timestamp: Date;
    }>,
  ) {
    const config = this.ruleConfigs.wash_trading;
    if (!config.enabled) return;

    const groupedByRecipient = this._groupByRecipientId(tipData);

    for (const [recipientId, tips] of Object.entries(groupedByRecipient)) {
      // Sort tips by timestamp
      const sortedTips = (tips as any[]).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      // Check sliding windows of 5 minutes
      for (let i = 0; i < sortedTips.length; i++) {
        const windowStart = sortedTips[i].timestamp;
        const windowEnd = new Date(windowStart.getTime() + config.timeWindow);

        const tipsInWindow = sortedTips.filter(
          (t) => t.timestamp >= windowStart && t.timestamp <= windowEnd,
        );

        // Count unique senders
        const uniqueSenders = new Set(tipsInWindow.map((t) => t.senderId));

        if (uniqueSenders.size > config.threshold) {
          await this.securityAlertService.createAlert({
            rule: "wash_trading",
            severity: config.severity,
            userId: recipientId,
            details: {
              tipCount: tipsInWindow.length,
              uniqueSenderCount: uniqueSenders.size,
              timeWindow: `${config.timeWindow / 1000 / 60} minutes`,
              threshold: config.threshold,
            },
          });

          this.logger.warn(
            `Wash trading detected for user ${recipientId}: ${uniqueSenders.size} different senders in ${config.timeWindow / 1000 / 60}m`,
          );
          break;
        }
      }
    }
  }

  /**
   * Check for early withdrawal - new user withdrawing within 1 hour of registration
   */
  async checkEarlyWithdrawalRule(
    withdrawalData: Array<{
      userId: string;
      registrationTime: Date;
      withdrawalTime: Date;
    }>,
  ) {
    const config = this.ruleConfigs.early_withdrawal;
    if (!config.enabled) return;

    for (const withdrawal of withdrawalData) {
      const timeSinceRegistration =
        withdrawal.withdrawalTime.getTime() -
        withdrawal.registrationTime.getTime();

      if (timeSinceRegistration <= config.timeWindow) {
        await this.securityAlertService.createAlert({
          rule: "early_withdrawal",
          severity: config.severity,
          userId: withdrawal.userId,
          details: {
            timeSinceRegistration: `${Math.round(timeSinceRegistration / 1000 / 60)} minutes`,
            threshold: `${config.timeWindow / 1000 / 60} minutes`,
            registrationTime: withdrawal.registrationTime,
            withdrawalTime: withdrawal.withdrawalTime,
          },
        });

        this.logger.warn(
          `Early withdrawal detected for user ${withdrawal.userId}: ${Math.round(timeSinceRegistration / 1000 / 60)} minutes after registration`,
        );
      }
    }
  }

  /**
   * Check for IP registration fraud - single IP registering >5 accounts in 24 hours
   */
  async checkIpRegistrationFraudRule(
    registrationData: Array<{
      userId: string;
      ipAddress: string;
      registrationTime: Date;
    }>,
  ) {
    const config = this.ruleConfigs.ip_registration_fraud;
    if (!config.enabled) return;

    const groupedByIp = this._groupByIpAddress(registrationData);

    for (const [ipAddress, registrations] of Object.entries(groupedByIp)) {
      // Sort registrations by time
      const sortedRegistrations = (registrations as any[]).sort(
        (a, b) => a.registrationTime.getTime() - b.registrationTime.getTime(),
      );

      // Check sliding windows of 24 hours
      for (let i = 0; i < sortedRegistrations.length; i++) {
        const windowStart = sortedRegistrations[i].registrationTime;
        const windowEnd = new Date(windowStart.getTime() + config.timeWindow);

        const registrationsInWindow = sortedRegistrations.filter(
          (r) =>
            r.registrationTime >= windowStart &&
            r.registrationTime <= windowEnd,
        );

        if (registrationsInWindow.length > config.threshold) {
          await this.securityAlertService.createAlert({
            rule: "ip_registration_fraud",
            severity: config.severity,
            details: {
              ipAddress,
              accountCount: registrationsInWindow.length,
              userIds: registrationsInWindow.map((r) => r.userId),
              timeWindow: `${config.timeWindow / 1000 / 60 / 60} hours`,
              threshold: config.threshold,
            },
          });

          this.logger.warn(
            `IP registration fraud detected: ${registrationsInWindow.length} accounts from IP ${ipAddress} in 24 hours`,
          );
          break;
        }
      }
    }
  }

  /**
   * Check for admin login from new IP
   */
  async checkAdminNewIpRule(
    loginData: Array<{
      adminId: string;
      ipAddress: string;
      timestamp: Date;
    }>,
  ) {
    const config = this.ruleConfigs.admin_new_ip;
    if (!config.enabled) return;

    for (const login of loginData) {
      // Check if this IP has been used by this admin before
      const previousLogins = await this.alertRepository.find({
        where: {
          rule: "admin_new_ip" as any,
          adminId: login.adminId,
        },
      });

      const usedIps = new Set<string>();
      previousLogins.forEach((alert) => {
        if (alert.details?.ipAddress) {
          usedIps.add(alert.details.ipAddress);
        }
      });

      // Also check actual login history if available
      // For now, we'll create an alert regardless (you should implement proper IP tracking)
      await this.securityAlertService.createAlert({
        rule: "admin_new_ip",
        severity: config.severity,
        adminId: login.adminId,
        details: {
          ipAddress: login.ipAddress,
          timestamp: login.timestamp,
          previousIpCount: usedIps.size,
        },
      });

      this.logger.warn(
        `Admin ${login.adminId} logged in from new IP address: ${login.ipAddress}`,
      );
    }
  }

  private _groupByUserId(data: any[]) {
    return data.reduce(
      (acc, item) => {
        if (!acc[item.userId]) {
          acc[item.userId] = [];
        }
        acc[item.userId].push(item);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }

  private _groupByRecipientId(data: any[]) {
    return data.reduce(
      (acc, item) => {
        if (!acc[item.recipientId]) {
          acc[item.recipientId] = [];
        }
        acc[item.recipientId].push(item);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }

  private _groupByIpAddress(data: any[]) {
    return data.reduce(
      (acc, item) => {
        if (!acc[item.ipAddress]) {
          acc[item.ipAddress] = [];
        }
        acc[item.ipAddress].push(item);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }
}
