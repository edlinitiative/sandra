# Sandra — Agent System

## Overview

Sandra's agent system is built around the **ReAct (Reasoning + Acting)** pattern. The agent receives user input, reasons about what information or actions are needed, optionally uses tools, and generates a response.

## Agent Loop: `runSandraAgent()`

The core function lives in `src/lib/agents/sandra.ts`. Here's the detailed flow:

### 1. Context Assembly
```
Input: { message, sessionId, userId, language, channel }
                    │
                    ▼
        ┌───────────────────┐
        │ Load session memory│ → Recent conversation messages
        │ Load user memory   │ → Known facts about the user
        │ Retrieve knowledge │ → Relevant docs via vector search
        └───────────────────┘
```

### 2. System Prompt Construction
`buildSandraSystemPrompt()` assembles:
- **Identity**: Who Sandra is and what she does
- **Language instruction**: Respond in the user's preferred language
- **User memory**: Known facts about the user
- **Retrieved context**: Relevant documents from the knowledge base
- **Tool awareness**: Which tools are available
- **Behavioral guidelines**: How to respond

### 3. LLM Call Loop
```
while (iterations < maxIterations):
    response = AI.chatCompletion(messages, tools)
    
    if response has tool_calls:
        for each tool_call:
            result = executeTool(name, args)
            append tool result to messages
        continue loop
    else:
        return response.content
```

### 4. Tool Execution
When the LLM returns tool calls:
1. Parse the tool name and arguments (JSON)
2. Look up the tool in the registry
3. Validate arguments with the tool's Zod schema
4. Execute the tool
5. Append the result as a tool message
6. Call the LLM again with the full conversation

## Tools

### Tool Interface
Every tool implements `SandraTool`:
```typescript
interface SandraTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  inputSchema: z.ZodSchema;             // Zod validation
  execute(input: unknown): Promise<ToolResult>;
}
```

### Current Tools
| Tool | Description |
|------|-------------|
| `searchKnowledgeBase` | Search indexed content for relevant information |
| `getEdLightInitiatives` | Get information about EdLight platforms |
| `lookupRepoInfo` | Look up a specific GitHub repository |

### Adding a New Tool
1. Create a new file in `src/lib/tools/`
2. Implement the `SandraTool` interface
3. Register it: `toolRegistry.register(myTool)`
4. Import it in `src/lib/tools/index.ts`
5. The agent will automatically see and use it

## Memory

### Session Memory
- Stores conversation history for the current session
- Used to maintain context within a conversation
- Limited to `MAX_CONTEXT_MESSAGES` recent entries
- Backed by `SessionMemoryStore` interface

### User Memory
- Stores long-term facts about users (preferences, name, interests)
- Keyed by `userId + key` (e.g., "preferred_language")
- Injected into the system prompt as context
- Backed by `UserMemoryStore` interface

## Retrieval (RAG)

The agent uses retrieval-augmented generation:
1. The user's message is embedded using the same model as the indexed content
2. The vector store is searched for similar chunks
3. Top results above a score threshold are formatted as context
4. Context is injected into the system prompt

This means Sandra's responses are grounded in actual EdLight documentation rather than just the LLM's training data.

## Configuration

Agent behavior is controlled by `AgentConfig`:
```typescript
{
  maxIterations: 5,      // Max tool-call loops
  temperature: 0.7,      // LLM creativity
  maxTokens: 2048,       // Max response length
  enableRetrieval: true,  // Use knowledge base
  enableTools: true,      // Allow tool calls
}
```

## Error Handling

- Tool failures are caught and returned as error results (agent sees them and can retry)
- Provider failures throw `ProviderError` (surfaced to the user)
- Max iterations produce a fallback response
- All errors are logged with structured context
