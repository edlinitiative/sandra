import { z } from 'zod';
import { runSandraAgentStream } from '@/lib/agents';
import { generateFollowUps } from '@/lib/agents/follow-ups';
import { resolveLanguage } from '@/lib/i18n';
import { ensureSessionContinuity, getSessionLanguage } from '@/lib/memory/session-continuity';
import { getCanonicalUserLanguage, resolveCanonicalUser } from '@/lib/users/canonical-user';
import { authenticateRequest, getScopesForRole } from '@/lib/auth';
import { setCorrelationId, clearCorrelationId } from '@/lib/tools/resilience';
import { env } from '@/lib/config';

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  sessionId: z.string().min(1).optional(),
  userId: z.string().optional(),
  language: z.string().optional(),
  channel: z.enum(['web', 'whatsapp', 'instagram', 'email', 'voice']).optional().default('web'),
});

function isApiKeyMissing(): boolean {
  const key = env.OPENAI_API_KEY;
  return !key || key.length < 10 || key.startsWith('sk-your') || key === 'change-me';
}

/**
 * Streaming chat endpoint using Server-Sent Events (SSE).
 *
 * Events emitted:
 *   - { type: 'start', sessionId, language }
 *   - { type: 'token', data }      (partial response text)
 *   - { type: 'tool_call', data }  (tool was invoked)
 *   - { type: 'done', toolsUsed, retrievalUsed, usage }
 *   - { type: 'error', message }
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  setCorrelationId(requestId);

  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { message, userId: rawUserId, channel } = parsed.data;
    const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
    const sessionLanguage = await getSessionLanguage(parsed.data.sessionId);
    const userLanguage = await getCanonicalUserLanguage(rawUserId);
    const language = resolveLanguage({
      explicit: parsed.data.language,
      sessionLanguage: sessionLanguage ?? userLanguage,
    });
    const canonicalUser = await resolveCanonicalUser({
      sessionId,
      externalUserId: rawUserId,
      language,
      channel,
    });

    await ensureSessionContinuity({
      sessionId,
      channel,
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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          // Start event
          send({ type: 'start', sessionId, language });

          // Demo mode check
          if (isApiKeyMissing()) {
            const demoMsg =
              language === 'fr'
                ? "👋 Bonjour ! Je suis Sandra en mode démo. Configurez la clé API OpenAI pour activer toutes mes capacités."
                : language === 'ht'
                  ? "👋 Bonjou! Mwen se Sandra nan mòd demo. Mete kle API OpenAI pou aktive tout kapasite mwen yo."
                  : "👋 Hi! I'm Sandra running in demo mode. Set up the OpenAI API key to unlock my full capabilities.";

            // Simulate streaming by chunking the demo message
            const words = demoMsg.split(' ');
            for (let i = 0; i < words.length; i++) {
              const chunk = (i === 0 ? '' : ' ') + words[i]!;
              send({ type: 'token', data: chunk });
              // Small delay to simulate streaming (only in demo mode)
              await new Promise((r) => setTimeout(r, 30));
            }

            send({
              type: 'done',
              sessionId,
              response: demoMsg,
              toolsUsed: [],
              retrievalUsed: false,
              suggestedFollowUps: generateFollowUps([], language),
              demoMode: true,
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            });
            controller.close();
            return;
          }

          // True token-level streaming via runSandraAgentStream
          for await (const event of runSandraAgentStream({
            message,
            sessionId,
            userId: canonicalUser.userId,
            language,
            channel,
            scopes,
          })) {
            switch (event.type) {
              case 'token':
                send({ type: 'token', data: event.data });
                break;
              case 'tool_call':
                send({ type: 'tool_call', data: event.data });
                break;
              case 'error':
                send({ type: 'error', message: event.data });
                break;
              case 'done':
                send({
                  type: 'done',
                  sessionId: event.data.sessionId,
                  response: event.data.response,
                  toolsUsed: event.data.toolsUsed,
                  retrievalUsed: event.data.retrievalUsed,
                  suggestedFollowUps: event.data.suggestedFollowUps,
                  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                });
                break;
              case 'tool_result':
                // Internal event — not forwarded individually
                break;
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'An unexpected error occurred';
          send({ type: 'error', message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    clearCorrelationId();
  }
}
