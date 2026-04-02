/**
 * Analytics event type definitions.
 */

export type AnalyticsEventType =
  | 'session_started'
  | 'message_sent'
  | 'tool_executed'
  | 'retrieval_completed'
  | 'response_generated'
  | 'cache_hit';

/** Base shape shared by all events */
export interface BaseAnalyticsEvent {
  eventType: AnalyticsEventType;
  sessionId?: string;
  userId?: string;
  channel?: string;
  language?: string;
}

/** A user message was received and handed to the agent */
export interface MessageSentEvent extends BaseAnalyticsEvent {
  eventType: 'message_sent';
  data: {
    messageLength: number;
    channel: string;
    language: string;
  };
}

/** A tool was invoked during an agent turn */
export interface ToolExecutedEvent extends BaseAnalyticsEvent {
  eventType: 'tool_executed';
  data: {
    toolName: string;
    latencyMs: number;
    success: boolean;
    errorMessage?: string;
  };
}

/** A knowledge retrieval was performed */
export interface RetrievalCompletedEvent extends BaseAnalyticsEvent {
  eventType: 'retrieval_completed';
  data: {
    query: string;
    resultsReturned: number;
    topScore: number;
    latencyMs: number;
    platform?: string;
  };
}

/** A complete agent response was generated */
export interface ResponseGeneratedEvent extends BaseAnalyticsEvent {
  eventType: 'response_generated';
  data: {
    latencyMs: number;
    responseLength: number;
    toolsUsed: string[];
    model: string;
    cacheHit?: boolean;
  };
}

/** An agent turn started (session context loaded) */
export interface SessionStartedEvent extends BaseAnalyticsEvent {
  eventType: 'session_started';
  data: {
    channel: string;
    language: string;
    isNewSession: boolean;
  };
}

/** A cached response was returned instead of calling the LLM */
export interface CacheHitEvent extends BaseAnalyticsEvent {
  eventType: 'cache_hit';
  data: {
    model: string;
    savedLatencyMs?: number;
  };
}

export type AnalyticsEvent =
  | MessageSentEvent
  | ToolExecutedEvent
  | RetrievalCompletedEvent
  | ResponseGeneratedEvent
  | SessionStartedEvent
  | CacheHitEvent;

// ─── Query result types ───────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalEvents: number;
  byEventType: Record<string, number>;
  byChannel: Record<string, number>;
  byLanguage: Record<string, number>;
  topTools: Array<{ tool: string; count: number }>;
  averageResponseMs: number | null;
  cacheHitRate: number | null;
  period: { from: Date; to: Date };
}
