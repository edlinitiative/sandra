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

// Phase 14 — Extended Google Workspace tools
import './list-calendar-events';
import './update-calendar-event';
import './delete-calendar-event';
import './read-gmail';
import './reply-gmail';
import './create-google-doc';
import './create-spreadsheet';
import './read-drive-file';
import './share-drive-file';

// Phase 14 — EdLight Academic tools
import './search-scholarships';
import './check-application-deadline';
import './get-learning-path';
import './track-learning-progress';
import './submit-application';
import './request-certificate';

// Phase 14 — Reminder & Task management
import './list-reminders';
import './cancel-reminder';
import './list-tasks';

// Phase 14 — Communication & AI utilities
import './send-whatsapp-message';
import './translate-text';
import './summarize-document';
import './web-search';

// Phase 14 — Admin & Ops tools
import './manage-tenant-users';
import './get-usage-analytics';
import './impersonate-user-session';
import './create-github-issue';
import './get-github-pr-status';

// Birthday alerts (admin — scans Google Contacts + all Drive sheets + optional fixed sheet)
import './check-birthdays';

// Phase 14 — User memory & preferences
import './save-user-note';
import './list-user-notes';
import './forget-user-note';
import './update-user-preferences';

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
