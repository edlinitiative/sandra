// Register all tools on import
import './search-knowledge';
import './get-initiatives';
import './lookup-repo';
import './get-courses';
import './get-programs';
import './get-latest-news';
import './get-deadlines';
import './get-contact-info';

export type { SandraTool, ToolResult, ToolInfo, ToolContext } from './types';
export { toolRegistry, getToolRegistry } from './registry';
export { executeTool } from './executor';
