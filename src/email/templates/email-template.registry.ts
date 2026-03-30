import { EmailType } from '../enums/email-type.enum';

export interface EmailTemplateDefinition {
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_TEMPLATE_REGISTRY: Record<EmailType, EmailTemplateDefinition> = {
  [EmailType.WELCOME]: {
    subject: 'Welcome to WHSPR Stellar, {{displayName}}',
    html: '<html><body><h1>Welcome, {{displayName}}</h1><p>Your account is ready to use.</p><p><a href="{{appUrl}}">Open WHSPR Stellar</a></p>{{unsubscribeLink}}</body></html>',
    text: 'Welcome, {{displayName}}. Your account is ready. Visit {{appUrl}}. {{unsubscribeText}}',
  },
  [EmailType.VERIFICATION]: {
    subject: 'Verify your email address',
    html: '<html><body><h1>Verify your email</h1><p>Hi {{displayName}}, click below to verify your email address.</p><p><a href="{{verificationUrl}}">Verify email</a></p></body></html>',
    text: 'Hi {{displayName}}, verify your email here: {{verificationUrl}}',
  },
  [EmailType.TRANSACTION_RECEIPT]: {
    subject: 'Your transaction receipt',
    html: '<html><body><h1>Transaction receipt</h1><p>{{displayName}}, we processed {{amount}} {{asset}}.</p><p>Transaction reference: {{reference}}</p></body></html>',
    text: '{{displayName}}, we processed {{amount}} {{asset}}. Transaction reference: {{reference}}',
  },
  [EmailType.GROUP_INVITE]: {
    subject: 'You were invited to join {{groupName}}',
    html: '<html><body><h1>Group invitation</h1><p>{{inviterName}} invited you to {{groupName}}.</p><p><a href="{{inviteUrl}}">Accept invite</a></p>{{unsubscribeLink}}</body></html>',
    text: '{{inviterName}} invited you to {{groupName}}. Accept invite: {{inviteUrl}} {{unsubscribeText}}',
  },
  [EmailType.SECURITY_ALERT]: {
    subject: 'Security alert for your account',
    html: '<html><body><h1>Security alert</h1><p>{{displayName}}, {{message}}</p><p><a href="{{actionUrl}}">Review activity</a></p></body></html>',
    text: '{{displayName}}, {{message}} Review activity: {{actionUrl}}',
  },
  [EmailType.GENERIC]: {
    subject: '{{subject}}',
    html: '<html><body><h1>{{heading}}</h1><p>{{body}}</p>{{unsubscribeLink}}</body></html>',
    text: '{{heading}} {{body}} {{unsubscribeText}}',
  },
};
