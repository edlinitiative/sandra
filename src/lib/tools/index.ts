// Register all tools on import
import './search-knowledge';
import './get-initiatives';
import './lookup-repo';
import './get-courses';
import './get-programs';
import './get-latest-news';
import './get-deadlines';
import './get-contact-info';

// Private user tools (require authentication)
import './get-user-profile';
import './get-user-enrollments';
import './get-user-certificates';
import './get-application-status';

// Admin tools (require admin:tools scope)
import './trigger-indexing';
import './get-indexing-status';
import './list-connected-systems';
import './view-system-health';

// Phase 10 — Action tools (agentic, queue-backed, rate-limited)
import './recommend-courses';
import './create-lead';
import './submit-interest-form';
import './queue-reminder';
import './draft-email';

// Phase 12 — Google Workspace tools (multi-tenant, connector-backed)
import './search-drive';
import './list-contacts';
import './send-gmail';
import './draft-gmail';
import './create-calendar-event';
import './create-google-form';
import './get-form-responses';

// Phase 13 — WhatsApp Groups (requires Official Business Account)
import './create-whatsapp-group';
import './get-whatsapp-groups';
import './send-whatsapp-group-invite';
import './create-task';
import './create-zoom-meeting';

export type { SandraTool, ToolResult, ToolInfo, ToolContext } from './types';
export { toolRegistry, getToolRegistry } from './registry';
export { executeTool } from './executor';
export {
  withRetry,
  withTimeout,
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  getCircuitBreaker,
  getAllCircuitBreakerStats,
  getCorrelationId,
  setCorrelationId,
  clearCorrelationId,
} from './resilience';
