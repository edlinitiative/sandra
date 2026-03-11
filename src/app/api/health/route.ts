import { NextResponse } from 'next/server';
import { APP_NAME, APP_VERSION } from '@/lib/config';
import { getVectorStore } from '@/lib/knowledge';
import { getConfiguredRepos } from '@/lib/github';
import { toolRegistry } from '@/lib/tools';

export async function GET() {
  const vectorStore = getVectorStore();
  const isVectorStoreReady = await vectorStore.isReady();
  const totalChunks = await vectorStore.count();

  return NextResponse.json({
    data: {
      name: APP_NAME,
      version: APP_VERSION,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        vectorStore: {
          ready: isVectorStoreReady,
          totalChunks,
        },
        repos: {
          total: getConfiguredRepos(true).length,
          active: getConfiguredRepos().length,
        },
        tools: {
          registered: toolRegistry.getToolNames(),
          count: toolRegistry.getToolNames().length,
        },
      },
    },
  });
}
