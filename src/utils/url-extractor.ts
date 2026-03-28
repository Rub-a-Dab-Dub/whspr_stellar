export function extractUrlsFromMessage(message: string): string[] {
  const regex = /(https?:\/\/[^\s]+)/g;
  return message.match(regex) || [];
}
