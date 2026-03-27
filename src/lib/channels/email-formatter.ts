/**
 * Email message formatter.
 *
 * Email constraints:
 *  - Plain text body (HTML optional but we keep it plain for simplicity)
 *  - No hard character limit, but prefer concise responses
 *  - Headers can remain as ALL-CAPS section titles
 *  - Lists with dashes are fine
 *  - Code blocks shown with --- delimiters
 */

export const EMAIL_MAX_LENGTH = 8000;

/**
 * Format a Sandra response for email delivery (plain text).
 */
export function formatForEmail(text: string): string {
  let out = text;

  // 1. Strip image syntax (consume trailing horizontal whitespace it may leave)
  out = out.replace(/!\[[^\]]*\]\([^)]*\)[ \t]*/g, '');

  // 2. Convert fenced code blocks to indented blocks with markers
  out = out.replace(/```[\w]*\n?([\s\S]*?)```/g, '---\n$1---\n');

  // 3. Strip inline code backticks (keep the text)
  out = out.replace(/`([^`]+)`/g, '$1');

  // 4. Convert headings to plain uppercase section titles
  out = out.replace(/^#{1,3}\s+(.+)$/gm, (_, heading: string) => heading.toUpperCase());
  out = out.replace(/^#{4,6}\s+(.+)$/gm, '$1');

  // 5. Strip bold markers (keep text)
  out = out.replace(/\*\*(.+?)\*\*/g, '$1');
  out = out.replace(/__(.+?)__/g, '$1');

  // 6. Strip italic markers (keep text)
  out = out.replace(/\*(.+?)\*/g, '$1');
  out = out.replace(/_(.+?)_/g, '$1');

  // 7. Convert markdown links to plain text with URL
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 <$2>');

  // 8. Keep dashes as-is for bullet lists (email-friendly)
  out = out.replace(/^[ \t]*[-*+] (.+)$/gm, '  - $1');

  // 9. Collapse excessive blank lines
  out = out.replace(/\n{4,}/g, '\n\n\n');

  // 10. Trim leading newlines and trailing whitespace (not leading spaces — bullets use them)
  out = out.replace(/^\n+/, '').trimEnd();

  // 11. Soft cap for extremely long responses
  if (out.length > EMAIL_MAX_LENGTH) {
    const cutoff = EMAIL_MAX_LENGTH;
    const lastNewline = out.lastIndexOf('\n', cutoff);
    const truncateAt = lastNewline > cutoff - 500 ? lastNewline : cutoff;
    out = out.slice(0, truncateAt) + '\n\n[Message truncated. Reply to continue the conversation.]';
  }

  return out;
}

/**
 * Build a plain-text email body with reply threading context.
 */
export function buildEmailBody(params: {
  response: string;
  signature?: string;
}): string {
  const parts: string[] = [formatForEmail(params.response)];

  if (params.signature) {
    parts.push('', '--', params.signature);
  } else {
    parts.push('', '--', 'Sandra\nAI Assistant — EdLight Initiative');
  }

  return parts.join('\n');
}

/**
 * Extract a clean reply from an email body (strip quoted history).
 * Handles common reply prefixes: "On <date> ... wrote:", "> " lines.
 */
export function extractEmailReply(body: string): string {
  const lines = body.split('\n');
  const replyLines: string[] = [];

  for (const line of lines) {
    // Stop at quoted reply markers
    if (/^>/.test(line)) break;
    if (/^On .+wrote:/.test(line)) break;
    if (/^-{5,}/.test(line)) break;
    replyLines.push(line);
  }

  return replyLines.join('\n').trim();
}
