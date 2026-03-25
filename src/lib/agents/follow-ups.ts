import type { SupportedLanguage } from '@/lib/i18n/types';

/**
 * Follow-up suggestion pools keyed by tool name and language.
 * Returns 2–3 contextually relevant next questions after a response.
 */
const FOLLOW_UP_POOLS: Record<string, Record<SupportedLanguage, string[]>> = {
  getCourseInventory: {
    en: [
      'How do I enroll in a course?',
      'Which course should a complete beginner start with?',
      'Are EdLight courses free?',
      'Do I get a certificate after completing a course?',
      'What is the difference between EdLight Academy and EdLight Code?',
    ],
    fr: [
      'Comment m\'inscrire à un cours ?',
      'Quel cours un débutant complet devrait-il commencer ?',
      'Les cours EdLight sont-ils gratuits ?',
      'Reçoit-on un certificat après avoir terminurs ?',
      'Quelle est la différence entre EdLight Academy et EdLight Code ?',
    ],
    ht: [
      'Kijan mwen ka enskri nan yon kou?',
      'Ki kou yon debutant ta dwe kòmanse ak?',
      'Èske kou EdLight yo gratis?',
      'Èske mwen resevwa yon sètifika apre yon kou?',
      'Ki diferans ant EdLight Academy ak EdLight Code?',
    ],
  },
  getEdLightInitiatives: {
    en: [
      'What courses does EdLight offer?',
      'How can I apply to EdLight programs?',
      'Are there any scholarships available?',
      'How do I contact EdLight?',
      'What is the EdLight Summer Leadership Program?',
    ],
    fr: [
      'Quels cours EdLight propose-t-il ?',
      'Comment postuler aux programmes EdLight ?',
      'Y a-t-il des bourses disponibles ?',
      'Comment contacter EdLight ?',
      'Qu\'est-ce que le programme ESLP ?',
    ],
    ht: [
      'Ki kou EdLight ofri?',
      'Kijan mwen ka aplike pou pwogram EdLight?',
      'Èske genyen bous ki disponib?',
      'Kijan mwen ka kontakte EdLight?',
      'Kisa ESLP ye?',
    ],
  },
  getProgramsAndScholarships: {
    en: [
      'How do I apply for the ESLP program?',
      'Are these programs free?',
      'When is the next application deadline?',
      'What courses can I take on EdLight Code?',
      'Are there external scholarships I can apply for?',
    ],
    fr: [
      'Comment postuler au programme ESLP ?',
      'Ces programmes sont-ils gratuits ?',
      'Quelle est la prochaine date limite de candidature ?',
      'Quels cours puis-je suivre sur EdLight Code ?',
      'Y a-t-il des bourses externes auxquelles je peux postuler ?',
    ],
    ht: [
      'Kijan mwen ka aplike pou pwogram ESLP la?',
      'Èske pwogram sa yo gratis?',
      'Ki dat limit pwochèn aplikasyon an?',
      'Ki kou mwen ka suiv sou EdLight Code?',
      'Èske genyen bous eksèn mwen ka aplike pou yo?',
    ],
  },
  searchKnowledgeBase: {
    en: [
      'Can you explain that in more detail?',
      'What EdLight platform would help me with this?',
      'Are there courses related to this topic?',
      'How can I get started?',
    ],
    fr: [
      'Pouvez-vous expliquer cela plus en détail ?',
      'Quelle plateforme EdLight m\'aiderait avec cela ?',
      'Y a-t-il des cours liés à ce sujet ?',
      'Comment puis-je commencer ?',
    ],
    ht: [
      'Èske ou ka eksplike sa pi detaye?',
      'Ki platfòm EdLight ki ka ede mwen ak sa?',
      'Èske genyen kou ki konsène sijè sa a?',
      'Kijan mwen ka kòmanse?',
    ],
  },
  lookupRepoInfo: {
    en: [
      'What documentation is available in these repos?',
      'How often are the repos updated?',
      'Can I contribute to EdLight repositories?',
    ],
    fr: [
      'Quelle documentation est disponible dans ces dépôts ?',
      'À quelle fréquence les dépôts sont-ils mis à jour ?',
      'Puis-je contribuer aux dépôts EdLight ?',
    ],
    ht: [
      'Ki dokimantasyon ki disponib nan depo sa yo?',
      'Akilè depo yo mete ajou?',
      'Èske mwen ka kontribye nan depo EdLight yo?',
    ],
  },
  getLatestNews: {
    en: [
      'Are there any programs or scholarships I can apply for?',
      'When is the next ESLP application deadline?',
      'What courses are currently available on EdLight?',
      'How can I get involved with EdLight?',
      'Where can I read more EdLight news?',
    ],
    fr: [
      'Y a-t-il des programmes ou des bourses auxquels je peux postuler ?',
      'Quelle est la prochaine date limite pour l\'ESLP ?',
      'Quels cours sont actuellement disponibles sur EdLight ?',
      'Comment puis-je m\'impliquer dans EdLight ?',
      'Où puis-je lire plus d\'actualités EdLight ?',
    ],
    ht: [
      'Èske genyen pwogram oswa bous mwen ka aplike pou yo?',
      'Ki dat limit pou ESLP la?',
      'Ki kou ki disponib sou EdLight kounye a?',
      'Kijan mwen ka enplike nan EdLight?',
      'Ki kote mwen ka li plis nouvèl EdLight?',
    ],
  },
  getProgramDeadlines: {
    en: [
      'How do I apply for the ESLP?',
      'Are any of these programs free?',
      'Can I apply for multiple programs at once?',
      'Where do I submit my application?',
      'Are there external scholarships listed on EdLight News?',
    ],
    fr: [
      'Comment postuler à l\'ESLP ?',
      'Ces programmes sont-ils gratuits ?',
      'Puis-je postuler à plusieurs programmes en même temps ?',
      'Où dois-je soumettre ma candidature ?',
      'Y a-t-il des bourses externes sur EdLight News ?',
    ],
    ht: [
      'Kijan mwen ka aplike pou ESLP la?',
      'Èske pwogram sa yo gratis?',
      'Èske mwen ka aplike pou plizyè pwogram anmenmtan?',
      'Ki kote mwen ka soumèt aplikasyon mwen?',
      'Èske genyen bous eksèn sou EdLight News?',
    ],
  },
  getContactInfo: {
    en: [
      'What programs and opportunities does EdLight offer?',
      'What courses can I take on EdLight?',
      'What is the EdLight Summer Leadership Program?',
      'What\'s new at EdLight?',
    ],
    fr: [
      'Quels programmes et opportunités EdLight propose-t-il ?',
      'Quels cours puis-je suivre sur EdLight ?',
      'Qu\'est-ce que le programme ESLP ?',
      'Quoi de neuf chez EdLight ?',
    ],
    ht: [
      'Ki pwogram ak opòtinite EdLight ofri?',
      'Ki kou mwen ka pran sou EdLight?',
      'Kisa ESLP la ye?',
      'Ki sa ki nouvo nan EdLight?',
    ],
  },
};

/** Default follow-ups when no tools were used */
const DEFAULT_FOLLOW_UPS: Record<SupportedLanguage, string[]> = {
  en: [
    'What EdLight platforms are available?',
    'What courses can I take?',
    'Are there any programs or opportunities?',
    'How can EdLight help me?',
  ],
  fr: [
    'Quelles plateformes EdLight sont disponibles ?',
    'Quels cours puis-je suivre ?',
    'Y a-t-il des programmes ou des opportunités ?',
    'Comment EdLight peut-il m\'aider ?',
  ],
  ht: [
    'Ki platfòm EdLight ki disponib?',
    'Ki kou mwen ka pran?',
    'Èske genyen pwogram oswa opòtinite?',
    'Kijan EdLight ka ede mwen?',
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
