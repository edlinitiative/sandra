/**
 * Voice message formatter.
 *
 * Voice constraints:
 *  - Plain spoken text only — no markdown, no URLs, no code blocks
 *  - Shorter responses (~500 chars / ~75 words) for comfortable listening
 *  - Bullet lists converted to natural language enumeration
 *  - Code blocks replaced by a spoken description placeholder
 *  - Links stripped to label only (URLs are not speakable)
 */

export const VOICE_MAX_LENGTH = 500;
export const VOICE_TRUNCATION_SUFFIX = '… and more. Ask me to continue if you would like.';

/**
 * Format a Sandra response for voice/TTS output.
 * Produces clean, natural-sounding plain text.
 */
export function formatForVoice(text: string): string {
  let out = text;

  // 1. Strip image syntax
  out = out.replace(/!\[[^\]]*\]\([^)]*\)[ \t]*/g, '');

  // 2. Replace fenced code blocks with a spoken placeholder
  out = out.replace(/```[\w]*\n?([\s\S]*?)```/g, '(code block omitted)');

  // 3. Strip inline code backticks (keep the text)
  out = out.replace(/`([^`]+)`/g, '$1');

  // 4. Strip heading markers (keep text, add line break)
  out = out.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  // 5. Strip bold markers (keep text)
  out = out.replace(/\*\*(.+?)\*\*/g, '$1');
  out = out.replace(/__(.+?)__/g, '$1');

  // 6. Strip italic markers (keep text)
  out = out.replace(/\*(.+?)\*/g, '$1');
  out = out.replace(/_(.+?)_/g, '$1');

  // 7. Links — keep label only (URL not speakable)
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 8. Bullet lists → spoken enumeration with natural phrasing
  out = out.replace(/^[ \t]*[-*+] (.+)$/gm, '$1.');

  // 9. Collapse multiple blank lines to a single break
  out = out.replace(/\n{3,}/g, '\n\n');

  // 10. Trim leading newlines, trailing whitespace
  out = out.replace(/^\n+/, '').trimEnd();

  // 11. Soft cap for voice — truncate at sentence boundary if possible
  if (out.length > VOICE_MAX_LENGTH) {
    const cutoff = VOICE_MAX_LENGTH;
    // Try to break at sentence end (. ! ?) near the cutoff
    const sentenceEnd = out.slice(0, cutoff).search(/[.!?][^.!?]*$/);
    const truncateAt = sentenceEnd > cutoff - 150 ? sentenceEnd + 1 : cutoff;
    out = out.slice(0, truncateAt).trimEnd() + ' ' + VOICE_TRUNCATION_SUFFIX;
  }

  return out;
}

/**
 * Estimate spoken duration in seconds based on average reading rate.
 * Assumes ~150 words per minute for natural spoken English/Creole.
 */
export function estimateSpeakDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60);
}
