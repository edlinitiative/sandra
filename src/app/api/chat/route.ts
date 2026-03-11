import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runSandraAgent } from '@/lib/agents';
import { resolveLanguage } from '@/lib/i18n';
import { errorResponse, SandraError } from '@/lib/utils';
import { env } from '@/lib/config';

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  sessionId: z.string().min(1).optional(),
  userId: z.string().optional(),
  language: z.string().optional(),
  channel: z.enum(['web', 'whatsapp', 'instagram', 'email', 'voice']).optional().default('web'),
});

const DEMO_RESPONSES: Record<string, Record<string, string>> = {
  en: {
    default:
      "👋 Hi! I'm Sandra, the AI assistant for the EdLight ecosystem. I'm currently running in demo mode because the AI provider hasn't been configured yet. Once an OpenAI API key is set, I'll be able to answer your questions about EdLight platforms, documentation, and resources.\n\n**To activate me fully:**\n1. Add your OpenAI API key to the `.env` file\n2. Restart the server\n\nIn the meantime, feel free to explore the admin dashboard!",
    greeting:
      "👋 Hello! I'm Sandra, your EdLight AI assistant. I'm in demo mode right now — set up the OpenAI API key to unlock my full capabilities!",
  },
  fr: {
    default:
      "👋 Bonjour ! Je suis Sandra, l'assistante IA de l'écosystème EdLight. Je fonctionne actuellement en mode démo car le fournisseur d'IA n'a pas encore été configuré. Une fois qu'une clé API OpenAI sera définie, je pourrai répondre à vos questions sur les plateformes EdLight.\n\n**Pour m'activer complètement :**\n1. Ajoutez votre clé API OpenAI au fichier `.env`\n2. Redémarrez le serveur",
    greeting:
      "👋 Bonjour ! Je suis Sandra, votre assistante IA EdLight. Je suis en mode démo — configurez la clé API OpenAI pour débloquer toutes mes capacités !",
  },
  ht: {
    default:
      "👋 Bonjou! Mwen se Sandra, asistan AI pou ekosistèm EdLight la. Mwen ap fonksyone nan mòd demonstrasyon kounye a paske founisè AI a poko konfigire. Lè yo mete yon kle API OpenAI, m ap kapab reponn kesyon ou yo sou platfòm EdLight.\n\n**Pou aktive m nèt :**\n1. Ajoute kle API OpenAI ou nan fichye `.env` la\n2. Redmare sèvè a",
    greeting:
      "👋 Bonjou! Mwen se Sandra, asistan AI EdLight ou. Mwen nan mòd demo kounye a — mete kle API OpenAI pou debloke tout kapasite mwen yo!",
  },
};

function getDemoResponse(message: string, language: string): string {
  const lang = DEMO_RESPONSES[language] ?? DEMO_RESPONSES['en']!;
  const lower = message.toLowerCase();
  if (['hello', 'hi', 'hey', 'bonjour', 'salut', 'bonjou'].some((g) => lower.includes(g))) {
    return lang['greeting'] ?? lang['default']!;
  }
  return lang['default']!;
}

function isApiKeyMissing(): boolean {
  const key = env.OPENAI_API_KEY;
  return !key || key.length < 10 || key.startsWith('sk-your') || key === 'change-me';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            issues: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { message, userId, channel } = parsed.data;
    const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
    const language = resolveLanguage(parsed.data.language);

    // Demo mode: return canned response when API key is not configured
    if (isApiKeyMissing()) {
      return NextResponse.json({
        data: {
          response: getDemoResponse(message, language),
          sessionId,
          language,
          toolsUsed: [],
          retrievalUsed: false,
          demoMode: true,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        },
      });
    }

    const result = await runSandraAgent({
      message,
      sessionId,
      userId,
      language,
      channel,
    });

    return NextResponse.json({
      data: {
        response: result.response,
        sessionId,
        language: result.language,
        toolsUsed: result.toolsUsed,
        retrievalUsed: result.retrievalUsed,
        usage: result.tokenUsage,
      },
    });
  } catch (error) {
    // If the error is a provider auth error, fall back to demo mode gracefully
    const isAuthError =
      error instanceof SandraError &&
      error.code === 'PROVIDER_ERROR' &&
      error.message.includes('401');

    if (isAuthError) {
      const body = chatRequestSchema.safeParse(await request.clone().json().catch(() => ({})));
      const language = body.success ? resolveLanguage(body.data.language) : 'en';
      const message = body.success ? body.data.message : '';
      return NextResponse.json({
        data: {
          response: getDemoResponse(message, language),
          sessionId: body.success ? body.data.sessionId ?? crypto.randomUUID() : crypto.randomUUID(),
          language,
          toolsUsed: [],
          retrievalUsed: false,
          demoMode: true,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        },
      });
    }

    const err = errorResponse(error);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
