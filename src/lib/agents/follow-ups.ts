import type { SupportedLanguage } from '@/lib/i18n/types';

/**
 * Default follow-up suggestions. These are generic and work for any tenant.
 * Tenants can provide their own follow-up map via TenantAgentConfig.additionalContext.
 *
 * Follow-up suggestion pools keyed by tool name and language.
 * Returns 2–3 contextually relevant next questions after a response.
 */
const FOLLOW_UP_POOLS: Record<string, Record<SupportedLanguage, string[]>> = {
  getCourseInventory: {
    en: ['How do I enroll in a course?', 'Which course should a beginner start with?', 'Are these courses free?', 'Do I get a certificate?'],
    fr: ['Comment m\'inscrire à un cours ?', 'Quel cours un débutant devrait-il commencer ?', 'Ces cours sont-ils gratuits ?', 'Reçoit-on un certificat ?'],
    ht: ['Kijan mwen ka enskri nan yon kou?', 'Ki kou yon debutant ta dwe kòmanse?', 'Èske kou sa yo gratis?', 'Èske mwen resevwa yon sètifika?'],
  },
  searchKnowledgeBase: {
    en: ['Can you explain that in more detail?', 'Are there courses on this topic?', 'How can I get started?', 'What else can you help with?'],
    fr: ['Pouvez-vous expliquer plus en détail ?', 'Y a-t-il des cours sur ce sujet ?', 'Comment commencer ?', 'Quoi d\'autre pouvez-vous aider ?'],
    ht: ['Èske ou ka eksplike sa pi detaye?', 'Èske genyen kou sou sijè sa a?', 'Kijan mwen ka kòmanse?', 'Ki lòt bagay ou ka ede ak?'],
  },
  lookupRepoInfo: {
    en: ['What documentation is available?', 'How often are the repos updated?', 'Can I contribute to these repos?'],
    fr: ['Quelle documentation est disponible ?', 'À quelle fréquence les dépôts sont-ils mis à jour ?', 'Puis-je contribuer ?'],
    ht: ['Ki dokimantasyon ki disponib?', 'Akilè depo yo mete ajou?', 'Èske mwen ka kontribye?'],
  },
  getLatestNews: {
    en: ['Are there programs I can apply for?', 'What courses are available?', 'How can I get involved?'],
    fr: ['Y a-t-il des programmes auxquels postuler ?', 'Quels cours sont disponibles ?', 'Comment m\'impliquer ?'],
    ht: ['Èske genyen pwogram mwen ka aplike pou?', 'Ki kou ki disponib?', 'Kijan mwen ka enplike?'],
  },
  getProgramDeadlines: {
    en: ['How do I apply?', 'Are any programs free?', 'Can I apply for multiple programs?'],
    fr: ['Comment postuler ?', 'Y a-t-il des programmes gratuits ?', 'Puis-je postuler à plusieurs ?'],
    ht: ['Kijan mwen ka aplike?', 'Èske genyen pwogram gratis?', 'Èske mwen ka aplike pou plizyè?'],
  },
  getProgramsAndScholarships: {
    en: ['When is the next deadline?', 'Are these programs free?', 'What courses are available?'],
    fr: ['Quelle est la prochaine date limite ?', 'Ces programmes sont-ils gratuits ?', 'Quels cours sont disponibles ?'],
    ht: ['Ki dat limit pwochen an?', 'Èske pwogram sa yo gratis?', 'Ki kou ki disponib?'],
  },
  getContactInfo: {
    en: ['What programs are available?', 'What courses can I take?', 'What\'s new?'],
    fr: ['Quels programmes sont disponibles ?', 'Quels cours puis-je suivre ?', 'Quoi de neuf ?'],
    ht: ['Ki pwogram ki disponib?', 'Ki kou mwen ka pran?', 'Ki sa ki nouvo?'],
  },
  getEdLightInitiatives: {
    en: ['What courses are available?', 'How can I apply to programs?', 'How can I get involved?'],
    fr: ['Quels cours sont disponibles ?', 'Comment postuler aux programmes ?', 'Comment m\'impliquer ?'],
    ht: ['Ki kou ki disponib?', 'Kijan mwen ka aplike pou pwogram?', 'Kijan mwen ka enplike?'],
  },
};

/** Default follow-ups when no tools were used */
const DEFAULT_FOLLOW_UPS: Record<SupportedLanguage, string[]> = {
  en: [
    'What platforms are available?',
    'What courses can I take?',
    'Are there any programs or opportunities?',
    'How can I help you?',
  ],
  fr: [
    'Quelles plateformes sont disponibles ?',
    'Quels cours puis-je suivre ?',
    'Y a-t-il des programmes ou des opportunités ?',
    'Comment puis-je vous aider ?',
  ],
  ht: [
    'Ki platfòm ki disponib?',
    'Ki kou mwen ka pran?',
    'Èske genyen pwogram oswa opòtinite?',
    'Kijan mwen ka ede ou?',
  ],
};

/**
 * Generate 2–3 contextually relevant follow-up suggestions.
 * Uses the tools that were invoked during the agent turn to pick the best pool.
 */
export function generateFollowUps(
  toolsUsed: string[],
  language: SupportedLanguage,
  count = 3,
): string[] {
  // Priority: first match wins
  const priorityOrder = [
    'getProgramsAndScholarships',
    'getProgramDeadlines',
    'getLatestNews',
    'getContactInfo',
    'getCourseInventory',
    'getEdLightInitiatives',
    'searchKnowledgeBase',
    'lookupRepoInfo',
  ];

  for (const toolName of priorityOrder) {
    if (toolsUsed.includes(toolName)) {
      const pool = FOLLOW_UP_POOLS[toolName]?.[language] ?? FOLLOW_UP_POOLS[toolName]?.['en'] ?? [];
      return shuffleTake(pool, count);
    }
  }

  const pool = DEFAULT_FOLLOW_UPS[language] ?? DEFAULT_FOLLOW_UPS['en'];
  return shuffleTake(pool, count);
}

/** Take `n` items from an array using a deterministic shuffle (stable across calls) */
function shuffleTake<T>(arr: T[], n: number): T[] {
  // Simple deterministic rotation based on time bucket (minute-level)
  const bucket = Math.floor(Date.now() / 60_000) % Math.max(arr.length, 1);
  const rotated = [...arr.slice(bucket), ...arr.slice(0, bucket)];
  return rotated.slice(0, n);
}
