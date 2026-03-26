import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { runSandraAgent } from '@/lib/agents';
import { resolveLanguage } from '@/lib/i18n';
import { ensureSessionContinuity, getSessionLanguage } from '@/lib/memory/session-continuity';
import { getCanonicalUserLanguage, resolveCanonicalUser } from '@/lib/users/canonical-user';
import { authenticateRequest, getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { errorResponse, SandraError, ValidationError, chatInputSchema, sanitizeInput, generateRequestId, successResponse, apiErrorResponse } from '@/lib/utils';
import { env } from '@/lib/config';

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
  const requestId = generateRequestId();
  setCorrelationId(requestId);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const err = new ValidationError('Invalid JSON body');
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const parsed = chatInputSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.flatten();
      const err = new ValidationError('Invalid request', { details });
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const {
      sessionId: rawSessionId,
      userId: rawUserId,
      language: rawLanguage,
    } = parsed.data;
    const message = sanitizeInput(parsed.data.message);
    const sessionId = rawSessionId ?? crypto.randomUUID();
    const sessionLanguage = await getSessionLanguage(rawSessionId);
    const userLanguage = await getCanonicalUserLanguage(rawUserId);
    const language = resolveLanguage({
      explicit: rawLanguage,
      sessionLanguage: sessionLanguage ?? userLanguage,
    });
    const canonicalUser = await resolveCanonicalUser({
      sessionId,
      externalUserId: rawUserId,
      language,
      channel: 'web',
    });

    await ensureSessionContinuity({
      sessionId,
      channel: 'web',
      language,
      userId: canonicalUser.userId,
    });

    // Resolve auth scopes (optional — anonymous users get guest scopes)
    let scopes = getScopesForRole('guest');
    try {
      const authResult = await authenticateRequest(request);
      if (authResult.authenticated) {
        scopes = authResult.user.scopes;
      }
    } catch {
      // Continue with guest scopes
    }

    // Demo mode: return canned response when API key is not configured
    if (isApiKeyMissing()) {
      return NextResponse.json(
        successResponse(
          {
            response: getDemoResponse(message, language),
            sessionId,
            language,
            toolsUsed: [],
            retrievalUsed: false,
            demoMode: true,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
          { requestId },
        ),
      );
    }

    const result = await runSandraAgent({
      message,
      sessionId,
      userId: canonicalUser.userId,
      language,
      channel: 'web',
      scopes,
    });

    return NextResponse.json(
      successResponse(
        {
          response: result.response,
          sessionId,
          language: result.language,
          toolsUsed: result.toolsUsed,
          retrievalUsed: result.retrievalUsed,
          suggestedFollowUps: result.suggestedFollowUps ?? [],
          usage: result.tokenUsage,
        },
        { requestId },
      ),
    );
  } catch (error) {
    // If the error is a provider auth error, fall back to demo mode gracefully
    const isAuthError =
      error instanceof SandraError &&
      error.code === 'PROVIDER_ERROR' &&
      error.message.includes('401');

    if (isAuthError) {
      return NextResponse.json(
        successResponse(
          {
            response: getDemoResponse('', 'en'),
            sessionId: crypto.randomUUID(),
            language: 'en',
            toolsUsed: [],
            retrievalUsed: false,
            demoMode: true,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
          { requestId },
        ),
      );
    }

    if (error instanceof ZodError) {
      const err = new ValidationError(error.message);
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  } finally {
    clearCorrelationId();
  }
}
