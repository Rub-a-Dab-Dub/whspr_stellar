const BLOCKED_DOMAINS = new Set([
  'pornhub.com',
  'xvideos.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'xnxx.com',
  'malware.com',
  'phishing.example.com',
  // Add more known malicious/adult domains
]);

export function isBlockedDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase().replace('www.', '');
    return BLOCKED_DOMAINS.has(domain);
  } catch {
    return false;
  }
}
