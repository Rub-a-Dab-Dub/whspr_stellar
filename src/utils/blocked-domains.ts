export const BLOCKED_DOMAINS = ["malicious.com", "phishing.net"];

export function isBlockedDomain(url: string): boolean {
  return BLOCKED_DOMAINS.some(domain => url.includes(domain));
}
