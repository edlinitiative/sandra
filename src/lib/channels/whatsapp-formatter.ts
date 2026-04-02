/**
 * WhatsApp message formatter.
 *
 * WhatsApp Cloud API constraints:
 *  - Plain text only for text messages (no HTML, limited markdown)
 *  - Max 4096 characters per message
 *  - Bold: *text*, Italic: _text_, Strikethrough: ~text~
 *  - No headings, no tables, no nested lists
 */

export const WHATSAPP_MAX_LENGTH = 4096;
export const WHATSAPP_TRUNCATION_SUFFIX = '\n\n_(Message truncated. Ask me to continue.)_';

/**
 * Format a Sandra response for WhatsApp delivery.
 */
export function formatForWhatsApp(text: string): string {
  let out = text;

  // 1. Convert ## headings → bold
  out = out.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 2. Convert **bold** / __bold__ → WhatsApp *bold*
  out = out.replace(/\*\*(.+?)\*\*/g, '*$1*');
  out = out.replace(/__(.+?)__/g, '*$1*');

  // 3. Strip image syntax BEFORE link conversion (otherwise link regex eats the [alt] part)
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 4. Fenced code blocks → plain with divider (BEFORE inline code to avoid garbling ```)
  out = out.replace(/```[\w]*\n([\s\S]*?)```/g, '---\n$1---');

  // 5. Inline code → plain text
  out = out.replace(/`([^`]+)`/g, '$1');

  // 6. Markdown links [label](url) → label (url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // 7. Normalise bullet lists
  out = out.replace(/^[ \t]*[-*+] (.+)$/gm, '• $1');

  // 8. Collapse 3+ blank lines to 2
  out = out.replace(/\n{3,}/g, '\n\n');

  // 9. Trim
  out = out.trim();

  // 10. Enforce max length
  if (out.length > WHATSAPP_MAX_LENGTH) {
    const cutoff = WHATSAPP_MAX_LENGTH - WHATSAPP_TRUNCATION_SUFFIX.length;
    const lastNewline = out.lastIndexOf('\n', cutoff);
    const truncateAt = lastNewline > cutoff - 200 ? lastNewline : cutoff;
    out = out.slice(0, truncateAt) + WHATSAPP_TRUNCATION_SUFFIX;
  }

  return out;
}

/**
 * Split a long message into chunks safe for WhatsApp delivery.
 */
export function splitForWhatsApp(text: string, maxChunkLength = WHATSAPP_MAX_LENGTH): string[] {
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

/**
 * Friendly status label while a tool is executing.
 */
export function buildTypingIndicatorText(toolName: string): string {
  const labels: Record<string, string> = {
    searchKnowledgeBase: '🔍 Searching knowledge base…',
    lookupRepoInfo: '🔍 Looking up repository info…',
    getCourseInventory: '📚 Looking up courses…',
    getProgramsAndScholarships: '🎓 Looking up programs…',
    getLatestNews: '📰 Fetching latest news…',
    getProgramDeadlines: '📅 Checking deadlines…',
    getEdLightInitiatives: '💡 Looking up EdLight initiatives…',
    getContactInfo: '📞 Finding contact info…',
    getUserProfileSummary: '👤 Loading your profile…',
    getUserEnrollments: '📋 Fetching your enrollments…',
    getUserCertificates: '🏅 Loading your certificates…',
    getApplicationStatus: '📝 Checking application status…',
  };
  return labels[toolName] ?? '⏳ Working on it…';
}
