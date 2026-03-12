import { z } from 'zod';
import { runSandraAgent } from '@/lib/agents';
import { resolveLanguage } from '@/lib/i18n';
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
 *   - { type: 'chunk', content }   (partial response text)
 *   - { type: 'tool', name }       (tool was invoked)
 *   - { type: 'done', toolsUsed, retrievalUsed, usage }
 *   - { type: 'error', message }
 */
export async function POST(request: Request) {
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

    const { message, userId, channel } = parsed.data;
    const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
    const language = resolveLanguage({ explicit: parsed.data.language });

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
              send({ type: 'chunk', content: chunk });
              // Small delay to simulate streaming (only in demo mode)
              await new Promise((r) => setTimeout(r, 30));
            }

            send({
              type: 'done',
              toolsUsed: [],
              retrievalUsed: false,
              demoMode: true,
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            });
            controller.close();
            return;
          }

          // Real agent execution (non-streaming for now, sends final response as chunks)
          // TODO: Implement true token-level streaming when provider supports it
          const result = await runSandraAgent({
            message,
            sessionId,
            userId,
            language,
            channel,
          });

          // Report tool usage
          for (const tool of result.toolsUsed) {
            send({ type: 'tool', name: tool });
          }

          // Stream the response in word-level chunks for smooth rendering
          const words = result.response.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = (i === 0 ? '' : ' ') + words[i]!;
            send({ type: 'chunk', content: chunk });
          }

          send({
            type: 'done',
            toolsUsed: result.toolsUsed,
            retrievalUsed: result.retrievalUsed,
            usage: result.tokenUsage,
          });
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
  }
}
