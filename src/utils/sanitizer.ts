import sanitizeHtml from "sanitize-html";

export function sanitizeContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
}
