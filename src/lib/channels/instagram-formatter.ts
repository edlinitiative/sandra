/**
 * Instagram message formatter.
 *
 * Instagram Messaging API constraints:
 *  - Plain text only for text messages
 *  - Max 1000 characters per message
 *  - No rich formatting (bold, italic, etc.)
 *  - No headers, tables, or nested lists
 */

export const INSTAGRAM_MAX_LENGTH = 1000;
export const INSTAGRAM_TRUNCATION_SUFFIX = '\n\n(Message truncated. Ask me to continue.)';

/**
 * Format a Sandra response for Instagram DM delivery.
 * Strips all Markdown and enforces the 1000-char limit.
 */
export function formatForInstagram(text: string): string {
  let out = text;

  // 1. Strip image syntax before link conversion
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 2. Fenced code blocks → plain (no divider — keep it conversational)
  out = out.replace(/```[\w]*\n?([\s\S]*?)```/g, '$1');

  // 3. Strip inline code backticks
  out = out.replace(/`([^`]+)`/g, '$1');

  // 4. Strip headings (## Heading → Heading)
  out = out.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  // 5. Strip bold/italic markers
  out = out.replace(/\*\*(.+?)\*\*/g, '$1');
  out = out.replace(/__(.+?)__/g, '$1');
  out = out.replace(/\*(.+?)\*/g, '$1');
  out = out.replace(/_(.+?)_/g, '$1');

  // 6. Convert links [label](url) → label: url
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');

  // 7. Normalise bullet lists
  out = out.replace(/^[ \t]*[-*+] (.+)$/gm, '• $1');

  // 8. Collapse multiple blank lines
  out = out.replace(/\n{3,}/g, '\n\n');

  // 9. Trim
  out = out.trim();

  // 10. Enforce 1000-char limit
  if (out.length > INSTAGRAM_MAX_LENGTH) {
    const cutoff = INSTAGRAM_MAX_LENGTH - INSTAGRAM_TRUNCATION_SUFFIX.length;
    const lastNewline = out.lastIndexOf('\n', cutoff);
    const truncateAt = lastNewline > cutoff - 100 ? lastNewline : cutoff;
    out = out.slice(0, truncateAt) + INSTAGRAM_TRUNCATION_SUFFIX;
  }

  return out;
}

/**
 * Split a response into Instagram-safe chunks (≤ 1000 chars each).
 */
export function splitForInstagram(text: string, maxChunkLength = INSTAGRAM_MAX_LENGTH): string[] {
  if (!text.trim()) return [];
  if (text.length <= maxChunkLength) return [text.trim()];

  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');
  let current = '';

  for (const para of paragraphs) {
    const addition = current ? `\n\n${para}` : para;
    if (current.length + addition.length <= maxChunkLength) {
      current += addition;
    } else {
      if (current) chunks.push(current.trim());
      if (para.length > maxChunkLength) {
        let remaining = para;
        while (remaining.length > maxChunkLength) {
          chunks.push(remaining.slice(0, maxChunkLength).trim());
          remaining = remaining.slice(maxChunkLength);
        }
        current = remaining;
      } else {
        current = para;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
