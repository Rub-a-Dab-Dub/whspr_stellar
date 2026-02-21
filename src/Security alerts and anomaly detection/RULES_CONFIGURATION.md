/\*\*

- ANOMALY DETECTION RULES CONFIGURATION GUIDE
- ============================================
-
- This document describes each anomaly detection rule and how to configure them.
  \*/

// RULE 1: SPAM DETECTION
// ======================
// Description: Detects users sending excessive messages in a short time period
//
// Default Configuration:
// - Threshold: 100 messages
// - Time Window: 1 minute (60,000 ms)
// - Severity: MEDIUM
//
// Configuration Example:
// {
// enabled: true,
// threshold: 100, // Number of messages
// timeWindow: 60000, // Milliseconds
// severity: 'medium'
// }
//
// Use Case: Prevent spam/bot abuse and automated message flooding
// Detection Method: Sliding window analysis per user

// RULE 2: WASH TRADING DETECTION
// ===============================
// Description: Detects suspicious tip patterns suggesting wash trading
// (user receiving tips from many different users in short time)
//
// Default Configuration:
// - Threshold: 10 unique senders
// - Time Window: 5 minutes (300,000 ms)
// - Severity: HIGH
//
// Configuration Example:
// {
// enabled: true,
// threshold: 10, // Number of unique senders
// timeWindow: 300000, // Milliseconds (5 minutes)
// severity: 'high'
// }
//
// Use Case: Combat fraudulent trading and artificial volume manipulation
// Detection Method: Count unique senders within time window per recipient

// RULE 3: EARLY WITHDRAWAL DETECTION
// ===================================
// Description: Detects new users withdrawing funds too soon after registration
// (potential sign of funds being transferred to another account or fraud)
//
// Default Configuration:
// - Threshold: Any withdrawal
// - Time Window: 1 hour (3,600,000 ms)
// - Severity: HIGH
//
// Configuration Example:
// {
// enabled: true,
// threshold: 1, // Any withdrawal triggers alert
// timeWindow: 3600000, // Milliseconds (1 hour)
// severity: 'high'
// }
//
// Use Case: Identify account takeovers, money laundering, and fraud schemes
// Detection Method: Check withdrawal time against registration time

// RULE 4: IP REGISTRATION FRAUD DETECTION
// ========================================
// Description: Detects multiple account registrations from the same IP address
// (indicates automated account creation or coordinated fraud)
//
// Default Configuration:
// - Threshold: 5 accounts
// - Time Window: 24 hours (86,400,000 ms)
// - Severity: MEDIUM
//
// Configuration Example:
// {
// enabled: true,
// threshold: 5, // Number of accounts from same IP
// timeWindow: 86400000, // Milliseconds (24 hours)
// severity: 'medium'
// }
//
// Use Case: Prevent mass account creation and identify botnets
// Detection Method: Group registrations by IP address, count within window

// RULE 5: ADMIN LOGIN FROM NEW IP
// ===============================
// Description: Detects admin users logging in from previously unseen IP addresses
// (indicates potential account compromise or unauthorized access)
//
// Default Configuration:
// - Threshold: Any new IP
// - Time Window: Not applicable (historical check)
// - Severity: CRITICAL
//
// Configuration Example:
// {
// enabled: true,
// threshold: 1, // Any login from new IP
// timeWindow: 0, // No time window, historical check
// severity: 'critical'
// }
//
// Use Case: Detect and alert on unauthorized admin access attempts
// Detection Method: Check if IP has been used before by admin

// SEVERITY LEVELS
// ===============
// - LOW: Minor issues, background investigation recommended
// - MEDIUM: Notable activity, review within 24 hours recommended
// - HIGH: Significant concern, review within 1 hour recommended
// - CRITICAL: Immediate action required, real-time WebSocket notification sent

// ALERT STATUS LIFECYCLE
// ======================
// - OPEN: Alert just created, awaiting review
// - ACKNOWLEDGED: Admin has reviewed the alert
// - RESOLVED: Alert investigation complete

// CONFIGURATION VIA API
// ======================
//
// Endpoint for SUPER_ADMIN to update rule:
// PATCH /admin/security/rules/:ruleName
// Authorization: Bearer <token>
//
// Body:
// {
// "enabled": true,
// "threshold": 100,
// "timeWindow": 60000,
// "severity": "medium"
// }
//
// Example Update Rule:
// curl -X PATCH http://localhost:3000/admin/security/rules/spam \
// -H "Authorization: Bearer your-token" \
// -H "Content-Type: application/json" \
// -d '{
// "threshold": 200,
// "severity": "high"
// }'

// DYNAMIC CONFIGURATION BEST PRACTICES
// ====================================
//
// 1. Start Conservative
// Begin with higher thresholds and relax over time
// Example: Start with spam threshold of 500, reduce as you tune
//
// 2. Time Zone Awareness
// Consider your users' time zones when setting time windows
// A 1-minute window for spam detection works globally
//
// 3. Monitor False Positives
// Track alert accuracy and adjust thresholds accordingly
// Use WebSocket connection to monitor real-time alerts
//
// 4. Business Context
// Adjust rules based on your business model
// Micro-transaction platform may need different settings than enterprise app
//
// 5. Gradual Rollout
// Enable new rules with low severity first
// Upgrade severity as you validate detection accuracy
//
// 6. Rule Combinations
// Consider using alerts together (e.g., spam + wash trading = fraud ring)
// Implement scoring/weighting system if needed

// EXAMPLE RULE CONFIGURATIONS FOR DIFFERENT SCENARIOS
// ===================================================

// Conservative (fewer false positives):
// {
// spam: {
// threshold: 500, // Very high message count
// timeWindow: 60000,
// severity: 'low'
// },
// wash_trading: {
// threshold: 50, // Many unique senders required
// timeWindow: 300000,
// severity: 'medium'
// },
// early_withdrawal: {
// threshold: 1,
// timeWindow: 3600000, // Only block within 1 hour
// severity: 'medium'
// },
// ip_registration_fraud: {
// threshold: 20, // Many accounts required
// timeWindow: 86400000,
// severity: 'low'
// }
// }

// Aggressive (catch more potential issues):
// {
// spam: {
// threshold: 50, // Lower message count
// timeWindow: 60000,
// severity: 'high'
// },
// wash_trading: {
// threshold: 5, // Fewer unique senders
// timeWindow: 300000,
// severity: 'critical'
// },
// early_withdrawal: {
// threshold: 1,
// timeWindow: 7200000, // Block within 2 hours
// severity: 'high'
// },
// ip_registration_fraud: {
// threshold: 3, // Fewer accounts required
// timeWindow: 86400000,
// severity: 'medium'
// }
// }

export default {};
