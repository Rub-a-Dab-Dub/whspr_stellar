export enum EmailType {
  WELCOME = 'welcome',
  VERIFICATION = 'verification',
  TRANSACTION_RECEIPT = 'transaction_receipt',
  GROUP_INVITE = 'group_invite',
  SECURITY_ALERT = 'security_alert',
  GENERIC = 'generic',
}

export enum EmailDeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}
