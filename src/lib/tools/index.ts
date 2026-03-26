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

export type { SandraTool, ToolResult, ToolInfo, ToolContext } from './types';
export { toolRegistry, getToolRegistry } from './registry';
export { executeTool } from './executor';
